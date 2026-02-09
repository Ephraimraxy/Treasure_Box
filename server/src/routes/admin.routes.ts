import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// Get all users
router.get('/users', async (req: AuthRequest, res, next) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                username: true,
                phone: true,
                balance: true,
                emailVerified: true,
                kycVerified: true,
                role: true,
                isSuspended: true,
                suspensionReason: true,
                createdAt: true,
                _count: {
                    select: { investments: true, transactions: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(users);
    } catch (error) {
        next(error);
    }
});

// Get pending withdrawals
router.get('/withdrawals/pending', async (req: AuthRequest, res, next) => {
    try {
        const withdrawals = await prisma.transaction.findMany({
            where: {
                type: { in: ['WITHDRAWAL', 'INVESTMENT_PAYOUT'] },
                status: 'PENDING'
            },
            include: {
                user: {
                    select: { email: true, name: true, bankDetails: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(withdrawals);
    } catch (error) {
        next(error);
    }
});

// Approve withdrawal
router.post('/withdrawals/:id/approve', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        const transaction = await prisma.transaction.update({
            where: { id },
            data: { status: 'SUCCESS' }
        });

        // If linked to an investment, mark as processed
        if (transaction.investmentId) {
            await prisma.investment.update({
                where: { id: transaction.investmentId },
                data: { status: 'PAYOUT_PROCESSED' }
            });
        }

        // Log audit
        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'APPROVE_WITHDRAWAL',
                details: `Approved withdrawal #${id} for ₦${transaction.amount}`
            }
        });

        // Notify user
        await prisma.notification.create({
            data: {
                userId: transaction.userId,
                title: 'Withdrawal Approved',
                message: `Your withdrawal of ₦${transaction.amount.toLocaleString()} has been approved.`,
                type: 'SUCCESS'
            }
        });

        res.json({ message: 'Withdrawal approved', transaction });
    } catch (error) {
        next(error);
    }
});

// Reject withdrawal
router.post('/withdrawals/:id/reject', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const transaction = await prisma.transaction.findUnique({ where: { id } });
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Refund balance
        await prisma.user.update({
            where: { id: transaction.userId },
            data: { balance: { increment: transaction.amount } }
        });

        await prisma.transaction.update({
            where: { id },
            data: { status: 'REJECTED', rejectionReason: reason }
        });

        // Log audit
        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'REJECT_WITHDRAWAL',
                details: `Rejected withdrawal #${id}. Reason: ${reason}`
            }
        });

        // Notify user
        await prisma.notification.create({
            data: {
                userId: transaction.userId,
                title: 'Withdrawal Rejected',
                message: `Your withdrawal was rejected. Reason: ${reason}. Funds have been refunded.`,
                type: 'ERROR'
            }
        });

        res.json({ message: 'Withdrawal rejected and refunded' });
    } catch (error) {
        next(error);
    }
});

// Credit user balance (admin deposit approval)
router.post('/users/:userId/credit', async (req: AuthRequest, res, next) => {
    try {
        const { userId } = req.params;
        const { amount, description } = req.body;

        await prisma.user.update({
            where: { id: userId },
            data: { balance: { increment: amount } }
        });

        await prisma.transaction.create({
            data: {
                userId,
                type: 'DEPOSIT',
                amount,
                status: 'SUCCESS',
                description: description || 'Admin credit'
            }
        });

        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'CREDIT_USER',
                details: `Credited ₦${amount} to user ${userId}`
            }
        });

        res.json({ message: 'User credited successfully' });
    } catch (error) {
        next(error);
    }
});

// Get audit logs
router.get('/audit-logs', async (req: AuthRequest, res, next) => {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.json(logs);
    } catch (error) {
        next(error);
    }
});

// Edit user details
router.put('/users/:id', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { name, email, phone, role } = req.body;

        const user = await prisma.user.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(email !== undefined && { email }),
                ...(phone !== undefined && { phone }),
                ...(role !== undefined && { role }),
            },
            select: { id: true, name: true, email: true, phone: true, role: true }
        });

        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'EDIT_USER',
                details: `Edited user ${user.email} (${id})`
            }
        });

        res.json({ message: 'User updated', user });
    } catch (error) {
        next(error);
    }
});

// Delete user
router.delete('/users/:id', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        const user = await prisma.user.findUnique({
            where: { id },
            select: { email: true, balance: true, role: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'ADMIN') {
            return res.status(403).json({ error: 'Cannot delete admin accounts' });
        }

        // Cascade delete handles all related records
        await prisma.user.delete({ where: { id } });

        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'DELETE_USER',
                details: `Deleted user ${user.email} (balance: ₦${user.balance.toLocaleString()})`
            }
        });

        res.json({ message: 'User deleted', deletedBalance: user.balance });
    } catch (error) {
        next(error);
    }
});

// Suspend / Unsuspend user
router.patch('/users/:id/suspend', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { suspend, reason } = req.body; // suspend: boolean

        const user = await prisma.user.findUnique({ where: { id }, select: { email: true, role: true } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'ADMIN') return res.status(403).json({ error: 'Cannot suspend admin accounts' });

        await prisma.user.update({
            where: { id },
            data: {
                isSuspended: suspend,
                suspensionReason: suspend ? (reason || 'Suspicious activity') : null
            }
        });

        // Notify the user
        await prisma.notification.create({
            data: {
                userId: id,
                title: suspend ? 'Account Suspended' : 'Account Restored',
                message: suspend
                    ? `Your account has been suspended. Reason: ${reason || 'Suspicious activity'}. You can submit an appeal.`
                    : 'Your account suspension has been lifted. You can now use all features.',
                type: suspend ? 'WARNING' : 'SUCCESS'
            }
        });

        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: suspend ? 'SUSPEND_USER' : 'UNSUSPEND_USER',
                details: `${suspend ? 'Suspended' : 'Unsuspended'} user ${user.email}. ${reason ? 'Reason: ' + reason : ''}`
            }
        });

        res.json({ message: suspend ? 'User suspended' : 'User unsuspended' });
    } catch (error) {
        next(error);
    }
});

// Dashboard stats
router.get('/stats', async (req: AuthRequest, res, next) => {
    try {
        const [
            totalUsers,
            totalBalance,
            activeInvestments,
            pendingWithdrawals
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.aggregate({ _sum: { balance: true } }),
            prisma.investment.count({ where: { status: 'ACTIVE' } }),
            prisma.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } })
        ]);

        res.json({
            totalUsers,
            totalBalance: totalBalance._sum.balance || 0,
            activeInvestments,
            pendingWithdrawals
        });
    } catch (error) {
        next(error);
    }
});

// Get System Settings
router.get('/settings', async (req: AuthRequest, res, next) => {
    try {
        const settings = await prisma.settings.findUnique({
            where: { id: 'global' }
        });

        // Return default if not exists
        res.json(settings || {
            minDeposit: 1000,
            minWithdrawal: 1000,
            minInvestment: 5000,
            isSystemPaused: false
        });
    } catch (error) {
        next(error);
    }
});

// Update System Settings
router.put('/settings', async (req: AuthRequest, res, next) => {
    try {
        const data = req.body;

        const settings = await prisma.settings.upsert({
            where: { id: 'global' },
            update: data,
            create: { id: 'global', ...data }
        });

        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'UPDATE_SETTINGS',
                details: `Updated system settings`
            }
        });

        res.json(settings);
    } catch (error) {
        next(error);
    }
});

export default router;
