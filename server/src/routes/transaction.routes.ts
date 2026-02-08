import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const router = Router();
const prisma = new PrismaClient();

const depositSchema = z.object({
    amount: z.number().positive()
});

const withdrawSchema = z.object({
    amount: z.number().positive()
});

// Get user transactions
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { userId: req.user!.id },
            orderBy: { createdAt: 'desc' }
        });

        res.json(transactions);
    } catch (error) {
        next(error);
    }
});

// Request deposit (simulated - in production, integrate with payment gateway)
router.post('/deposit', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { amount } = depositSchema.parse(req.body);

        const transaction = await prisma.transaction.create({
            data: {
                userId: req.user!.id,
                type: 'DEPOSIT',
                amount,
                status: 'PENDING',
                description: `Deposit of ₦${amount.toLocaleString()}`
            }
        });

        res.status(201).json({
            message: 'Deposit request created',
            transaction
        });
    } catch (error) {
        next(error);
    }
});

// Request withdrawal
router.post('/withdraw', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { amount, pin } = withdrawSchema.extend({
            pin: z.string().length(4)
        }).parse(req.body);

        const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

        if (!user || user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        if (!user.transactionPin) {
            return res.status(400).json({ error: 'Transaction PIN not set' });
        }

        const isPinValid = await bcrypt.compare(pin, user.transactionPin);
        if (!isPinValid) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        // Deduct balance immediately, admin can reverse if rejected
        await prisma.user.update({
            where: { id: req.user!.id },
            data: { balance: { decrement: amount } }
        });

        const transaction = await prisma.transaction.create({
            data: {
                userId: req.user!.id,
                type: 'WITHDRAWAL',
                amount,
                status: 'PENDING',
                description: `Withdrawal of ₦${amount.toLocaleString()}`
            }
        });

        // Send Email Notification
        if (process.env.RESEND_API_KEY) {
            const { sendTransactionEmail } = await import('../services/email.service');
            sendTransactionEmail(user.email, 'withdrawal', amount, 'PENDING').catch(console.error);
        }

        // Create In-App Notification
        await prisma.notification.create({
            data: {
                userId: req.user!.id,
                title: 'Withdrawal Initiated',
                message: `Your withdrawal request of ₦${amount.toLocaleString()} has been submitted.`,
                type: 'INFO'
            }
        });

        res.status(201).json({
            message: 'Withdrawal request submitted for approval',
            transaction
        });
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

        if (!user.transactionPin) {
            return res.status(400).json({ error: 'Transaction PIN not set' });
        }

        const isPinValid = await bcrypt.compare(pin, user.transactionPin);
        if (!isPinValid) {
            return res.status(401).json({ error: 'Invalid PIN' });
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
                description: `${type} payment`,
                meta
            }
        });

        // Create notification
        await prisma.notification.create({
            data: {
                userId: req.user!.id,
                title: 'Payment Successful',
                message: `Your ${type} payment of ₦${amount.toLocaleString()} was successful.`,
                type: 'SUCCESS'
            }
        });

        res.status(201).json({
            message: 'Payment successful',
            transaction
        });
    } catch (error) {
        next(error);
    }
});

export default router;
