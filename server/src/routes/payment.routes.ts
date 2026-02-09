import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import * as paystackService from '../services/paystack.service';

const router = Router();
const prisma = new PrismaClient();

// Initialize Paystack Payment
router.post('/initialize', authenticate, async (req: AuthRequest, res, next) => {
    try {
        // Fetch global settings
        const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
        const minDeposit = settings?.minDeposit || 1000;

        const schema = z.object({
            amount: z.number().min(minDeposit, `Minimum deposit is ₦${minDeposit.toLocaleString()}`),
            purpose: z.enum(['deposit', 'investment'])
        });

        const { amount, purpose } = schema.parse(req.body);
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const reference = paystackService.generateReference('DEP');

        // Create pending transaction
        await prisma.transaction.create({
            data: {
                userId,
                type: 'DEPOSIT',
                amount,
                status: 'PENDING',
                description: `Deposit via Paystack`,
                meta: { reference, purpose }
            }
        });

        const result = await paystackService.initializeTransaction(
            user.email,
            amount,
            reference,
            { userId, purpose }
        );

        res.json({
            message: 'Payment initialized',
            authorization_url: result.data.authorization_url,
            reference: result.data.reference
        });
    } catch (error) {
        next(error);
    }
});

// Verify Payment
router.get('/verify/:reference', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { reference } = req.params;
        const userId = req.user!.id;

        const result = await paystackService.verifyTransaction(reference);

        if (result.data.status === 'success') {
            // Find the pending transaction
            const transaction = await prisma.transaction.findFirst({
                where: {
                    userId,
                    meta: { path: ['reference'], equals: reference }
                }
            });

            if (transaction && transaction.status === 'PENDING') {
                // Update transaction and credit user
                await prisma.$transaction([
                    prisma.transaction.update({
                        where: { id: transaction.id },
                        data: { status: 'SUCCESS' }
                    }),
                    prisma.user.update({
                        where: { id: userId },
                        data: { balance: { increment: transaction.amount } }
                    }),
                    prisma.notification.create({
                        data: {
                            userId,
                            title: 'Deposit Successful',
                            message: `Your deposit of ₦${transaction.amount.toLocaleString()} was successful.`,
                            type: 'SUCCESS'
                        }
                    })
                ]);

                // Send Email Notification (Async)
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user && process.env.RESEND_API_KEY) {
                    const { sendTransactionEmail } = await import('../services/email.service');
                    sendTransactionEmail(user.email, 'deposit', transaction.amount, 'SUCCESS').catch(console.error);
                }
            }

            res.json({ message: 'Payment verified successfully', status: 'success' });
        } else {
            res.json({ message: 'Payment not successful', status: result.data.status });
        }
    } catch (error) {
        next(error);
    }
});

// Paystack Webhook
router.post('/webhook', async (req: any, res: any, next: any) => {
    try {
        const signature = req.headers['x-paystack-signature'] as string;

        // Use raw body buffer for signature verification (set by express.raw() middleware in index.ts)
        // If body is a Buffer, convert to string; otherwise use as-is
        const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

        // Verify webhook signature
        if (!paystackService.verifyWebhookSignature(payload, signature)) {
            console.error('Webhook signature verification failed');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Parse the body if it came as raw buffer
        const event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;

        console.log('Paystack webhook received:', event.event);

        if (event.event === 'charge.success') {
            const { reference, amount, metadata } = event.data;
            const amountInNaira = amount / 100;

            // Find transaction by reference
            const transaction = await prisma.transaction.findFirst({
                where: {
                    meta: { path: ['reference'], equals: reference }
                }
            });

            if (transaction && transaction.status === 'PENDING') {
                // SECURITY: Double check with Paystack API
                const verification = await paystackService.verifyTransaction(reference);

                if (verification.data.status !== 'success') {
                    console.error(`Fraud Attempt? Webhook says success but API says ${verification.data.status} for ref ${reference}`);
                    return res.sendStatus(200); // Acknowledge but don't process
                }

                if (verification.data.amount !== amount) {
                    console.error(`Amount Mismatch: Webhook ${amount} vs API ${verification.data.amount}`);
                    return res.sendStatus(200);
                }

                await prisma.$transaction([
                    prisma.transaction.update({
                        where: { id: transaction.id },
                        data: { status: 'SUCCESS' }
                    }),
                    prisma.user.update({
                        where: { id: transaction.userId },
                        data: { balance: { increment: amountInNaira } }
                    }),
                    prisma.notification.create({
                        data: {
                            userId: transaction.userId,
                            title: 'Deposit Successful',
                            message: `Your deposit of ₦${amountInNaira.toLocaleString()} was successful.`,
                            type: 'SUCCESS'
                        }
                    })
                ]);

                // Send Email Notification (Async)
                const user = await prisma.user.findUnique({ where: { id: transaction.userId } });
                if (user && process.env.RESEND_API_KEY) {
                    const { sendTransactionEmail } = await import('../services/email.service');
                    sendTransactionEmail(user.email, 'deposit', amountInNaira, 'SUCCESS').catch(console.error);
                }
            } else if (!transaction && event.data.channel === 'dedicated_nuban') {
                // HANDLE VIRTUAL ACCOUNT TRANSFER
                console.log(`Processing Virtual Account transfer: ${reference} for ${amountInNaira}`);

                // Find user by customer code or email
                const user = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { paystackCustomerCode: event.data.customer.customer_code },
                            { email: event.data.customer.email }
                        ]
                    }
                });

                if (user) {
                    // Check if we already processed this reference (safety check)
                    const existingTx = await prisma.transaction.findFirst({
                        where: {
                            meta: { path: ['reference'], equals: reference }
                        }
                    });

                    if (existingTx) {
                        console.log('Transaction already processed');
                        return res.sendStatus(200);
                    }

                    // Create successful transaction
                    await prisma.$transaction([
                        prisma.transaction.create({
                            data: {
                                userId: user.id,
                                type: 'DEPOSIT',
                                amount: amountInNaira,
                                status: 'SUCCESS',
                                description: `Deposit via Virtual Account`,
                                meta: { reference, channel: 'dedicated_nuban', sender: event.data.authorization }
                            }
                        }),
                        prisma.user.update({
                            where: { id: user.id },
                            data: { balance: { increment: amountInNaira } }
                        }),
                        prisma.notification.create({
                            data: {
                                userId: user.id,
                                title: 'Deposit Received',
                                message: `You received a deposit of ₦${amountInNaira.toLocaleString()} to your virtual account.`,
                                type: 'SUCCESS'
                            }
                        })
                    ]);

                    // Send Email Notification (Async)
                    if (process.env.RESEND_API_KEY) {
                        const { sendTransactionEmail } = await import('../services/email.service');
                        sendTransactionEmail(user.email, 'deposit', amountInNaira, 'SUCCESS').catch(console.error);
                    }
                } else {
                    console.error(`Virtual Account deposit received but user not found. Customer: ${event.data.customer.customer_code}`);
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// Get Banks List
router.get('/banks', authenticate, async (req, res, next) => {
    try {
        const result = await paystackService.getBanks();
        res.json(result.data);
    } catch (error) {
        next(error);
    }
});

// Verify Bank Account
router.post('/verify-account', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const schema = z.object({
            accountNumber: z.string().length(10),
            bankCode: z.string()
        });

        const { accountNumber, bankCode } = schema.parse(req.body);

        const result = await paystackService.verifyAccountNumber(accountNumber, bankCode);

        res.json({
            accountName: result.data.account_name,
            accountNumber: result.data.account_number
        });
    } catch (error: any) {
        if (error.response?.status === 422) {
            return res.status(400).json({ error: 'Could not verify account' });
        }
        next(error);
    }
});

// Create Virtual Account
router.post('/virtual-account', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const userId = req.user!.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { virtualAccount: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.virtualAccount) {
            return res.json({
                message: 'Virtual account already exists',
                account: user.virtualAccount
            });
        }

        // 1. Create/Get Customer Code
        let customerCode = user.paystackCustomerCode;

        // Define naming convention based on Role and Username
        let firstName, lastName, phone;

        if (user.role === 'ADMIN') {
            firstName = 'TB';
            lastName = 'admin';
            phone = user.phone || '+2348000000000';
        } else {
            // Check global settings for KYC requirement
            const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
            const kycRequired = settings?.kycRequiredForAccount ?? true;

            // Strict checks for USER
            if (kycRequired && !user.kycVerified) {
                return res.status(400).json({ error: 'KYC must be verified before generating account' });
            }
            if (!user.username) {
                return res.status(400).json({ error: 'Please set a username in your profile first' });
            }
            if (!user.phone) {
                return res.status(400).json({ error: 'Please set your phone number in your profile first' });
            }
            if (kycRequired && (!user.bvn || !user.nin)) {
                return res.status(400).json({ error: 'Please complete your KYC (BVN, NIN) first' });
            }

            if (user.name && user.name.trim().length > 0) {
                const parts = user.name.trim().split(' ');
                if (parts.length > 1) {
                    firstName = parts[0];
                    lastName = parts.slice(1).join(' ');
                } else {
                    firstName = parts[0];
                    lastName = parts[0]; // Fallback
                }
                phone = user.phone;
            } else {
                firstName = 'TB';
                lastName = user.username!;
                phone = user.phone;
            }
        }

        if (!customerCode) {
            const customer = await paystackService.createCustomer(user.email, firstName, lastName, phone);
            customerCode = customer.data.customer_code;

            // Save customer code
            await prisma.user.update({
                where: { id: userId },
                data: { paystackCustomerCode: customerCode }
            });
        } else {
            // Optional: Update existing customer if needed to reflect new name? 
            // Paystack allows updating customer. For now, we assume if code exists, we use it.
            // But if they changed username, we might want to update it. 
            // However, Paystack Virtual Account might already be tied to the customer name at creation.
            // Supporting name update on existing customer might be complex. Sticking to creation logic for now.
        }

        // 2. Create Dedicated Account
        // Note: In production, you might want to let user choose bank, or default to 'wema-bank' or 'titan-paystack'
        const dva = await paystackService.createDedicatedAccount(customerCode!, 'wema-bank');

        // 3. Save Virtual Account
        const savedAccount = await prisma.virtualAccount.create({
            data: {
                userId,
                bankName: dva.data.bank.name,
                accountNumber: dva.data.account_number,
                accountName: dva.data.account_name
            }
        });

        res.json({
            message: 'Virtual account created successfully',
            account: savedAccount
        });

    } catch (error: any) {
        console.error('Virtual Account Creation Error:', error);
        // Handle specific Paystack errors
        if (error.response?.data?.message) {
            return res.status(400).json({ error: error.response.data.message });
        }
        next(error);
    }
});

export default router;
