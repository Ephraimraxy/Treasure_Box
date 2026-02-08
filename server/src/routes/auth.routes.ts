import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendOTPEmail,
    sendWelcomeEmail
} from '../services/email.service';

const router = Router();
const prisma = new PrismaClient();

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

// Register with email verification
router.post('/register', async (req, res, next) => {
    try {
        const { email, password, name, referralCode } = registerSchema.parse(req.body);

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        let referrerId: string | undefined;
        if (referralCode) {
            const referrer = await prisma.user.findUnique({ where: { referralCode } });
            if (!referrer) {
                return res.status(400).json({ error: 'Invalid referral code' });
            }
            referrerId = referrer.id;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = generateToken();

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                referredById: referrerId,
                referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
                verificationToken,
                verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            }
        });

        // Send verification email
        try {
            await sendVerificationEmail(email, verificationToken);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'default-secret',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Registration successful. Please check your email to verify your account.',
            token,
            user: { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified }
        });
    } catch (error) {
        next(error);
    }
});

// Verify email
router.get('/verify-email', async (req, res, next) => {
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

        // Send welcome email
        try {
            await sendWelcomeEmail(user.email, user.name || undefined);
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
        }

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        next(error);
    }
});

// Resend verification email
router.post('/resend-verification', async (req, res, next) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.json({ message: 'If account exists, verification email has been sent' });
        }

        if (user.emailVerified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        const verificationToken = generateToken();

        await prisma.user.update({
            where: { id: user.id },
            data: {
                verificationToken,
                verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
        });

        await sendVerificationEmail(email, verificationToken);

        res.json({ message: 'Verification email sent' });
    } catch (error) {
        next(error);
    }
});

// Login
router.post('/login', async (req, res, next) => {
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
                role: user.role,
                emailVerified: user.emailVerified
            }
        });
    } catch (error) {
        next(error);
    }
});

// Request OTP login
router.post('/request-otp', async (req, res, next) => {
    try {
        const { email } = requestOTPSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Return success even if user doesn't exist (security)
            return res.json({ message: 'If account exists, OTP has been sent' });
        }

        const otp = generateOTP();

        await prisma.user.update({
            where: { id: user.id },
            data: {
                otp,
                otpExpires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
            }
        });

        await sendOTPEmail(email, otp);

        res.json({ message: 'OTP sent to your email' });
    } catch (error) {
        next(error);
    }
});

// Verify OTP and login
router.post('/verify-otp', async (req, res, next) => {
    try {
        const { email, otp } = verifyOTPSchema.parse(req.body);

        const user = await prisma.user.findFirst({
            where: {
                email,
                otp,
                otpExpires: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        // Clear OTP
        await prisma.user.update({
            where: { id: user.id },
            data: {
                otp: null,
                otpExpires: null,
                emailVerified: true // OTP login verifies email
            }
        });

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
                role: user.role,
                emailVerified: true
            }
        });
    } catch (error) {
        next(error);
    }
});

// Forgot password
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Return success even if user doesn't exist (security)
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

        await sendPasswordResetEmail(email, resetToken);

        res.json({ message: 'Password reset email sent' });
    } catch (error) {
        next(error);
    }
});

// Reset password
router.post('/reset-password', async (req, res, next) => {
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
        next(error);
    }
});

export default router;
