import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const DURATIONS = [
    { days: 7, baseRate: 2 },
    { days: 14, baseRate: 4 },
    { days: 30, baseRate: 8 },
    { days: 60, baseRate: 12 },
];

const MIN_INVESTMENT = 20000;

const createInvestmentSchema = z.object({
    amount: z.number().min(MIN_INVESTMENT),
    durationDays: z.number(),
    bonusRate: z.number().min(0).max(8).optional()
});

// Get user investments
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const investments = await prisma.investment.findMany({
            where: { userId: req.user!.id },
            orderBy: { createdAt: 'desc' }
        });

        res.json(investments);
    } catch (error) {
        next(error);
    }
});

// Create investment
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
    try {
        // Validation schema (dynamic min handling inside)
        const schema = z.object({
            amount: z.number().positive(),
            durationDays: z.number(),
            bonusRate: z.number().min(0).max(8).optional()
        });

        const { amount, durationDays, bonusRate = 0 } = schema.parse(req.body);

        // Check Dynamic Minimum
        const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
        const minInvestment = settings?.minInvestment || 5000;

        if (amount < minInvestment) {
            return res.status(400).json({ error: `Minimum investment is ₦${minInvestment.toLocaleString()}` });
        }

        const durationConfig = DURATIONS.find(d => d.days === durationDays);
        if (!durationConfig) {
            return res.status(400).json({ error: 'Invalid duration' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
        if (!user || user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Deduct balance
        await prisma.user.update({
            where: { id: req.user!.id },
            data: { balance: { decrement: amount } }
        });

        const maturityDate = new Date();
        maturityDate.setDate(maturityDate.getDate() + durationDays);

        const investment = await prisma.investment.create({
            data: {
                userId: req.user!.id,
                principal: amount,
                durationDays,
                baseRate: durationConfig.baseRate,
                bonusRate,
                maturityDate
            }
        });

        // Record transaction
        await prisma.transaction.create({
            data: {
                userId: req.user!.id,
                type: 'INVESTMENT_DEBIT',
                amount,
                status: 'SUCCESS',
                description: `Investment #${investment.id.slice(-4)} created`
            }
        });

        // Create notification
        await prisma.notification.create({
            data: {
                userId: req.user!.id,
                title: 'Investment Created',
                message: `Your investment of ₦${amount.toLocaleString()} for ${durationDays} days has been created.`,
                type: 'SUCCESS'
            }
        });

        res.status(201).json({
            message: 'Investment created successfully',
            investment
        });
    } catch (error) {
        next(error);
    }
});

// Request Investment Withdrawal
router.post('/:id/withdraw', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const investment = await prisma.investment.findUnique({
            where: { id },
            include: { user: { include: { bankDetails: true } } }
        });

        if (!investment || investment.userId !== userId) {
            return res.status(404).json({ error: 'Investment not found' });
        }

        if (investment.status === 'PAYOUT_PENDING') {
            return res.status(400).json({ error: 'Withdrawal already requested' });
        }

        if (investment.status === 'PAYOUT_PROCESSED' || investment.payoutProcessed) {
            return res.status(400).json({ error: 'Withdrawal already processed' });
        }

        if (investment.status !== 'MATURED') {
            return res.status(400).json({ error: 'Investment has not matured yet' });
        }

        if (!investment.user.bankDetails) {
            return res.status(400).json({ error: 'Please save your bank details first' });
        }

        const totalRate = investment.baseRate + investment.bonusRate;
        const payoutAmount = investment.principal * (1 + totalRate / 100);

        await prisma.$transaction([
            // Update investment status
            prisma.investment.update({
                where: { id },
                data: { status: 'PAYOUT_PENDING' }
            }),
            // Create pending transaction for Admin Approval
            prisma.transaction.create({
                data: {
                    userId,
                    investmentId: id,
                    type: 'INVESTMENT_PAYOUT',
                    amount: payoutAmount,
                    status: 'PENDING',
                    description: `Matured Investment Withdrawal Request`,
                    meta: {
                        bankName: investment.user.bankDetails.bankName,
                        accountNumber: investment.user.bankDetails.accountNumber,
                        accountName: investment.user.bankDetails.accountName
                    }
                }
            })
        ]);

        res.json({ message: 'Withdrawal request submitted for approval' });
    } catch (error) {
        next(error);
    }
});

// Process matured investments (cron job endpoint)
router.post('/process-maturity', async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.CRON_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const now = new Date();
        const maturedInvestments = await prisma.investment.findMany({
            where: {
                status: 'ACTIVE',
                payoutProcessed: false,
                maturityDate: { lte: now }
            }
        });

        let processedCount = 0;

        for (const investment of maturedInvestments) {
            const totalRate = investment.baseRate + investment.bonusRate;
            const payout = investment.principal * (1 + totalRate / 100);

            await prisma.$transaction([
                prisma.investment.update({
                    where: { id: investment.id },
                    data: { status: 'MATURED' }
                }),
                prisma.notification.create({
                    data: {
                        userId: investment.userId,
                        title: 'Investment Matured',
                        message: `Investment #${investment.id.slice(-4)} has matured! You can now request withdrawal.`,
                        type: 'SUCCESS'
                    }
                })
            ]);

            processedCount++;
        }

        res.json({ message: `Processed ${processedCount} matured investments` });
    } catch (error) {
        next(error);
    }
});

export default router;
