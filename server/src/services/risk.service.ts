import { PrismaClient } from '@prisma/client';
import { sendCapitalAlert } from './email.service';

const prisma = new PrismaClient();

/**
 * Calculate total platform liability:
 *   wallet balances + active investment principal + pending withdrawal amounts
 */
export async function calculateTotalLiability(): Promise<number> {
    const [walletSum, lockedCapital, pendingWithdrawals] = await Promise.all([
        // All user wallet balances
        prisma.user.aggregate({ _sum: { balance: true } }),
        // Active investment principal (locked capital)
        prisma.investment.aggregate({
            _sum: { principal: true },
            where: { status: { in: ['ACTIVE', 'MATURED'] } }
        }),
        // Pending withdrawal amounts (already deducted from wallet but not yet sent)
        prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { type: 'WITHDRAWAL', status: 'PENDING' }
        })
    ]);

    return (
        (walletSum._sum.balance || 0) +
        (Number(lockedCapital._sum.principal) || 0) +
        (Number(pendingWithdrawals._sum.amount) || 0)
    );
}

export interface LiquidityCheckResult {
    allowed: boolean;
    coverage: number;
    threshold: number;
    liability: number;
    available: number;
}

/**
 * Central liquidity guard. Returns whether transfers should proceed.
 * 
 * Policy: fail-open if no snapshot exists yet.
 * When coverage < minLiquidityRatio → block + log + alert.
 */
export async function checkLiquidityGuard(
    triggeredBy: 'USER_WITHDRAWAL' | 'ADMIN_APPROVAL'
): Promise<LiquidityCheckResult> {
    // 1. Get latest Paystack snapshot
    const latestSnapshot = await prisma.paystackBalanceSnapshot.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    // Fail-open: no snapshot yet → allow transfers
    if (!latestSnapshot) {
        return { allowed: true, coverage: 0, threshold: 0, liability: 0, available: 0 };
    }

    // 2. Calculate full liability
    const liability = await calculateTotalLiability();

    // Zero liability → no risk
    if (liability === 0) {
        return { allowed: true, coverage: Infinity, threshold: 0, liability: 0, available: Number(latestSnapshot.available) };
    }

    // 3. Compute coverage
    const available = Number(latestSnapshot.available);
    const coverage = available / liability;

    // 4. Get threshold from settings
    const settings = await prisma.settings.findFirst();
    const threshold = settings?.minLiquidityRatio ? Number(settings.minLiquidityRatio) : 1.05;

    // 5. Decision
    const allowed = coverage >= threshold;

    // 6. Log every block
    if (!allowed) {
        await prisma.capitalProtectionLog.create({
            data: {
                coverage,
                threshold,
                liability,
                available,
                action: 'BLOCK_TRANSFER',
                triggeredBy
            }
        });

        // 7. Alert all admins via email + in-app notification
        try {
            const admins = await prisma.user.findMany({
                where: { role: 'ADMIN' },
                select: { id: true, email: true }
            });

            // Email alerts (fire-and-forget, don't block the guard)
            await Promise.allSettled(
                admins.map(admin =>
                    sendCapitalAlert(admin.email, coverage, threshold, liability, available)
                )
            );

            // In-app notifications
            if (admins.length > 0) {
                await prisma.notification.createMany({
                    data: admins.map(admin => ({
                        userId: admin.id,
                        title: '🔴 Capital Protection Triggered',
                        message: `Transfers blocked. Coverage: ${coverage.toFixed(2)}x (min: ${threshold}x). Liability: ₦${liability.toLocaleString()}, Available: ₦${available.toLocaleString()}`,
                        type: 'WARNING' as const
                    }))
                });
            }
        } catch (alertError) {
            // Alert failure should never block the guard decision
            console.error('[RiskService] Alert delivery failed:', alertError);
        }
    }

    return { allowed, coverage, threshold, liability, available };
}
