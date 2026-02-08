import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: {
                bankDetails: true,
                virtualAccount: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        next(error);
    }
});

// Update profile
router.patch('/me', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { name, username, phone, address } = req.body;

        const user = await prisma.user.update({
            where: { id: req.user!.id },
            data: { name, username, phone, address }
        });

        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        next(error);
    }
});

// Update bank details
router.put('/me/bank', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { bankName, accountNumber, accountName } = req.body;

        const bankDetails = await prisma.bankDetail.upsert({
            where: { userId: req.user!.id },
            update: { bankName, accountNumber, accountName },
            create: { userId: req.user!.id, bankName, accountNumber, accountName }
        });

        res.json(bankDetails);
    } catch (error) {
        next(error);
    }
});

// Get user notifications
router.get('/me/notifications', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user!.id },
            orderBy: { createdAt: 'desc' }
        });

        res.json(notifications);
    } catch (error) {
        next(error);
    }
});

// Mark notifications as read
router.patch('/me/notifications/read', authenticate, async (req: AuthRequest, res, next) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user!.id },
            data: { read: true }
        });

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
    }
});

export default router;
