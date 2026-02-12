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

        // Initialize Paystack Transfer
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
        const reference = `WDR_APPR_${Date.now()}`;
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

        // Success - Update Transaction
        await prisma.transaction.update({
            where: { id },
            data: {
                status: 'SUCCESS',
                meta: {
                    ...meta,
                    paystackReference: reference,
                    transferCode: transferData.transfer_code,
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

        // Notify user
        await prisma.notification.create({
            data: {
                userId: transaction.userId,
                title: 'Withdrawal Approved',
                message: `Your withdrawal of ₦${transaction.amount.toLocaleString()} has been approved and sent to your bank.`,
                type: 'SUCCESS'
            }
        });

        res.json({ message: 'Withdrawal approved and funds transferred', transaction });
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
                data: { userLiability, paystackAvailable, difference, status }
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
            enableWithdrawalApproval: true
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
