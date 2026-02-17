import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let isRunning = false;

function minutesAgo(minutes: number) {
    return new Date(Date.now() - minutes * 60 * 1000);
}

/**
 * Requery pending Paystack-related transactions to recover from:
 * - webhook delays/failures
 * - server restarts
 * - network timeouts
 *
 * This is a safety net; webhook is still the primary source of truth.
 */
export async function requeryPendingPaystackTransactions() {
    if (isRunning) return;
    isRunning = true;

    try {
        const { getTransfers, verifyTransaction } = await import('../services/paystack.service');

        // ─────────────────────────────────────────────
        // 1) Pending withdrawals (transfers) older than 2 minutes
        // ─────────────────────────────────────────────
        const pendingWithdrawalsAll = await prisma.transaction.findMany({
            where: {
                type: 'WITHDRAWAL',
                status: 'PENDING',
                createdAt: { lt: minutesAgo(2) }
            }
        });

        const pendingWithdrawals = pendingWithdrawalsAll.filter(t => (t.meta as any)?.paystackReference);

        if (pendingWithdrawals.length > 0) {
            const refs = new Set<string>();
            pendingWithdrawals.forEach(t => {
                const ref = (t.meta as any)?.paystackReference;
                if (ref) refs.add(ref);
            });

            // Fetch recent transfers pages until we cover refs or hit cap
            const transferByRef = new Map<string, any>();
            const maxPages = 5;
            for (let page = 1; page <= maxPages && transferByRef.size < refs.size; page++) {
                const res = await getTransfers(100, page);
                const data = res?.data || [];
                for (const tr of data) {
                    if (tr?.reference) transferByRef.set(tr.reference, tr);
                }
                if (!res?.meta?.next_page) break;
            }

            for (const tx of pendingWithdrawals) {
                const meta = tx.meta as any;
                const ref = meta?.paystackReference;
                const tr = ref ? transferByRef.get(ref) : null;
                if (!tr) continue;

                const status = String(tr.status || '').toLowerCase();
                if (status === 'success') {
                    await prisma.$transaction([
                        prisma.transaction.update({
                            where: { id: tx.id },
                            data: {
                                status: 'SUCCESS',
                                meta: { ...(tx.meta as any), requery: { at: new Date().toISOString(), status: tr.status, source: 'job' } }
                            }
                        }),
                        prisma.notification.create({
                            data: {
                                userId: tx.userId,
                                title: 'Withdrawal Successful',
                                message: `Your withdrawal of ₦${tx.amount.toLocaleString()} was completed successfully.`,
                                type: 'SUCCESS'
                            }
                        })
                    ]);
                } else if (status === 'failed' || status === 'reversed') {
                    await prisma.$transaction([
                        prisma.transaction.update({
                            where: { id: tx.id },
                            data: {
                                status: 'FAILED',
                                meta: { ...(tx.meta as any), requery: { at: new Date().toISOString(), status: tr.status, source: 'job' } }
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
                                message: `Your withdrawal of ₦${tx.amount.toLocaleString()} failed and your funds were refunded.`,
                                type: 'ERROR'
                            }
                        })
                    ]);
                }
            }
        }

        // ─────────────────────────────────────────────
        // 2) Pending deposits older than 10 minutes (verify on Paystack)
        // ─────────────────────────────────────────────
        const pendingDepositsAll = await prisma.transaction.findMany({
            where: {
                type: 'DEPOSIT',
                status: 'PENDING',
                createdAt: { lt: minutesAgo(10) }
            }
        });

        const pendingDeposits = pendingDepositsAll.filter(t => (t.meta as any)?.reference);

        for (const tx of pendingDeposits) {
            const reference = (tx.meta as any)?.reference;
            if (!reference) continue;

            try {
                const verification = await verifyTransaction(reference);
                if (verification?.data?.status !== 'success') continue;

                // Amount in Paystack is in kobo
                const kobo = Number(verification?.data?.amount || 0);
                const naira = kobo / 100;
                if (Math.abs(naira - Number(tx.amount)) > 0.01) continue;

                await prisma.$transaction([
                    prisma.transaction.update({
                        where: { id: tx.id },
                        data: {
                            status: 'SUCCESS',
                            meta: {
                                ...(tx.meta as any),
                                verifiedAt: new Date().toISOString(),
                                verificationSource: 'job_requery',
                                paystack: {
                                    reference,
                                    status: verification.data.status,
                                    gateway_response: verification.data.gateway_response,
                                    channel: verification.data.channel,
                                    paid_at: verification.data.paid_at,
                                    transaction_date: verification.data.transaction_date,
                                    id: verification.data.id
                                }
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
                            title: 'Deposit Successful',
                            message: `Your deposit of ₦${tx.amount.toLocaleString()} was successful.`,
                            type: 'SUCCESS'
                        }
                    })
                ]);
            } catch (e) {
                // Ignore transient errors; job will retry next tick
            }
        }

        // ─────────────────────────────────────────────
        // 3) System health heartbeat
        // ─────────────────────────────────────────────
        await prisma.systemHealth.upsert({
            where: { id: 1 },
            create: { id: 1, lastReconciliation: new Date() },
            update: { lastReconciliation: new Date() }
        });
    } finally {
        isRunning = false;
    }
}

export function startReconciliationJobs() {
    const enabled = process.env.ENABLE_RECONCILIATION_JOBS === 'true';
    if (!enabled) return;

    // Run once shortly after boot, then every 5 minutes
    setTimeout(() => requeryPendingPaystackTransactions().catch(console.error), 15_000);
    setInterval(() => requeryPendingPaystackTransactions().catch(console.error), 5 * 60_000);
}


