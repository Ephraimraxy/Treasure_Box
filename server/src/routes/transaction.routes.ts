import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { verifyIdentityNumber, IdentityType } from '../services/identity.service';

const router = Router();
const prisma = new PrismaClient();

// ... existing code ...

// Get User Transactions
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const type = req.query.type as string;
        const search = req.query.search as string;

        const where: any = { userId: req.user!.id };
        if (type && type !== 'all') {
            if (type === 'deposit') where.type = 'DEPOSIT';
            else if (type === 'withdrawal') where.type = 'WITHDRAWAL';
            else if (type === 'investment') where.type = { contains: 'INVESTMENT' };
        }

        if (search && search.trim()) {
            where.description = { contains: search.trim(), mode: 'insensitive' };
        }

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: skip
            }),
            prisma.transaction.count({ where })
        ]);

        res.json({
            data: transactions,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
});


// Withdraw Funds
router.post('/withdraw', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { amount, pin, bankDetailId } = z.object({
            amount: z.number().positive(),
            pin: z.string().length(4),
            bankDetailId: z.string().optional()
        }).parse(req.body);

        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { bankDetails: true }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isSuspended) return res.status(403).json({ error: 'Account suspended' });

        // Check PIN
        if (!user.transactionPin) return res.status(400).json({ error: 'Transaction PIN not set' });
        const validPin = await bcrypt.compare(pin, user.transactionPin);
        if (!validPin) return res.status(401).json({ error: 'Invalid PIN' });

        // Check Balance
        if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

        // Check Settings (Min Withdrawal)
        const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
        const minWithdrawal = settings?.minWithdrawal || 1000;
        if (amount < minWithdrawal) return res.status(400).json({ error: `Minimum withdrawal is ₦${minWithdrawal}` });

        // Resolve bank details
        let selectedBank: { bankName: string; accountNumber: string; accountName: string } | null = null;

        if (bankDetailId) {
            const found = user.bankDetails.find(b => b.id === bankDetailId);
            if (!found) return res.status(400).json({ error: 'Selected bank account not found' });
            selectedBank = found;
        } else if (user.bankDetails.length === 1) {
            selectedBank = user.bankDetails[0];
        } else if (user.bankDetails.length > 1) {
            return res.status(400).json({ error: 'Multiple bank accounts linked. Please select one.' });
        } else {
            return res.status(400).json({ error: 'No bank account linked. Please add one in your Profile.' });
        }

        // Deduct balance and create transaction
        await prisma.user.update({
            where: { id: user.id },
            data: { balance: { decrement: amount } }
        });

        const transaction = await prisma.transaction.create({
            data: {
                userId: user.id,
                type: 'WITHDRAWAL',
                amount,
                status: 'PENDING',
                description: 'Withdrawal Request',
                meta: {
                    bankDetails: {
                        bankName: selectedBank!.bankName,
                        accountNumber: selectedBank!.accountNumber,
                        accountName: selectedBank!.accountName
                    }
                }
            }
        });

        // Notify Admins
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        if (admins.length > 0) {
            await prisma.notification.createMany({
                data: admins.map(admin => ({
                    userId: admin.id,
                    title: 'New Withdrawal Request',
                    message: `User ${user.name || user.email} requested withdrawal of ₦${amount.toLocaleString()}`,
                    type: 'INFO'
                }))
            });
        }

        res.status(201).json({ message: 'Withdrawal request submitted', transaction });
    } catch (error) {
        next(error);
    }
});

// Utility payment (simulated)
router.post('/utility', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { type, amount, meta, pin } = req.body;

        const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

        if (!user || user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        if (user.isSuspended) {
            return res.status(403).json({ error: 'Your account is suspended. You cannot make payments.' });
        }

        if (!user.transactionPin) {
            return res.status(400).json({ error: 'Transaction PIN not set' });
        }

        const isPinValid = await bcrypt.compare(pin, user.transactionPin);
        if (!isPinValid) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        let verificationData = null;

        // Perform verification if applicable
        const identityTypes = ['NIN', 'BVN', 'NIN_MODIFICATION', 'NIN_VALIDATION', 'NIN_PERSONALIZATION', 'BVN_MODIFICATION', 'BVN_RETRIEVAL'];

        if (identityTypes.includes(type)) {
            const result = await verifyIdentityNumber(
                type.toLowerCase() as IdentityType,
                meta.identifier,
                meta.details // Pass details for modifications
            );

            if (!result.success) {
                return res.status(400).json({ error: result.message || 'Verification failed' });
            }
            verificationData = result.data;
        }

        await prisma.user.update({
            where: { id: req.user!.id },
            data: { balance: { decrement: amount } }
        });

        const transaction = await prisma.transaction.create({
            data: {
                userId: req.user!.id,
                type: 'UTILITY_BILL',
                amount,
                status: 'SUCCESS',
                description: `${type.replace('_', ' ')} Service`,
                meta: { ...meta, verificationData }
            }
        });

        // Create notification
        await prisma.notification.create({
            data: {
                userId: req.user!.id,
                title: 'Service Successful',
                message: `Your ${type} service of ₦${amount.toLocaleString()} was successful.`,
                type: 'SUCCESS'
            }
        });

        res.status(201).json({
            message: 'Service successful',
            transaction,
            verificationData
        });
    } catch (error) {
        next(error);
    }
});

export default router;
