import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// Schema for request validation
const researchRequestSchema = z.object({
    role: z.enum(['STUDENT', 'ACADEMIC', 'RESEARCHER', 'INSTITUTION']),
    institution: z.string().optional(),
    serviceCategory: z.string().min(1, 'Service category is required'),
    specificService: z.string().min(1, 'Specific service is required'),
    researchLevel: z.string().min(1, 'Research level is required'),
    discipline: z.string().min(1, 'Field/Discipline is required'),
    description: z.string().min(10, 'Please provide a detailed description'),
    preferredDate: z.string().optional(),
    urgency: z.enum(['Normal', 'Urgent']),
    attachmentUrl: z.string().optional()
});

// Create a new research request
router.post('/request', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const validatedData = researchRequestSchema.parse(req.body);
        const user = req.user!;

        const request = await prisma.researchRequest.create({
            data: {
                userId: user.id,
                fullName: user.name || user.email, // Snapshot user details
                email: user.email,
                role: validatedData.role,
                institution: validatedData.institution,
                serviceCategory: validatedData.serviceCategory,
                specificService: validatedData.specificService,
                researchLevel: validatedData.researchLevel,
                discipline: validatedData.discipline,
                description: validatedData.description,
                preferredDate: validatedData.preferredDate ? new Date(validatedData.preferredDate) : undefined,
                urgency: validatedData.urgency,
                attachmentUrl: validatedData.attachmentUrl,
                status: 'PENDING'
            }
        });

        // Notify Admins
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
        if (admins.length > 0) {
            await prisma.notification.createMany({
                data: admins.map(admin => ({
                    userId: admin.id,
                    title: 'New Research Request',
                    message: `New research request from ${user.name || user.email}: ${validatedData.serviceCategory}`,
                    type: 'INFO'
                }))
            });
        }

        res.status(201).json({ message: 'Research request submitted successfully', request });
    } catch (error) {
        next(error);
    }
});

// Get user's research requests
router.get('/requests', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const requests = await prisma.researchRequest.findMany({
            where: { userId: req.user!.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error) {
        next(error);
    }
});

// --- ADMIN ENDPOINTS ---

// Admin: Get all research requests
router.get('/admin/requests', authenticate, async (req: AuthRequest, res, next) => {
    try {
        if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });

        const requests = await prisma.researchRequest.findMany({
            include: { user: { select: { id: true, name: true, email: true, username: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    } catch (error) {
        next(error);
    }
});

// Admin: Update research request status or add quote/delivery
router.patch('/admin/requests/:id', authenticate, async (req: AuthRequest, res, next) => {
    try {
        if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });

        const { id } = req.params;
        const { status, adminNotes, quoteAmount, deliveryUrl } = req.body;

        const request = await prisma.researchRequest.update({
            where: { id },
            data: {
                status,
                adminNotes,
                quoteAmount: quoteAmount ? parseFloat(quoteAmount) : undefined,
                deliveryUrl
            }
        });

        // Notify user of update
        await prisma.notification.create({
            data: {
                userId: request.userId,
                title: 'Research Request Update',
                message: `Your research request status has been updated to: ${status}`,
                type: 'INFO'
            }
        });

        res.json(request);
    } catch (error) {
        next(error);
    }
});

export default router;
