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
        const { amount, durationDays, bonusRate = 0 } = createInvestmentSchema.parse(req.body);

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
                prisma.user.update({
                    where: { id: investment.userId },
                    data: { balance: { increment: payout } }
                }),
                prisma.investment.update({
                    where: { id: investment.id },
                    data: { status: 'MATURED', payoutProcessed: true }
                }),
                prisma.transaction.create({
                    data: {
                        userId: investment.userId,
                        type: 'INVESTMENT_PAYOUT',
                        amount: payout,
                        status: 'SUCCESS',
                        description: `Investment #${investment.id.slice(-4)} matured`
                    }
                }),
                prisma.notification.create({
                    data: {
                        userId: investment.userId,
                        title: 'Investment Matured',
                        message: `Investment #${investment.id.slice(-4)} matured! ₦${payout.toLocaleString()} credited.`,
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
