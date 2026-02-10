import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { verifyIdentityNumber } from '../services/identity.service';

const router = Router();
const prisma = new PrismaClient();

// ... existing code ...

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
        if (type === 'NIN' || type === 'BVN') {
            const result = await verifyIdentityNumber(type.toLowerCase() as 'nin' | 'bvn', meta.identifier);
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
                description: `${type} Service`,
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
