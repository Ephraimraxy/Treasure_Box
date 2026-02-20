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

        // Exclude items already approved/processing (still PENDING until webhook finalizes)
        const filtered = withdrawals.filter((w: any) => {
            const meta = w.meta as any;
            return !(meta?.approvedBy || meta?.transferCode || meta?.paystackReference);
        });

        res.json(filtered);
    } catch (error) {
        next(error);
    }
});

// Approve withdrawal
// Approve withdrawal
router.post('/withdrawals/:id/approve', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: {
                user: {
                    include: { bankDetails: true }
                }
            }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (transaction.status !== 'PENDING') {
            return res.status(400).json({ error: 'Transaction is not pending' });
        }

        // Prevent double-approval / double-transfer
        const existingMeta = transaction.meta as any;
        if (existingMeta?.approvedBy || existingMeta?.transferCode || existingMeta?.paystackReference) {
            return res.status(400).json({ error: 'Withdrawal is already approved / processing' });
        }

        // Initialize Paystack Transfer
        // ── Capital protection guard ──
        const { checkLiquidityGuard } = await import('../services/risk.service');
        const liquidityCheck = await checkLiquidityGuard('ADMIN_APPROVAL');
        if (!liquidityCheck.allowed) {
            return res.status(503).json({
                error: `Capital protection active. Coverage: ${liquidityCheck.coverage.toFixed(2)}x (threshold: ${liquidityCheck.threshold.toFixed(2)}x). Fund Paystack or run reconciliation.`,
                code: 'LIQUIDITY_PROTECTION'
            });
        }

        // 1. Get Bank Details (from meta or user's bank details)
        // Meta should have 'bankDetails' snapshot from creation time
        const meta = transaction.meta as any;
        let bankDetails = meta?.bankDetails;

        // Fallback to finding matching bank detail if meta missing (legacy)
        if (!bankDetails && transaction.user.bankDetails.length > 0) {
            // Unsafe assumption but better than failing?
            // Actually, we should check if we can reconstruct it.
            // For now, let's assume meta has it as per transaction.routes.ts logic
            bankDetails = {
                accountNumber: transaction.user.bankDetails[0].accountNumber,
                bankName: transaction.user.bankDetails[0].bankName,
                // We need bank code!
                bankCode: transaction.user.bankDetails[0].bankCode
            };
        }

        if (!bankDetails || !bankDetails.accountNumber || !bankDetails.bankName) {
            return res.status(400).json({ error: 'Missing bank details for transfer' });
        }

        // If bankCode is missing, we must resolve it or fail.
        // Paystack needs bank_code.
        // If the bank detail entry in DB has it, use it.
        // If meta doesn't have it, we are stuck unless we look it up.
        // We will try to find the full bank detail object from the user's list that matches the account number.
        const fullBankDetail = transaction.user.bankDetails.find(b => b.accountNumber === bankDetails.accountNumber);

        let bankCode = fullBankDetail?.bankCode || (bankDetails as any).bankCode;

        if (!bankCode) {
            // Try to assume it's missing and we can't process automated transfer.
            // Allow manual approval (mark success without transfer) if we can't transfer?
            // "make it transfer request" implies automation.
            return res.status(400).json({ error: 'Bank Code missing. Cannot process automated transfer. Reject and ask user to re-add bank.' });
        }

        // 2. Create Transfer Recipient
        const { createTransferRecipient, initiateTransfer } = await import('../services/paystack.service');

        let recipientCode;
        try {
            const recipient = await createTransferRecipient(
                bankDetails.accountName || transaction.user.name,
                bankDetails.accountNumber,
                bankCode
            );
            recipientCode = recipient.data.recipient_code;
        } catch (error: any) {
            console.error("Recipient Create Error", error.response?.data);
            return res.status(400).json({ error: 'Failed to create transfer recipient: ' + (error.response?.data?.message || error.message) });
        }

        // 3. Initiate Transfer
        const { generateReference } = await import('../services/paystack.service');
        const reference = generateReference('WDR_APPR');
        let transferData;

        try {
            const transfer = await initiateTransfer(
                transaction.amount,
                recipientCode,
                reference,
                'Withdrawal from Treasure Box (Approved)'
            );
            transferData = transfer.data;
        } catch (error: any) {
            console.error("Transfer Error", error.response?.data);
            return res.status(400).json({ error: 'Transfer failed: ' + (error.response?.data?.message || error.message) });
        }

        // Persist transfer initiation (final status confirmed via Paystack transfer webhook)
        await prisma.transaction.update({
            where: { id },
            data: {
                status: 'PENDING',
                meta: {
                    ...meta,
                    paystackReference: reference,
                    transferCode: transferData.transfer_code,
                    transferStatus: transferData.status,
                    transferResponse: transferData,
                    approvedBy: req.user!.email
                }
            }
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
                details: `Approved & Transferred withdrawal #${id} for ₦${transaction.amount}`
            }
        });

        // Notify user (processing)
        await prisma.notification.create({
            data: {
                userId: transaction.userId,
                title: 'Withdrawal Processing',
                message: `Your withdrawal of ₦${transaction.amount.toLocaleString()} is processing. You will be notified once completed.`,
                type: 'INFO'
            }
        });

        res.json({ message: 'Withdrawal approved and transfer initiated', transaction });
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

// ═══════════════════════════════════════════════
//  TRANSACTIONS EXPLORER (Admin Transparency)
// ═══════════════════════════════════════════════

router.get('/transactions', async (req: AuthRequest, res, next) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
        const skip = (page - 1) * limit;

        const status = (req.query.status as string) || 'all'; // PENDING|SUCCESS|FAILED|REJECTED|all
        const type = (req.query.type as string) || 'all'; // DEPOSIT|WITHDRAWAL|...|all
        const provider = (req.query.provider as string) || 'all'; // paystack|vtpass|system|dataverify|all
        const q = (req.query.q as string) || '';
        const start = req.query.start ? new Date(req.query.start as string) : null;
        const end = req.query.end ? new Date(req.query.end as string) : null;

        const where: any = {};

        // Status Filter
        if (status !== 'all') where.status = status;

        // Type & Provider Filter Logic
        let allowedTypes: string[] = [];
        if (provider !== 'all') {
            if (provider === 'paystack') allowedTypes = ['DEPOSIT', 'WITHDRAWAL'];
            else if (provider === 'vtpass') allowedTypes = ['UTILITY_BILL', 'AIRTIME_DEPOSIT'];
            else if (provider === 'system') allowedTypes = ['REFERRAL_BONUS', 'QUIZ_ENTRY', 'QUIZ_WINNING', 'INVESTMENT_PAYOUT', 'INVESTMENT_DEBIT'];
            else if (provider === 'dataverify') allowedTypes = ['VERIFICATION']; // Future proofing
        }

        if (type !== 'all') {
            // If specific type is requested
            if (provider !== 'all') {
                // If both provider and type are set, ensure type belongs to provider
                if (allowedTypes.includes(type)) {
                    where.type = type;
                } else {
                    // Conflict: Type doesn't belong to provider -> Return nothing
                    where.type = '___NONE___';
                }
            } else {
                where.type = type;
            }
        } else if (provider !== 'all') {
            // Only provider set, filter by allowed types
            where.type = { in: allowedTypes };
        }

        if (start || end) {
            where.createdAt = {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: new Date(new Date(end).setHours(23, 59, 59, 999)) } : {})
            };
        }

        const or: any[] = [];
        const trimmed = q.trim();
        if (trimmed) {
            // id / userId exact match (best signal)
            or.push({ id: trimmed });
            or.push({ userId: trimmed });

            // user search
            or.push({ user: { email: { contains: trimmed, mode: 'insensitive' } } });
            or.push({ user: { name: { contains: trimmed, mode: 'insensitive' } } });

            // description search
            or.push({ description: { contains: trimmed, mode: 'insensitive' } });

            // paystack refs stored in meta
            or.push({ meta: { path: ['reference'], equals: trimmed } });
            or.push({ meta: { path: ['paystackReference'], equals: trimmed } });
            or.push({ meta: { path: ['transferCode'], equals: trimmed } });

            // amount exact match if numeric
            const maybeAmount = Number(trimmed);
            if (!Number.isNaN(maybeAmount) && maybeAmount > 0) {
                or.push({ amount: maybeAmount });
            }

            where.OR = or;
        }

        const [data, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    user: { select: { id: true, email: true, name: true, username: true, balance: true } }
                }
            }),
            prisma.transaction.count({ where })
        ]);

        res.json({
            data,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/transactions/:id', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const tx = await prisma.transaction.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        username: true,
                        balance: true,
                        isSuspended: true,
                        suspensionReason: true
                    }
                }
            }
        });

        if (!tx) return res.status(404).json({ error: 'Transaction not found' });

        const meta: any = tx.meta || {};
        const timeline: { at: string; label: string; details?: string }[] = [];
        timeline.push({ at: tx.createdAt.toISOString(), label: 'Transaction created', details: `${tx.type} • ₦${tx.amount}` });
        if (meta.transferInitiatedAt) timeline.push({ at: meta.transferInitiatedAt, label: 'Transfer initiated', details: meta.paystackReference || meta.transferCode });
        if (meta.approvedAt) timeline.push({ at: meta.approvedAt, label: 'Admin approved', details: meta.approvedBy });
        if (meta.verifiedAt) timeline.push({ at: meta.verifiedAt, label: 'Paystack verified', details: meta.verificationSource });
        if (meta.transferFinalAt) timeline.push({ at: meta.transferFinalAt, label: 'Transfer finalized', details: meta.transferFinalEvent });
        if (meta.requery?.at) timeline.push({ at: meta.requery.at, label: 'Requery ran', details: `status=${meta.requery.status}` });
        if (meta.adminNoteAt) timeline.push({ at: meta.adminNoteAt, label: 'Admin note added', details: meta.adminNoteBy });
        if (meta.adminRefundedAt) timeline.push({ at: meta.adminRefundedAt, label: 'Admin refund', details: meta.adminRefundedBy });

        res.json({ transaction: tx, timeline });
    } catch (error) {
        next(error);
    }
});

router.post('/transactions/:id/note', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { note } = req.body;
        if (!note || String(note).trim().length < 2) return res.status(400).json({ error: 'Note is required' });

        const tx = await prisma.transaction.findUnique({ where: { id } });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });

        const updated = await prisma.transaction.update({
            where: { id },
            data: {
                meta: {
                    ...(tx.meta as any),
                    adminNote: String(note).trim(),
                    adminNoteBy: req.user!.email,
                    adminNoteAt: new Date().toISOString()
                }
            }
        });

        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'ADD_TRANSACTION_NOTE',
                details: `Added note to transaction ${id}`
            }
        });

        res.json({ message: 'Note saved', transaction: updated });
    } catch (error) {
        next(error);
    }
});

router.post('/transactions/:id/refund', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        if (!reason || String(reason).trim().length < 3) return res.status(400).json({ error: 'Reason is required' });

        const tx = await prisma.transaction.findUnique({ where: { id } });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });

        if (tx.type !== 'WITHDRAWAL') {
            return res.status(400).json({ error: 'Refund is only supported for withdrawals currently' });
        }

        const meta: any = tx.meta || {};
        if (meta.adminRefundedAt) return res.status(400).json({ error: 'Already refunded' });

        if (tx.status !== 'PENDING') {
            return res.status(400).json({ error: 'Only pending withdrawals can be refunded safely' });
        }

        await prisma.$transaction([
            prisma.transaction.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    rejectionReason: String(reason).trim(),
                    meta: {
                        ...(tx.meta as any),
                        adminRefundReason: String(reason).trim(),
                        adminRefundedBy: req.user!.email,
                        adminRefundedAt: new Date().toISOString()
                    }
                }
            }),
            prisma.user.update({
                where: { id: tx.userId },
                data: { balance: { increment: tx.amount } }
            }),
            prisma.notification.create({
                data: {
                    userId: tx.userId,
                    title: 'Withdrawal Refunded',
                    message: `Your withdrawal of ₦${tx.amount.toLocaleString()} was refunded. Reason: ${String(reason).trim()}`,
                    type: 'INFO'
                }
            })
        ]);

        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'MANUAL_REFUND',
                details: `Refunded withdrawal ${id}. Reason: ${String(reason).trim()}`
            }
        });

        res.json({ message: 'Refund completed' });
    } catch (error) {
        next(error);
    }
});

router.post('/transactions/:id/force-fail', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        if (!reason || String(reason).trim().length < 3) return res.status(400).json({ error: 'Reason is required' });

        const tx = await prisma.transaction.findUnique({ where: { id } });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });
        if (tx.status !== 'PENDING') return res.status(400).json({ error: 'Only pending transactions can be force-failed' });

        if (tx.type === 'WITHDRAWAL') {
            await prisma.$transaction([
                prisma.transaction.update({
                    where: { id },
                    data: {
                        status: 'FAILED',
                        meta: { ...(tx.meta as any), forcedBy: req.user!.email, forcedAt: new Date().toISOString(), forceReason: String(reason).trim(), forceAction: 'FAIL' }
                    }
                }),
                prisma.user.update({
                    where: { id: tx.userId },
                    data: { balance: { increment: tx.amount } }
                }),
                prisma.notification.create({
                    data: {
                        userId: tx.userId,
                        title: 'Withdrawal Failed',
                        message: `Your withdrawal of ₦${tx.amount.toLocaleString()} was marked failed and refunded. Reason: ${String(reason).trim()}`,
                        type: 'ERROR'
                    }
                })
            ]);
        } else {
            await prisma.transaction.update({
                where: { id },
                data: {
                    status: 'FAILED',
                    meta: { ...(tx.meta as any), forcedBy: req.user!.email, forcedAt: new Date().toISOString(), forceReason: String(reason).trim(), forceAction: 'FAIL' }
                }
            });
        }

        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'FORCE_FAIL_TRANSACTION',
                details: `Force failed ${id}. Reason: ${String(reason).trim()}`
            }
        });

        res.json({ message: 'Transaction marked failed' });
    } catch (error) {
        next(error);
    }
});

router.post('/transactions/:id/force-success', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        if (!reason || String(reason).trim().length < 3) return res.status(400).json({ error: 'Reason is required' });

        const tx = await prisma.transaction.findUnique({ where: { id } });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });
        if (tx.status !== 'PENDING') return res.status(400).json({ error: 'Only pending transactions can be force-marked success' });

        // Safety: only allow force success for deposits (credits wallet) with explicit reason
        if (tx.type !== 'DEPOSIT') {
            return res.status(400).json({ error: 'Force success is only allowed for deposits' });
        }

        await prisma.$transaction([
            prisma.transaction.update({
                where: { id },
                data: {
                    status: 'SUCCESS',
                    meta: { ...(tx.meta as any), forcedBy: req.user!.email, forcedAt: new Date().toISOString(), forceReason: String(reason).trim(), forceAction: 'SUCCESS' }
                }
            }),
            prisma.user.update({
                where: { id: tx.userId },
                data: { balance: { increment: tx.amount } }
            }),
            prisma.notification.create({
                data: {
                    userId: tx.userId,
                    title: 'Deposit Successful',
                    message: `Your deposit of ₦${tx.amount.toLocaleString()} was marked successful. Reason: ${String(reason).trim()}`,
                    type: 'SUCCESS'
                }
            })
        ]);

        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'FORCE_SUCCESS_TRANSACTION',
                details: `Force success ${id}. Reason: ${String(reason).trim()}`
            }
        });

        res.json({ message: 'Transaction marked success' });
    } catch (error) {
        next(error);
    }
});

router.post('/transactions/:id/requery', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const tx = await prisma.transaction.findUnique({ where: { id } });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });

        if (tx.status !== 'PENDING') {
            return res.json({ message: 'No requery needed (not pending)', status: tx.status });
        }

        const { requeryPendingPaystackTransactions } = await import('../jobs/reconciliation.job');
        await requeryPendingPaystackTransactions();

        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'REQUERY_TRANSACTION',
                details: `Triggered requery job for transaction ${id}`
            }
        });

        const refreshed = await prisma.transaction.findUnique({ where: { id } });
        res.json({ message: 'Requery executed', transaction: refreshed });
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

// ═══════════════════════════════════════════════
//  FINANCIAL CONTROL CENTER — Dashboard Stats
// ═══════════════════════════════════════════════

router.get('/stats', async (req: AuthRequest, res, next) => {
    try {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            totalBalanceAgg,
            activeInvestmentCount,
            pendingWithdrawals,
            quizFeeAgg,
            systemWinAgg,
            pendingQuizPoolAgg,
            activeQuizGames,
            totalCompletedGames,
            // Investment profit: matured/payout-processed investments
            investmentProfitAgg,
            // Locked capital (active investments)
            lockedCapitalAgg,
            // Risk: largest wallet
            largestWalletUser,
            // Risk: upcoming maturities (next 7 days)
            upcomingMaturities,
            upcomingMaturitySum,
            // Paystack balance from DB snapshot (NOT live)
            latestSnapshot,
            // System health
            systemHealth,
            // Time-based profit: today
            profitToday,
            // Time-based profit: this week
            profitWeek,
            // Time-based profit: this month
            profitMonth,
            // Activity feed: last 20 transactions
            activityFeed
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.aggregate({ _sum: { balance: true } }),
            prisma.investment.count({ where: { status: 'ACTIVE' } }),
            prisma.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
            // Quiz platform fees
            prisma.quizGame.aggregate({ _sum: { platformFee: true }, where: { status: 'COMPLETED' } }),
            // System wins: SOLO games where nobody won
            prisma.quizGame.aggregate({
                _sum: { prizePool: true },
                where: { mode: 'SOLO', status: 'COMPLETED', participants: { none: { isWinner: true } } }
            }),
            // Pending quiz pool
            prisma.quizGame.aggregate({ _sum: { entryAmount: true }, where: { status: 'WAITING' } }),
            // Active quiz games
            prisma.quizGame.count({ where: { status: { in: ['WAITING', 'IN_PROGRESS'] } } }),
            // Completed games
            prisma.quizGame.count({ where: { status: 'COMPLETED' } }),
            // Investment profit: SUM(principal * ((baseRate+bonusRate)/100) * (durationDays/365)) for matured
            prisma.investment.findMany({
                where: { status: { in: ['MATURED', 'PAYOUT_PROCESSED'] } },
                select: { principal: true, baseRate: true, bonusRate: true, durationDays: true }
            }),
            // Locked capital
            prisma.investment.aggregate({ _sum: { principal: true }, where: { status: 'ACTIVE' } }),
            // Largest wallet (whale detection)
            prisma.user.findFirst({
                orderBy: { balance: 'desc' },
                select: { id: true, email: true, username: true, name: true, balance: true }
            }),
            // Upcoming maturities count
            prisma.investment.count({
                where: { status: 'ACTIVE', maturityDate: { gte: now, lte: sevenDaysFromNow } }
            }),
            // Upcoming maturities sum
            prisma.investment.aggregate({
                _sum: { principal: true },
                where: { status: 'ACTIVE', maturityDate: { gte: now, lte: sevenDaysFromNow } }
            }),
            // Latest Paystack snapshot from DB
            prisma.paystackBalanceSnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
            // System health
            prisma.systemHealth.findUnique({ where: { id: 1 } }),
            // Time-based: today's platform fees
            prisma.quizGame.aggregate({
                _sum: { platformFee: true },
                where: { status: 'COMPLETED', endedAt: { gte: startOfDay } }
            }),
            // Time-based: this week's platform fees
            prisma.quizGame.aggregate({
                _sum: { platformFee: true },
                where: { status: 'COMPLETED', endedAt: { gte: startOfWeek } }
            }),
            // Time-based: this month's platform fees
            prisma.quizGame.aggregate({
                _sum: { platformFee: true },
                where: { status: 'COMPLETED', endedAt: { gte: startOfMonth } }
            }),
            // Activity feed: last 20 transactions
            prisma.transaction.findMany({
                take: 20,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { email: true, username: true, name: true } } }
            })
        ]);

        // ── Compute derived metrics ──
        const quizFees = quizFeeAgg._sum.platformFee || 0;
        const systemWins = systemWinAgg._sum.prizePool || 0;

        // Investment profit: deterministic formula
        const investmentProfit = investmentProfitAgg.reduce((sum: number, inv: { principal: number; baseRate: number; bonusRate: number; durationDays: number }) => {
            return sum + inv.principal * ((inv.baseRate + inv.bonusRate) / 100) * (inv.durationDays / 365);
        }, 0);

        const totalPlatformProfit = quizFees + systemWins + investmentProfit;
        const totalUserLiability = totalBalanceAgg._sum.balance || 0;

        // Paystack balance from snapshot
        const paystackAvailable = latestSnapshot ? Number(latestSnapshot.available) : null;
        const paystackPending = latestSnapshot ? Number(latestSnapshot.pending) : null;
        const snapshotAge = latestSnapshot ? latestSnapshot.createdAt : null;

        // Liquidity ratio (with zero-guard)
        let liquidityRatio: number | null = null;
        let netPlatformEquity: number | null = null;
        if (paystackAvailable !== null) {
            liquidityRatio = totalUserLiability === 0 ? null : paystackAvailable / totalUserLiability;
            netPlatformEquity = paystackAvailable - totalUserLiability;
        }

        // Normalize activity feed
        const normalizedFeed = activityFeed.map((t: any) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            status: t.status,
            description: t.description,
            user: t.user.username || t.user.name || t.user.email,
            timestamp: t.createdAt
        }));

        res.json({
            // Core stats
            totalUsers,
            totalBalance: totalUserLiability,
            activeInvestments: activeInvestmentCount,
            pendingWithdrawals,

            // Platform profit
            platformProfit: {
                total: totalPlatformProfit,
                breakdown: { quizFees, systemWins, investmentProfit }
            },

            // Quiz stats
            quizStats: {
                pendingPool: pendingQuizPoolAgg._sum.entryAmount || 0,
                activeGames: activeQuizGames,
                completedGames: totalCompletedGames
            },

            // ── Financial Control Center ──
            financials: {
                paystackAvailable,
                paystackPending,
                snapshotAge,
                liquidityRatio,
                netPlatformEquity,
                totalUserLiability
            },

            // Risk metrics
            risk: {
                largestWallet: largestWalletUser ? {
                    email: largestWalletUser.email,
                    username: largestWalletUser.username,
                    name: largestWalletUser.name,
                    balance: largestWalletUser.balance
                } : null,
                lockedCapital: lockedCapitalAgg._sum.principal || 0,
                upcomingMaturities: {
                    count: upcomingMaturities,
                    totalAmount: upcomingMaturitySum._sum.principal || 0
                }
            },

            // Time-based profits
            profitTimeline: {
                today: profitToday._sum.platformFee || 0,
                thisWeek: profitWeek._sum.platformFee || 0,
                thisMonth: profitMonth._sum.platformFee || 0,
                lifetime: totalPlatformProfit
            },

            // Activity feed
            activityFeed: normalizedFeed,

            // System health
            systemHealth: systemHealth ? {
                lastWebhookAt: systemHealth.lastWebhookAt,
                lastSuccessfulTransferAt: systemHealth.lastSuccessfulTransferAt,
                lastFailedTransferAt: systemHealth.lastFailedTransferAt,
                failedTransferCount24h: systemHealth.failedTransferCount24h
            } : null
        });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  RECONCILIATION — Snapshot & Health Check
// ═══════════════════════════════════════════════

router.post('/reconciliation/snapshot', async (req: AuthRequest, res, next) => {
    try {
        const { getBalance } = await import('../services/paystack.service');

        // 1. Fetch live Paystack balance
        let paystackData;
        try {
            paystackData = await getBalance();
        } catch (err: any) {
            return res.status(502).json({
                error: 'Failed to fetch Paystack balance',
                details: err.response?.data?.message || err.message
            });
        }

        // Paystack returns balance in kobo, convert to Naira
        const ngnBalance = paystackData.find((b: any) => b.currency === 'NGN');
        const paystackAvailable = ngnBalance ? ngnBalance.balance / 100 : 0;
        const paystackPending = ngnBalance ? (ngnBalance.pending || 0) / 100 : 0;

        // 2. Get user liability
        const totalBalanceAgg = await prisma.user.aggregate({ _sum: { balance: true } });
        const userLiability = totalBalanceAgg._sum.balance || 0;

        // 3. Compute difference and severity
        const difference = paystackAvailable - userLiability;
        const ratio = userLiability === 0 ? null : Math.abs(difference) / userLiability;

        let status = 'OK';
        if (ratio !== null) {
            if (ratio > 0.02) status = 'CRITICAL';
            else if (ratio > 0.005) status = 'WARNING';
        }
        // Also CRITICAL if available < liability
        if (paystackAvailable < userLiability) {
            status = 'CRITICAL';
        }

        // 4. Store snapshot + reconciliation log
        const [snapshot, reconciliation] = await Promise.all([
            prisma.paystackBalanceSnapshot.create({
                data: { available: paystackAvailable, pending: paystackPending }
            }),
            prisma.reconciliationLog.create({
                data: {
                    userLiability,
                    paystackAvailable,
                    difference,
                    coverageRatio: userLiability === 0 ? 9999 : paystackAvailable / userLiability,
                    status
                }
            })
        ]);

        // 5. Audit log
        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'RECONCILIATION_SNAPSHOT',
                details: `Snapshot: Paystack ₦${paystackAvailable.toLocaleString()}, Liability ₦${userLiability.toLocaleString()}, Diff ₦${difference.toLocaleString()}, Status: ${status}`
            }
        });

        res.json({
            snapshot,
            reconciliation,
            summary: {
                paystackAvailable,
                paystackPending,
                userLiability,
                difference,
                status,
                liquidityRatio: userLiability === 0 ? null : paystackAvailable / userLiability
            }
        });
    } catch (error) {
        next(error);
    }
});

// Requery pending Paystack transactions (Admin Only) - manual trigger
router.post('/reconciliation/requery-pending', async (req: AuthRequest, res, next) => {
    try {
        const { requeryPendingPaystackTransactions } = await import('../jobs/reconciliation.job');
        await requeryPendingPaystackTransactions();

        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'REQUERY_PENDING_TRANSACTIONS',
                details: 'Manually triggered pending transaction requery job'
            }
        });

        res.json({ message: 'Pending transaction requery completed' });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  QUIZ ADMIN ENDPOINTS
// ═══════════════════════════════════════════════

// Get all quiz games (admin view)
router.get('/quiz/games', async (req: AuthRequest, res, next) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const status = req.query.status as string;
        const mode = req.query.mode as string;

        const where: any = {};
        if (status) where.status = status;
        if (mode) where.mode = mode;

        const [games, total] = await Promise.all([
            prisma.quizGame.findMany({
                where,
                include: {
                    participants: {
                        include: {
                            user: { select: { id: true, email: true, username: true, name: true } }
                        },
                        orderBy: { createdAt: 'asc' }
                    },
                    level: {
                        include: { module: { include: { course: true } } }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip
            }),
            prisma.quizGame.count({ where })
        ]);

        res.json({
            data: games.map(g => ({
                id: g.id,
                mode: g.mode,
                matchCode: g.matchCode,
                status: g.status,
                entryAmount: g.entryAmount,
                platformFee: g.platformFee,
                prizePool: g.prizePool,
                maxPlayers: g.maxPlayers,
                currentPlayers: g.participants.length,
                creator: g.participants[0] ? {
                    username: g.participants[0].user.username || g.participants[0].user.name,
                    email: g.participants[0].user.email
                } : null,
                participants: g.participants.map(p => ({
                    username: p.user.username || p.user.name,
                    email: p.user.email,
                    score: p.score,
                    isWinner: p.isWinner,
                    payout: p.payout,
                    completed: !!p.completedAt
                })),
                course: g.level.module.course.name,
                module: g.level.module.name,
                level: g.level.name,
                expiresAt: g.expiresAt,
                createdAt: g.createdAt,
                endedAt: g.endedAt
            })),
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        next(error);
    }
});

// Get full quiz transaction history (admin view)
router.get('/quiz/history', async (req: AuthRequest, res, next) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 30;
        const skip = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where: { type: { in: ['QUIZ_ENTRY', 'QUIZ_WINNING'] } },
                include: {
                    user: { select: { email: true, username: true, name: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip
            }),
            prisma.transaction.count({ where: { type: { in: ['QUIZ_ENTRY', 'QUIZ_WINNING'] } } })
        ]);

        res.json({
            data: transactions.map(t => ({
                id: t.id,
                type: t.type,
                amount: t.amount,
                status: t.status,
                description: t.description,
                userName: t.user.username || t.user.name,
                userEmail: t.user.email,
                createdAt: t.createdAt
            })),
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
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
            isSystemPaused: false,
            enableWithdrawalApproval: true,
            showUserQuizNav: true,
            showUserBoxNav: true,
            enableUserAdsPopup: true,
            enableAirtimeToCash: true,
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

// ═══════════════════════════════════════════════
//  RECONCILIATION SNAPSHOT (Rate-limited, live Paystack call)
// ═══════════════════════════════════════════════
router.post('/reconciliation/snapshot', async (req: AuthRequest, res, next) => {
    try {
        // ── Rate limiter: 1 snapshot per 2 minutes ──
        const lastSnapshot = await prisma.paystackBalanceSnapshot.findFirst({
            orderBy: { createdAt: 'desc' }
        });

        if (lastSnapshot) {
            const timeSince = Date.now() - new Date(lastSnapshot.createdAt).getTime();
            if (timeSince < 2 * 60 * 1000) {
                const waitSeconds = Math.ceil((2 * 60 * 1000 - timeSince) / 1000);
                return res.status(429).json({
                    error: `Rate limited. Please wait ${waitSeconds}s before next snapshot.`,
                    lastSnapshot
                });
            }
        }

        // ── Fetch live Paystack balance ──
        const { getBalance } = await import('../services/paystack.service');
        const balanceData = await getBalance();

        if (!balanceData) {
            return res.status(502).json({ error: 'Failed to fetch Paystack balance. Check PAYSTACK_SECRET_KEY.' });
        }

        // Paystack returns amounts in kobo (1/100 of Naira)
        const available = balanceData.available / 100;
        const pending = balanceData.pending / 100;

        // ── Store snapshot ──
        const snapshot = await prisma.paystackBalanceSnapshot.create({
            data: { available, pending }
        });

        // ── Calculate liability and coverage ──
        const { calculateTotalLiability } = await import('../services/risk.service');
        const userLiability = await calculateTotalLiability();
        const coverage = userLiability > 0 ? available / userLiability : Infinity;

        // ── Determine severity ──
        let status = 'OK';
        if (userLiability > 0) {
            const diffRatio = Math.abs(available - userLiability) / userLiability;
            if (diffRatio > 0.02 || available < userLiability) {
                status = 'CRITICAL';
            } else if (diffRatio > 0.005) {
                status = 'WARNING';
            }
        }

        // ── Store reconciliation log ──
        const reconciliation = await prisma.reconciliationLog.create({
            data: {
                paystackAvailable: available,
                userLiability,
                difference: available - userLiability,
                coverageRatio: coverage === Infinity ? 9999 : coverage,
                status
            }
        });

        // ── Update system health ──
        await prisma.systemHealth.upsert({
            where: { id: 1 },
            update: { lastReconciliation: new Date() },
            create: { id: 1, lastReconciliation: new Date() }
        });

        // ── Audit log ──
        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'RECONCILIATION_SNAPSHOT',
                details: `Coverage: ${coverage === Infinity ? '∞' : coverage.toFixed(4)}x | Status: ${status} | Available: ₦${available.toLocaleString()} | Liability: ₦${userLiability.toLocaleString()}`
            }
        });

        res.json({
            snapshot,
            reconciliation,
            summary: {
                available,
                pending,
                userLiability,
                coverage: coverage === Infinity ? null : Number(coverage.toFixed(4)),
                status
            }
        });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  CAPITAL PROTECTION STATUS
// ═══════════════════════════════════════════════
router.get('/protection-status', async (req: AuthRequest, res, next) => {
    try {
        const latestSnapshot = await prisma.paystackBalanceSnapshot.findFirst({
            orderBy: { createdAt: 'desc' }
        });

        if (!latestSnapshot) {
            return res.json({ active: false, reason: 'No snapshot yet (fail-open)', coverage: null, threshold: null });
        }

        const { calculateTotalLiability } = await import('../services/risk.service');
        const liability = await calculateTotalLiability();

        if (liability === 0) {
            return res.json({ active: false, reason: 'Zero liability', coverage: Infinity, threshold: null });
        }

        const available = Number(latestSnapshot.available);
        const coverage = available / liability;
        const settings = await prisma.settings.findFirst();
        const threshold = settings?.minLiquidityRatio ? Number(settings.minLiquidityRatio) : 1.05;
        const active = coverage < threshold;

        // Recent blocks
        const recentBlocks = await prisma.capitalProtectionLog.count({
            where: {
                action: 'BLOCK_TRANSFER',
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
        });

        res.json({ active, coverage: Number(coverage.toFixed(4)), threshold, liability, available, recentBlocks });
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  PAYSTACK OPERATIONS (WITHDRAW & FUND)
// ═══════════════════════════════════════════════

// Withdraw from Paystack Balance (Admin Only)
router.post('/paystack/withdraw', async (req: AuthRequest, res, next) => {
    try {
        const { amount, bankCode, accountNumber, accountName, description, withdrawalType, pin } = req.body;

        if (!amount || !bankCode || !accountNumber || !accountName || !pin) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify admin user and PIN
        const admin = await prisma.user.findUnique({ where: { id: req.user!.id } });
        if (!admin || admin.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (!admin.transactionPin) {
            return res.status(400).json({ error: 'Transaction PIN not set. Please set a PIN first.' });
        }

        const bcrypt = await import('bcryptjs');
        const isPinValid = await bcrypt.compare(pin, admin.transactionPin);
        if (!isPinValid) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        // Validate amount based on withdrawal type
        const withdrawalTypeValue = withdrawalType || 'WHOLE'; // Default to WHOLE for backward compatibility

        if (withdrawalTypeValue === 'PROFIT') {
            // Calculate platform profit
            const [quizFeeAgg, systemWinAgg, investmentProfitAgg] = await Promise.all([
                prisma.quizGame.aggregate({ _sum: { platformFee: true } }),
                prisma.quizGame.aggregate({
                    _sum: { prizePool: true },
                    where: { status: 'COMPLETED', mode: 'SOLO' }
                }),
                prisma.investment.findMany({
                    where: { status: 'MATURED' },
                    select: { principal: true, baseRate: true, bonusRate: true, durationDays: true }
                })
            ]);

            const quizFees = quizFeeAgg._sum.platformFee || 0;
            const systemWins = systemWinAgg._sum.prizePool || 0;
            const investmentProfit = investmentProfitAgg.reduce((sum: number, inv: any) => {
                return sum + inv.principal * ((inv.baseRate + inv.bonusRate) / 100) * (inv.durationDays / 365);
            }, 0);
            const totalPlatformProfit = quizFees + systemWins + investmentProfit;

            if (amount > totalPlatformProfit) {
                return res.status(400).json({
                    error: `Insufficient platform profit. Available: ₦${totalPlatformProfit.toLocaleString()}`
                });
            }
        } else {
            // For WHOLE type, check Paystack balance from latest snapshot
            const latestSnapshot = await prisma.paystackBalanceSnapshot.findFirst({
                orderBy: { createdAt: 'desc' }
            });
            const paystackAvailable = latestSnapshot ? Number(latestSnapshot.available) : 0;

            if (amount > paystackAvailable) {
                return res.status(400).json({
                    error: `Insufficient Paystack balance. Available: ₦${paystackAvailable.toLocaleString()}`
                });
            }
        }

        // ── Capital protection guard ──
        const { checkLiquidityGuard } = await import('../services/risk.service');
        const liquidityCheck = await checkLiquidityGuard('ADMIN_APPROVAL');
        if (!liquidityCheck.allowed) {
            return res.status(503).json({
                error: `Capital protection active. Coverage: ${liquidityCheck.coverage.toFixed(2)}x (threshold: ${liquidityCheck.threshold.toFixed(2)}x). Fund Paystack or run reconciliation.`,
                code: 'LIQUIDITY_PROTECTION'
            });
        }

        // 1. Create Transfer Recipient
        const { createTransferRecipient, initiateTransfer } = await import('../services/paystack.service');

        // Create unique ref or reuse if recipient exists (Paystack handles dupes gracefully typically, but good to just create)
        const recipientResponse = await createTransferRecipient(accountName, accountNumber, bankCode);
        const recipientCode = recipientResponse.data.recipient_code;

        // 2. Initiate Transfer
        const reference = `ADM_WDR_${withdrawalTypeValue}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const transferResponse = await initiateTransfer(amount, recipientCode, reference, description || `Admin ${withdrawalTypeValue === 'PROFIT' ? 'Profit' : 'Balance'} Withdrawal`);

        // 3. Log Audit
        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'ADMIN_PAYSTACK_WITHDRAWAL',
                details: `Withdrew ₦${amount} (${withdrawalTypeValue === 'PROFIT' ? 'Platform Profit' : 'Whole Balance'}) to ${accountNumber} (${recipientResponse.data.details.bank_name}). Ref: ${reference}`
            }
        });

        res.json({ message: 'Withdrawal initiated successfully', data: transferResponse.data });

    } catch (error: any) {
        console.error("Admin Paystack Withdrawal Error", error);
        res.status(500).json({ error: error.response?.data?.message || error.message || 'Failed to process withdrawal' });
    }
});

// Fund Paystack Balance (Admin Only) -> Returns Payment Link
router.post('/paystack/fund', async (req: AuthRequest, res, next) => {
    try {
        const { amount } = req.body;
        if (!amount || amount < 100) {
            return res.status(400).json({ error: 'Invalid amount (min 100)' });
        }

        const { initializeTransaction } = await import('../services/paystack.service');

        const reference = `ADM_FUND_${Date.now()}`;
        // Use admin email for the transaction
        const email = req.user!.email;

        // Initialize transaction
        const response = await initializeTransaction(email, amount, reference, {
            type: 'ADMIN_FUNDING',
            adminId: req.user!.id
        });

        res.json({ authorization_url: response.data.authorization_url, reference });

    } catch (error: any) {
        console.error("Admin Paystack Funding Error", error);
        res.status(500).json({ error: 'Failed to initialize funding' });
    }
});
router.get('/statement', async (req: AuthRequest, res, next) => {
    try {
        const startDate = req.query.start ? new Date(req.query.start as string) : new Date(new Date().setDate(1)); // default: 1st of current month
        const endDate = req.query.end ? new Date(req.query.end as string) : new Date();
        endDate.setHours(23, 59, 59, 999);

        // ── Gather all financial data for the period ──
        const [
            transactions,
            investments,
            reconciliationLogs,
            protectionLogs,
            userCount,
            totalUserBalance,
            latestSnapshot
        ] = await Promise.all([
            prisma.transaction.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                include: { user: { select: { email: true, username: true, name: true } } },
                orderBy: { createdAt: 'asc' }
            }),
            prisma.investment.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                include: { user: { select: { email: true, username: true, name: true } } },
                orderBy: { createdAt: 'asc' }
            }),
            prisma.reconciliationLog.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                orderBy: { createdAt: 'asc' }
            }),
            prisma.capitalProtectionLog.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                orderBy: { createdAt: 'asc' }
            }),
            prisma.user.count(),
            prisma.user.aggregate({ _sum: { balance: true } }),
            prisma.paystackBalanceSnapshot.findFirst({ orderBy: { createdAt: 'desc' } })
        ]);

        // ── Compute summary metrics ──
        const deposits = transactions.filter(t => t.type === 'DEPOSIT' && t.status === 'SUCCESS');
        const withdrawals = transactions.filter(t => t.type === 'WITHDRAWAL');
        const successfulWithdrawals = withdrawals.filter(t => t.status === 'SUCCESS');
        const pendingWithdrawals = withdrawals.filter(t => t.status === 'PENDING');
        const quizEntries = transactions.filter(t => t.type === 'QUIZ_ENTRY');
        const quizWinnings = transactions.filter(t => t.type === 'QUIZ_WINNING');
        const investmentPayouts = transactions.filter(t => t.type === 'INVESTMENT_PAYOUT' && t.status === 'SUCCESS');
        const referralBonuses = transactions.filter(t => t.type === 'REFERRAL_BONUS');

        const sum = (arr: { amount: number }[]) => arr.reduce((s: number, t: { amount: number }) => s + t.amount, 0);

        const totalLiability = (totalUserBalance._sum.balance || 0);
        const paystackAvailable = latestSnapshot ? Number(latestSnapshot.available) : 0;

        // ── Build CSV ──
        const lines: string[] = [];

        // Header section
        lines.push('TREASURE BOX — FINANCIAL STATEMENT');
        lines.push(`Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        lines.push(`Generated: ${new Date().toISOString()}`);
        lines.push(`Generated By: ${req.user!.email}`);
        lines.push('');

        // Summary section
        lines.push('═══════════════════════════════════════════');
        lines.push('EXECUTIVE SUMMARY');
        lines.push('═══════════════════════════════════════════');
        lines.push(`Total Users,${userCount}`);
        lines.push(`Total User Liability (Wallet Balances),₦${totalLiability.toLocaleString()}`);
        lines.push(`Paystack Available Balance,₦${paystackAvailable.toLocaleString()}`);
        lines.push(`Coverage Ratio,${totalLiability > 0 ? (paystackAvailable / totalLiability).toFixed(4) + 'x' : 'N/A'}`);
        lines.push('');

        // Inflow / Outflow
        lines.push('═══════════════════════════════════════════');
        lines.push('INFLOW / OUTFLOW');
        lines.push('═══════════════════════════════════════════');
        lines.push(`Total Deposits (${deposits.length} txns),₦${sum(deposits).toLocaleString()}`);
        lines.push(`Total Successful Withdrawals (${successfulWithdrawals.length} txns),₦${sum(successfulWithdrawals).toLocaleString()}`);
        lines.push(`Pending Withdrawals (${pendingWithdrawals.length} txns),₦${sum(pendingWithdrawals).toLocaleString()}`);
        lines.push(`Net Cash Flow,₦${(sum(deposits) - sum(successfulWithdrawals)).toLocaleString()}`);
        lines.push('');

        // Investment section
        lines.push('═══════════════════════════════════════════');
        lines.push('INVESTMENTS');
        lines.push('═══════════════════════════════════════════');
        lines.push(`New Investments Created,${investments.length}`);
        lines.push(`Total Capital Invested,₦${investments.reduce((s: number, i: { principal: any }) => s + Number(i.principal), 0).toLocaleString()}`);
        lines.push(`Investment Payouts (${investmentPayouts.length} txns),₦${sum(investmentPayouts).toLocaleString()}`);
        lines.push('');

        // Quiz Economy
        lines.push('═══════════════════════════════════════════');
        lines.push('QUIZ ECONOMY');
        lines.push('═══════════════════════════════════════════');
        lines.push(`Quiz Entries (${quizEntries.length} txns),₦${sum(quizEntries).toLocaleString()}`);
        lines.push(`Quiz Winnings (${quizWinnings.length} txns),₦${sum(quizWinnings).toLocaleString()}`);
        lines.push(`Quiz Platform Revenue,₦${(sum(quizEntries) - sum(quizWinnings)).toLocaleString()}`);
        lines.push('');

        // Referrals
        lines.push(`Referral Bonuses Paid (${referralBonuses.length} txns),₦${sum(referralBonuses).toLocaleString()}`);
        lines.push('');

        // Risk Events
        if (reconciliationLogs.length > 0 || protectionLogs.length > 0) {
            lines.push('═══════════════════════════════════════════');
            lines.push('RISK EVENTS');
            lines.push('═══════════════════════════════════════════');
            lines.push(`Reconciliation Checks,${reconciliationLogs.length}`);
            const criticals = reconciliationLogs.filter((r: { status: string }) => r.status === 'CRITICAL');
            const warnings = reconciliationLogs.filter((r: { status: string }) => r.status === 'WARNING');
            lines.push(`  OK,${reconciliationLogs.length - criticals.length - warnings.length}`);
            lines.push(`  WARNING,${warnings.length}`);
            lines.push(`  CRITICAL,${criticals.length}`);
            lines.push(`Capital Protection Blocks,${protectionLogs.filter((p: { action: string }) => p.action === 'BLOCK_TRANSFER').length}`);
            lines.push('');
        }

        // Transaction detail section
        lines.push('═══════════════════════════════════════════');
        lines.push('TRANSACTION LEDGER');
        lines.push('═══════════════════════════════════════════');
        lines.push('Date,Type,Amount (₦),Status,User,Description');

        for (const t of transactions) {
            const user = t.user.username || t.user.name || t.user.email;
            const desc = (t.description || '').replace(/,/g, ';');
            lines.push(`${t.createdAt.toISOString()},${t.type},${t.amount},${t.status},${user},${desc}`);
        }

        // ── Audit log ──
        await prisma.auditLog.create({
            data: {
                adminEmail: req.user!.email,
                action: 'EXPORT_STATEMENT',
                details: `Exported financial statement: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (${transactions.length} transactions)`
            }
        });

        // ── Return JSON if requested ──
        if (req.query.format === 'json') {
            return res.json({
                period: { start: startDate, end: endDate },
                summary: {
                    totalUsers: userCount,
                    totalLiability,
                    paystackAvailable,
                    coverageRatio: totalLiability > 0 ? paystackAvailable / totalLiability : null,
                    netCashFlow: sum(deposits) - sum(successfulWithdrawals),
                    platformRevenue: (sum(quizEntries) - sum(quizWinnings)) + (sum(investmentPayouts) * 0.1) // Est. inv profit
                },
                cashFlow: {
                    deposits: sum(deposits),
                    withdrawals: sum(successfulWithdrawals),
                    pendingWithdrawals: sum(pendingWithdrawals)
                },
                quizEconomy: {
                    revenue: sum(quizEntries),
                    payouts: sum(quizWinnings),
                    profit: sum(quizEntries) - sum(quizWinnings)
                },
                investments: {
                    newCount: investments.length,
                    totalCapital: investments.reduce((s: number, i: { principal: any }) => s + Number(i.principal), 0),
                    payouts: sum(investmentPayouts)
                },
                risk: {
                    reconciliations: reconciliationLogs.length,
                    criticalEvents: reconciliationLogs.filter((r: { status: string }) => r.status === 'CRITICAL').length,
                    protectionBlocks: protectionLogs.filter((p: { action: string }) => p.action === 'BLOCK_TRANSFER').length
                },
                transactions: transactions.map(t => ({
                    date: t.createdAt,
                    type: t.type,
                    amount: t.amount,
                    status: t.status,
                    user: t.user.username || t.user.name || t.user.email,
                    description: t.description
                }))
            });
        }

        // ── Send CSV ──
        const csv = lines.join('\r\n');
        const filename = `TreasureBox_Statement_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    } catch (error) {
        next(error);
    }
});

// ═══════════════════════════════════════════════
//  AGENT BALANCES — Paystack + VTPass Wallets
// ═══════════════════════════════════════════════

router.get('/agent-balances', async (req: AuthRequest, res, next) => {
    try {
        const paystack = { available: 0, pending: 0, currency: 'NGN' };
        const vtpass = { balance: 0 };

        // Fetch Paystack balance
        try {
            const { getBalance: getPaystackBalance } = await import('../services/paystack.service');
            const paystackData = await getPaystackBalance();
            if (paystackData && paystackData.length > 0) {
                // Paystack returns amounts in kobo (1/100 of NGN)
                paystack.available = (paystackData[0]?.balance || 0) / 100;
                paystack.pending = (paystackData[0]?.pending_balance || 0) / 100;
                paystack.currency = paystackData[0]?.currency || 'NGN';
            }
        } catch (err: any) {
            console.error('[Admin] Paystack balance error:', err.message);
        }

        // Fetch VTPass balance
        try {
            const { getBalance: getVTPassBalance, isVTPassConfigured } = await import('../services/vtpass.service');
            if (isVTPassConfigured()) {
                const vtpassData = await getVTPassBalance();
                vtpass.balance = vtpassData.balance || 0;
            }
        } catch (err: any) {
            console.error('[Admin] VTPass balance error:', err.message);
        }

        res.json({ paystack, vtpass });
    } catch (error) {
        next(error);
    }
});

export default router;
