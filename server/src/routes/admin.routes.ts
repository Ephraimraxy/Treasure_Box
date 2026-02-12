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
//  FINANCIAL STATEMENT EXPORT (CSV)
// ═══════════════════════════════════════════════
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

export default router;
