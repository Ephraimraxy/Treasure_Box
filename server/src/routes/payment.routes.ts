import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import * as paystackService from '../services/paystack.service';

const router = Router();
const prisma = new PrismaClient();

// Initialize Paystack Payment
router.post('/initialize', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const schema = z.object({
            amount: z.number().min(1000),
            purpose: z.enum(['deposit', 'investment'])
        });

        const { amount, purpose } = schema.parse(req.body);
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const reference = paystackService.generateReference('DEP');

        // Create pending transaction
        await prisma.transaction.create({
            data: {
                userId,
                type: 'DEPOSIT',
                amount,
                status: 'PENDING',
                description: `Deposit via Paystack`,
                meta: { reference, purpose }
            }
        });

        const result = await paystackService.initializeTransaction(
            user.email,
            amount,
            reference,
            { userId, purpose }
        );

        res.json({
            message: 'Payment initialized',
            authorization_url: result.data.authorization_url,
            reference: result.data.reference
        });
    } catch (error) {
        next(error);
    }
});

// Verify Payment
router.get('/verify/:reference', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { reference } = req.params;
        const userId = req.user!.id;

        const result = await paystackService.verifyTransaction(reference);

        if (result.data.status === 'success') {
            // Find the pending transaction
            const transaction = await prisma.transaction.findFirst({
                where: {
                    userId,
                    meta: { path: ['reference'], equals: reference }
                }
            });

            if (transaction && transaction.status === 'PENDING') {
                // Update transaction and credit user
                await prisma.$transaction([
                    prisma.transaction.update({
                        where: { id: transaction.id },
                        data: { status: 'SUCCESS' }
                    }),
                    prisma.user.update({
                        where: { id: userId },
                        data: { balance: { increment: transaction.amount } }
                    }),
                    prisma.notification.create({
                        data: {
                            userId,
                            title: 'Deposit Successful',
                            message: `Your deposit of ₦${transaction.amount.toLocaleString()} was successful.`,
                            type: 'SUCCESS'
                        }
                    })
                ]);
            }

            res.json({ message: 'Payment verified successfully', status: 'success' });
        } else {
            res.json({ message: 'Payment not successful', status: result.data.status });
        }
    } catch (error) {
        next(error);
    }
});

// Paystack Webhook
router.post('/webhook', async (req, res, next) => {
    try {
        const signature = req.headers['x-paystack-signature'] as string;
        const payload = JSON.stringify(req.body);

        // Verify webhook signature
        if (!paystackService.verifyWebhookSignature(payload, signature)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const event = req.body;

        if (event.event === 'charge.success') {
            const { reference, amount, metadata } = event.data;
            const amountInNaira = amount / 100;

            // Find transaction by reference
            const transaction = await prisma.transaction.findFirst({
                where: {
                    meta: { path: ['reference'], equals: reference }
                }
            });

            if (transaction && transaction.status === 'PENDING') {
                await prisma.$transaction([
                    prisma.transaction.update({
                        where: { id: transaction.id },
                        data: { status: 'SUCCESS' }
                    }),
                    prisma.user.update({
                        where: { id: transaction.userId },
                        data: { balance: { increment: amountInNaira } }
                    }),
                    prisma.notification.create({
                        data: {
                            userId: transaction.userId,
                            title: 'Deposit Successful',
                            message: `Your deposit of ₦${amountInNaira.toLocaleString()} was successful.`,
                            type: 'SUCCESS'
                        }
                    })
                ]);
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// Get Banks List
router.get('/banks', authenticate, async (req, res, next) => {
    try {
        const result = await paystackService.getBanks();
        res.json(result.data);
    } catch (error) {
        next(error);
    }
});

// Verify Bank Account
router.post('/verify-account', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const schema = z.object({
            accountNumber: z.string().length(10),
            bankCode: z.string()
        });

        const { accountNumber, bankCode } = schema.parse(req.body);

        const result = await paystackService.verifyAccountNumber(accountNumber, bankCode);

        res.json({
            accountName: result.data.account_name,
            accountNumber: result.data.account_number
        });
    } catch (error: any) {
        if (error.response?.status === 422) {
            return res.status(400).json({ error: 'Could not verify account' });
        }
        next(error);
    }
});

export default router;
