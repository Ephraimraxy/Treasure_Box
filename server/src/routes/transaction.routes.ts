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
            else if (type === 'referral') where.type = 'REFERRAL_BONUS';
            else if (type === 'investment') where.type = { in: ['INVESTMENT_PAYOUT', 'INVESTMENT_DEBIT'] };
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
        const maxWithdrawal = settings?.maxWithdrawal || 1000000;
        if (amount < minWithdrawal) return res.status(400).json({ error: `Minimum withdrawal is ₦${minWithdrawal}` });
        if (amount > maxWithdrawal) return res.status(400).json({ error: `Maximum withdrawal is ₦${maxWithdrawal}` });

        // Resolve bank details
        let selectedBank: { bankName: string; accountNumber: string; accountName: string; bankCode?: string | null } | null = null;

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

        const isApprovalEnabled = settings?.enableWithdrawalApproval !== false; // Default true

        // ── Capital protection guard ──
        // Check liquidity BEFORE initiating any transfer
        if (!isApprovalEnabled) {
            const { checkLiquidityGuard } = await import('../services/risk.service');
            const liquidityCheck = await checkLiquidityGuard('USER_WITHDRAWAL');
            if (!liquidityCheck.allowed) {
                // Refund user — transfer blocked by risk engine
                await prisma.user.update({ where: { id: user.id }, data: { balance: { increment: amount } } });
                return res.status(503).json({
                    error: 'Transfers temporarily paused for system maintenance. Please try again later.',
                    code: 'LIQUIDITY_PROTECTION'
                });
            }
        }

        const baseMeta: any = {
            bankDetails: {
                bankName: selectedBank!.bankName,
                accountNumber: selectedBank!.accountNumber,
                accountName: selectedBank!.accountName
            },
            flow: isApprovalEnabled ? 'MANUAL_APPROVAL' : 'AUTO_TRANSFER',
            createdBy: 'USER'
        };

        // Atomic: create transaction + debit balance together (prevents "missing money" if any write fails)
        const transaction = await prisma.$transaction(async (tx) => {
            const debited = await tx.user.updateMany({
                where: { id: user.id, balance: { gte: amount } },
                data: { balance: { decrement: amount } }
            });
            if (debited.count !== 1) {
                throw new Error('Insufficient balance');
            }

            return tx.transaction.create({
                data: {
                    userId: user.id,
                    type: 'WITHDRAWAL',
                    amount,
                    status: 'PENDING',
                    description: isApprovalEnabled ? 'Withdrawal Request' : 'Withdrawal Processing',
                    meta: baseMeta
                }
            });
        });

        if (!isApprovalEnabled) {
            // Automated Withdrawal (final status is confirmed via Paystack transfer webhook)
            if (!selectedBank.bankCode) {
                await prisma.$transaction([
                    prisma.user.update({ where: { id: user.id }, data: { balance: { increment: amount } } }),
                    prisma.transaction.update({
                        where: { id: transaction.id },
                        data: { status: 'FAILED', meta: { ...(transaction.meta as any), error: 'Missing bank code' } }
                    })
                ]);
                return res.status(400).json({ error: 'Your bank details are missing the Bank Code. Please remove and re-add your bank account to enable instant withdrawals.' });
            }

            try {
                const { createTransferRecipient, initiateTransfer, generateReference } = await import('../services/paystack.service');

                // 1) Create transfer recipient
                const recipient = await createTransferRecipient(
                    selectedBank!.accountName,
                    selectedBank!.accountNumber,
                    selectedBank!.bankCode!
                );

                // 2) Initiate transfer
                const reference = generateReference('WDR');
                const transfer = await initiateTransfer(
                    amount,
                    recipient.data.recipient_code,
                    reference,
                    'Withdrawal from Treasure Box'
                );

                // Persist Paystack transfer data (do NOT mark SUCCESS here; webhook will finalize)
                await prisma.transaction.update({
                    where: { id: transaction.id },
                    data: {
                        meta: {
                            ...(transaction.meta as any),
                            paystackReference: reference,
                            transferCode: transfer.data.transfer_code,
                            transferStatus: transfer.data.status,
                            transferInitiatedAt: new Date().toISOString(),
                            transferResponse: transfer.data
                        }
                    }
                });
            } catch (error: any) {
                const safeMessage = error.response?.data?.message || error.message || 'Transfer initiation failed';
                console.error("Automated Withdrawal Error", safeMessage);

                // Refund + mark failed atomically
                await prisma.$transaction([
                    prisma.user.update({ where: { id: user.id }, data: { balance: { increment: amount } } }),
                    prisma.transaction.update({
                        where: { id: transaction.id },
                        data: { status: 'FAILED', meta: { ...(transaction.meta as any), error: safeMessage } }
                    }),
                    prisma.notification.create({
                        data: {
                            userId: user.id,
                            title: 'Withdrawal Failed',
                            message: `Your withdrawal of ₦${amount.toLocaleString()} failed and your funds were refunded. Reason: ${safeMessage}`,
                            type: 'ERROR'
                        }
                    })
                ]);

                return res.status(400).json({ error: safeMessage });
            }
        }

        // Notify Admins only if PENDING (Manual Approval needed)
        if (isApprovalEnabled) {
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
        } else {
            // Notify User of Processing (final state set by webhook)
            await prisma.notification.create({
                data: {
                    userId: user.id,
                    title: 'Withdrawal Processing',
                    message: `Your withdrawal of ₦${amount.toLocaleString()} is processing. You will be notified once it is completed.`,
                    type: 'INFO'
                }
            });
        }

        res.status(201).json({ message: isApprovalEnabled ? 'Withdrawal request submitted' : 'Withdrawal processing', transaction });
    } catch (error) {
        next(error);
    }
});

// Utility payment — VTPass Integration + Identity Verification
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
        let vtpassResponse = null;

        // ── Identity Verification Types (DataVerify / Paystack / Simulation) ──
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

        // ── VTU Services (VTPass Integration) ──
        const vtuTypes = ['AIRTIME', 'DATA', 'POWER', 'CABLE'];

        if (vtuTypes.includes(type)) {
            const { isVTPassConfigured, purchaseAirtime, purchaseData, purchaseElectricity, purchaseCable } = await import('../services/vtpass.service');

            if (!isVTPassConfigured()) {
                // Fallback to simulated success if VTPass not configured
                console.log(`[Utility] VTPass not configured, simulating ${type} success`);
                vtpassResponse = { simulated: true, status: 'delivered' };
            } else {
                try {
                    if (type === 'AIRTIME') {
                        const serviceID = meta.serviceID || meta.network || 'mtn';
                        const result = await purchaseAirtime(meta.phone, amount, serviceID);
                        if (result.code !== '000') {
                            return res.status(400).json({
                                error: result.response_description || 'Airtime purchase failed. Please try again.',
                                vtpassCode: result.code
                            });
                        }
                        vtpassResponse = result;
                    } else if (type === 'DATA') {
                        const serviceID = meta.serviceID || 'mtn-data';
                        const result = await purchaseData(meta.phone, serviceID, meta.variationCode, amount);
                        if (result.code !== '000') {
                            return res.status(400).json({
                                error: result.response_description || 'Data purchase failed. Please try again.',
                                vtpassCode: result.code
                            });
                        }
                        vtpassResponse = result;
                    } else if (type === 'POWER') {
                        const serviceID = meta.serviceID || meta.provider;
                        const variationCode = meta.variationCode || meta.meterType || 'prepaid';
                        const result = await purchaseElectricity(
                            meta.meterNumber || meta.identifier,
                            serviceID,
                            variationCode,
                            amount,
                            meta.phone || user.phone || ''
                        );
                        if (result.code !== '000') {
                            return res.status(400).json({
                                error: result.response_description || 'Electricity purchase failed. Please try again.',
                                vtpassCode: result.code
                            });
                        }
                        vtpassResponse = result;
                    } else if (type === 'CABLE') {
                        const serviceID = meta.serviceID || meta.provider;
                        const result = await purchaseCable(
                            meta.smartCardNumber || meta.identifier,
                            serviceID,
                            meta.variationCode,
                            amount,
                            meta.phone || user.phone || ''
                        );
                        if (result.code !== '000') {
                            return res.status(400).json({
                                error: result.response_description || 'Cable subscription failed. Please try again.',
                                vtpassCode: result.code
                            });
                        }
                        vtpassResponse = result;
                    }
                } catch (vtpassError: any) {
                    console.error(`[Utility] VTPass ${type} error:`, vtpassError.message);
                    return res.status(500).json({
                        error: `${type} service temporarily unavailable. Please try again later.`
                    });
                }
            }
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
                description: `${type.replace(/_/g, ' ')} Service`,
                meta: {
                    ...meta,
                    verificationData,
                    vtpassResponse: vtpassResponse ? {
                        code: vtpassResponse.code,
                        requestId: vtpassResponse.requestId,
                        transactionId: vtpassResponse.content?.transactions?.transactionId,
                        status: vtpassResponse.content?.transactions?.status,
                        purchased_code: vtpassResponse.purchased_code,
                    } : null,
                }
            }
        });

        // Create notification
        await prisma.notification.create({
            data: {
                userId: req.user!.id,
                title: 'Service Successful',
                message: `Your ${type.replace(/_/g, ' ')} service of ₦${amount.toLocaleString()} was successful.`,
                type: 'SUCCESS'
            }
        });

        res.status(201).json({
            message: 'Service successful',
            transaction,
            verificationData,
            purchasedCode: vtpassResponse?.purchased_code || null,
        });
    } catch (error) {
        next(error);
    }
});

export default router;


