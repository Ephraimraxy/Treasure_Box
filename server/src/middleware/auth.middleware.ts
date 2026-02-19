import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Keep TEST_USER_ID in sync with auth.routes.ts
const TEST_USER_ID = 'test-user';
const envBool = (value: string | undefined | null, defaultValue = false) => {
    if (!value) return defaultValue;
    const v = value.toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
};
const isTestLoginEnabled = () =>
    envBool(process.env.ENABLE_TEST_LOGIN) &&
    !!process.env.TEST_USER_EMAIL &&
    !!process.env.TEST_USER_PASSWORD;
const getTestUserRole = () =>
    (process.env.TEST_USER_ROLE || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        name: string | null;
        role: string;
    };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;

        // Special handling for env-based test login user (no DB record required)
        if (isTestLoginEnabled() && decoded.userId === TEST_USER_ID) {
            req.user = {
                id: TEST_USER_ID,
                email: process.env.TEST_USER_EMAIL!,
                name: process.env.TEST_USER_NAME || 'Test User',
                role: getTestUserRole()
            };
            return next();
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
};
