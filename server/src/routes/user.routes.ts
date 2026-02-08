import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Schema for KYC submission
const kycSchema = z.object({
    photoUrl: z.string().optional(), // In a real app, this would be required or handled via file upload
});

// Submit KYC
router.post('/kyc', authenticate, async (req: Request, res: Response) => {
    try {
        const { photoUrl } = kycSchema.parse(req.body);
        const userId = (req as any).user.userId;

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                kycStatus: 'PENDING', // Or VERIFIED if we trust the "liveness" immediately
                kycPhotoUrl: photoUrl,
                kycVerified: false // Admin will verify? Or auto-verify?
            }
        });

        res.json({
            message: 'KYC submitted successfully',
            user: {
                id: user.id,
                kycStatus: user.kycStatus,
                kycVerified: user.kycVerified
            }
        });

    } catch (error) {
        console.error('KYC submission error:', error);
        res.status(500).json({ error: 'Failed to submit KYC' });
    }
});

// Get User Profile (including KYC status)
router.get('/profile', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.userId;
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
                virtualAccount: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

export default router;
