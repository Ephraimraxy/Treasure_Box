import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// Admin email - will be assigned ADMIN role on registration
const ADMIN_EMAIL = 'burstbrainconcept@gmail.com';

// Schemas
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().optional(),
    referralCode: z.string().optional()
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

const forgotPasswordSchema = z.object({
    email: z.string().email()
});

const resetPasswordSchema = z.object({
    token: z.string(),
    password: z.string().min(6)
});

const requestOTPSchema = z.object({
    email: z.string().email()
});

const verifyOTPSchema = z.object({
    email: z.string().email(),
    otp: z.string().length(6)
});

// Generate tokens
const generateToken = () => crypto.randomBytes(32).toString('hex');
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Safe email send helper (won't crash if Resend not configured)
const safeSendEmail = async (emailFn: () => Promise<void>) => {
    if (!process.env.RESEND_API_KEY) {
        console.log('RESEND_API_KEY not set, skipping email');
        return;
    }
    try {
        await emailFn();
    } catch (error) {
        console.error('Email send failed:', error);
    }
};

// Register - requires OTP verification
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, name, referralCode } = registerSchema.parse(req.body);

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        if (referralCode) {
            // Case-insensitive referral lookup
            const referrer = await prisma.user.findFirst({
                where: {
                    referralCode: {
                        equals: referralCode,
                        mode: 'insensitive'
                    }
                }
            });
            if (!referrer) {
                return res.status(400).json({ error: 'Invalid referral code' });
            }
            referrerId = referrer.id;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();

        // Assign ADMIN role to specific email
        const role = email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'ADMIN' : 'USER';

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                referredById: referrerId,
                referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
                role,
                emailVerified: false,
                otp,
                otpExpires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
            }
        });

        // Send OTP email for verification
        if (process.env.RESEND_API_KEY) {
            try {
                const { sendOTPEmail } = await import('../services/email.service');
                await sendOTPEmail(email, otp);
            } catch (emailError) {
                console.error('Failed to send OTP email:', emailError);
            }
        }

        res.status(201).json({
            message: 'Registration successful. Please enter the OTP sent to your email.',
            requiresOTP: true,
            email: user.email
        });
    } catch (error) {
        console.error('Register error:', error);
        next(error);
    }
});

// ... (verify-otp, resend-otp lines 122-206 remain unchanged, will need to be careful with replace) ...

// Login - Standard Email/Password (OTP removed)
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.emailVerified) {
            const otp = generateOTP();
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    otp,
                    otpExpires: new Date(Date.now() + 10 * 60 * 1000)
                }
            });

            if (process.env.RESEND_API_KEY) {
                try {
                    const { sendOTPEmail } = await import('../services/email.service');
                    await sendOTPEmail(email, otp);
                } catch (emailError) {
                    console.error('Failed to send OTP email:', emailError);
                }
            }

            return res.json({
                message: 'Email not verified. Please verify your account.',
                requiresOTP: true,
                email: user.email
            });
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'default-secret',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: true
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        next(error);
    }
});

// Request OTP (for passwordless login)
router.post('/request-otp', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = requestOTPSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.json({ message: 'If account exists, OTP has been sent' });
        }

        const otp = generateOTP();

        await prisma.user.update({
            where: { id: user.id },
            data: {
                otp,
                otpExpires: new Date(Date.now() + 10 * 60 * 1000)
            }
        });

        if (process.env.RESEND_API_KEY) {
            try {
                const { sendOTPEmail } = await import('../services/email.service');
                await sendOTPEmail(email, otp);
            } catch (emailError) {
                console.error('Failed to send OTP email:', emailError);
            }
        }

        res.json({ message: 'OTP sent to your email' });
    } catch (error) {
        console.error('Request OTP error:', error);
        next(error);
    }
});

// Forgot password
router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.json({ message: 'If account exists, password reset email has been sent' });
        }

        const resetToken = generateToken();

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetExpires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
            }
        });

        if (process.env.RESEND_API_KEY) {
            try {
                const { sendPasswordResetEmail } = await import('../services/email.service');
                await sendPasswordResetEmail(email, resetToken);
            } catch (emailError) {
                console.error('Failed to send reset email:', emailError);
            }
        }

        res.json({ message: 'Password reset email sent' });
    } catch (error) {
        console.error('Forgot password error:', error);
        next(error);
    }
});

// Reset password
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token, password } = resetPasswordSchema.parse(req.body);

        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetExpires: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetExpires: null
            }
        });

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Reset password error:', error);
        next(error);
    }
});

// Verify email token (from email link)
router.get('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Invalid verification token' });
        }

        const user = await prisma.user.findFirst({
            where: {
                verificationToken: token,
                verificationExpires: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                verificationToken: null,
                verificationExpires: null
            }
        });

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error('Verify email error:', error);
        next(error);
    }
});

export default router;
