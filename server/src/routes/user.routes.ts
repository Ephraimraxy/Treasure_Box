import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// ... (previous code)

// Get User Profile (including KYC status)
router.get('/me', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                kycStatus: true,
                kycVerified: true,
                kycPhotoUrl: true,
                role: true,
                referralCode: true,
                balance: true,
                referralEarnings: true,
                virtualAccount: true,
                transactionPin: true,
                _count: {
                    select: { referrals: true }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Transform to return boolean for pin presence
        const safeUser = {
            ...user,
            transactionPin: !!user.transactionPin
        };

        res.json(safeUser);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Get User Referrals
router.get('/referrals', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const referrals = await prisma.user.findMany({
            where: { referredById: req.user!.id },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                kycVerified: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(referrals);
    } catch (error) {
        next(error);
    }
});

// Set Transaction PIN
router.post('/set-pin', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { pin } = z.object({
            pin: z.string().length(4).regex(/^\d+$/, 'PIN must be 4 digits')
        }).parse(req.body);

        const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
        if (user?.transactionPin) {
            return res.status(400).json({ error: 'PIN already set. Use change-pin endpoint.' });
        }

        const hashedPin = await bcrypt.hash(pin, 10);
        await prisma.user.update({
            where: { id: req.user!.id },
            data: { transactionPin: hashedPin }
        });

        res.json({ message: 'Transaction PIN set successfully' });
    } catch (error) {
        next(error);
    }
});

// Change Transaction PIN
router.post('/change-pin', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { oldPin, newPin } = z.object({
            oldPin: z.string().length(4),
            newPin: z.string().length(4).regex(/^\d+$/, 'PIN must be 4 digits')
        }).parse(req.body);

        const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
        if (!user?.transactionPin) {
            return res.status(400).json({ error: 'PIN not set. Use set-pin endpoint.' });
        }

        const isMatch = await bcrypt.compare(oldPin, user.transactionPin);
        if (!isMatch) {
            return res.status(400).json({ error: 'Incorrect old PIN' });
        }

        const hashedPin = await bcrypt.hash(newPin, 10);
        await prisma.user.update({
            where: { id: req.user!.id },
            data: { transactionPin: hashedPin }
        });

        res.json({ message: 'Transaction PIN updated successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
