import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.middleware';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Create Dispute
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const schema = z.object({
            subject: z.string().min(3),
            message: z.string().min(10),
            snapshot: z.string().optional() // Base64 string
        });

        const { subject, message, snapshot } = schema.parse(req.body);
        let snapshotUrl = null;

        if (snapshot) {
            // Validate Base64 image
            const matches = snapshot.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const type = matches[1];
                const data = Buffer.from(matches[2], 'base64');
                const extension = type.split('/')[1];

                const filename = `dispute_${req.user!.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${extension}`;
                const filepath = path.join(UPLOAD_DIR, filename);

                fs.writeFileSync(filepath, data);
                snapshotUrl = `/uploads/${filename}`;
            }
        }

        const dispute = await prisma.dispute.create({
            data: {
                userId: req.user!.id,
                subject,
                message,
                snapshotUrl
            }
        });

        // Notify Admins (Optional: could add Notification for generic admin user if exists, or just log)
        // For now, we rely on Admin Dashboard pulling data.

        res.json(dispute);
    } catch (error) {
        next(error);
    }
});

// Get User Disputes
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const disputes = await prisma.dispute.findMany({
            where: { userId: req.user!.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(disputes);
    } catch (error) {
        next(error);
    }
});

// Admin: Get All Disputes
router.get('/all', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const disputes = await prisma.dispute.findMany({
            include: {
                user: {
                    select: { id: true, name: true, username: true, email: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(disputes);
    } catch (error) {
        next(error);
    }
});

// Admin: Resolve Dispute
router.put('/:id/resolve', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { reply, status } = req.body; // status: RESOLVED or CLOSED

        const dispute = await prisma.dispute.update({
            where: { id },
            data: {
                adminReply: reply,
                status: status || 'RESOLVED'
            }
        });

        // Notify User
        await prisma.notification.create({
            data: {
                userId: dispute.userId,
                title: 'Dispute Update',
                message: `Your dispute "${dispute.subject}" has been updated: ${status || 'RESOLVED'}.`,
                type: 'INFO'
            }
        });

        res.json(dispute);
    } catch (error) {
        next(error);
    }
});

export default router;
