import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@example.com';
const appName = 'Treasure Box';

// Verification Email
export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  await resend.emails.send({
    from: `${appName} <${fromEmail}>`,
    to: email,
    subject: `Verify your ${appName} account`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
            .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 40px; }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo-icon { background: linear-gradient(135deg, #f59e0b, #ea580c); width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; }
            h1 { color: #fff; text-align: center; margin-bottom: 20px; }
            p { color: #94a3b8; line-height: 1.6; }
            .button { display: block; background: linear-gradient(135deg, #f59e0b, #ea580c); color: #0f172a !important; text-decoration: none; padding: 16px 32px; border-radius: 12px; text-align: center; font-weight: bold; margin: 30px 0; }
            .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo"><div class="logo-icon">💰</div></div>
            <h1>Verify Your Email</h1>
            <p>Welcome to ${appName}! Please verify your email address to complete your registration and start investing.</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>Or copy this link: ${verificationUrl}</p>
            <p>This link expires in 24 hours.</p>
            <div class="footer">&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</div>
          </div>
        </body>
      </html>
    `,
  });
};

// Password Reset Email
export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  await resend.emails.send({
    from: `${appName} <${fromEmail}>`,
    to: email,
    subject: `Reset your ${appName} password`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
            .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 40px; }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo-icon { background: linear-gradient(135deg, #f59e0b, #ea580c); width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; }
            h1 { color: #fff; text-align: center; margin-bottom: 20px; }
            p { color: #94a3b8; line-height: 1.6; }
            .button { display: block; background: linear-gradient(135deg, #f59e0b, #ea580c); color: #0f172a !important; text-decoration: none; padding: 16px 32px; border-radius: 12px; text-align: center; font-weight: bold; margin: 30px 0; }
            .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo"><div class="logo-icon">🔐</div></div>
            <h1>Reset Your Password</h1>
            <p>We received a request to reset your password. Click the button below to create a new password.</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy this link: ${resetUrl}</p>
            <p>This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
            <div class="footer">&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</div>
          </div>
        </body>
      </html>
    `,
  });
};

// OTP Email
export const sendOTPEmail = async (email: string, otp: string) => {
  await resend.emails.send({
    from: `${appName} <${fromEmail}>`,
    to: email,
    subject: `Your ${appName} login code: ${otp}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
            .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 40px; }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo-icon { background: linear-gradient(135deg, #f59e0b, #ea580c); width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; }
            h1 { color: #fff; text-align: center; margin-bottom: 20px; }
            p { color: #94a3b8; line-height: 1.6; text-align: center; }
            .otp-code { background: #0f172a; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0; }
            .otp-code span { font-size: 36px; font-weight: bold; color: #f59e0b; letter-spacing: 8px; font-family: monospace; }
            .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo"><div class="logo-icon">🔢</div></div>
            <h1>Your Login Code</h1>
            <p>Use this code to complete your login:</p>
            <div class="otp-code"><span>${otp}</span></div>
            <p>This code expires in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <div class="footer">&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</div>
          </div>
        </body>
      </html>
    `,
  });
};

// Welcome Email
export const sendWelcomeEmail = async (email: string, name?: string) => {
  await resend.emails.send({
    from: `${appName} <${fromEmail}>`,
    to: email,
    subject: `Welcome to ${appName}! 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
            .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 40px; }
            .logo { text-align: center; margin-bottom: 30px; }
            .logo-icon { background: linear-gradient(135deg, #f59e0b, #ea580c); width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; }
            h1 { color: #fff; text-align: center; margin-bottom: 20px; }
            p { color: #94a3b8; line-height: 1.6; }
            .feature { background: #0f172a; border-radius: 8px; padding: 15px; margin: 10px 0; }
            .feature-title { color: #f59e0b; font-weight: bold; }
            .button { display: block; background: linear-gradient(135deg, #f59e0b, #ea580c); color: #0f172a !important; text-decoration: none; padding: 16px 32px; border-radius: 12px; text-align: center; font-weight: bold; margin: 30px 0; }
            .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo"><div class="logo-icon">💰</div></div>
            <h1>Welcome${name ? `, ${name}` : ''}!</h1>
            <p>Thank you for joining ${appName}. Your account is now active and ready to use!</p>
            <div class="feature"><span class="feature-title">💎 Investment Plans</span><br/>Grow your money with our secure investment options.</div>
            <div class="feature"><span class="feature-title">💳 Easy Payments</span><br/>Pay bills and buy airtime instantly.</div>
            <div class="feature"><span class="feature-title">👥 Referral Bonuses</span><br/>Earn when you invite friends.</div>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="button">Start Investing</a>
            <div class="footer">&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</div>
          </div>
        </body>
      </html>
    `,
  });
};

// Transaction Notification Email
export const sendTransactionEmail = async (
  email: string,
  type: 'deposit' | 'withdrawal' | 'investment',
  amount: number,
  status: string
) => {
  const statusColors: Record<string, string> = {
    'SUCCESS': '#10b981',
    'PENDING': '#f59e0b',
    'FAILED': '#ef4444',
    'REJECTED': '#ef4444',
  };

  await resend.emails.send({
    from: `${appName} <${fromEmail}>`,
    to: email,
    subject: `${type.charAt(0).toUpperCase() + type.slice(1)} ${status.toLowerCase()} - ₦${amount.toLocaleString()}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
            .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 40px; }
            h1 { color: #fff; text-align: center; margin-bottom: 20px; }
            .amount { font-size: 36px; font-weight: bold; text-align: center; color: #fff; margin: 20px 0; }
            .status { text-align: center; padding: 8px 16px; border-radius: 8px; display: inline-block; font-weight: bold; }
            .status-container { text-align: center; margin: 20px 0; }
            p { color: #94a3b8; line-height: 1.6; text-align: center; }
            .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${type.charAt(0).toUpperCase() + type.slice(1)}</h1>
            <div class="amount">₦${amount.toLocaleString()}</div>
            <div class="status-container">
              <span class="status" style="background: ${statusColors[status] || '#64748b'}20; color: ${statusColors[status] || '#64748b'}">
                ${status}
              </span>
            </div>
            <p>${new Date().toLocaleString()}</p>
            <div class="footer">&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</div>
          </div>
        </body>
      </html>
    `,
  });
};
// Login Alert Email
export const sendLoginAlertEmail = async (email: string, date: string, ip: string, device: string) => {
  await resend.emails.send({
    from: `${appName} <${fromEmail}>`,
    to: email,
    subject: `Login Alert: New sign-in to your ${appName} account`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; }
            .container { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 40px; }
            h1 { color: #fff; text-align: center; margin-bottom: 20px; }
            p { color: #94a3b8; line-height: 1.6; }
            .details { background: #0f172a; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #334155; }
            .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 30px; }
            .warning { color: #f59e0b; font-size: 13px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Login Alert 🚨</h1>
            <p>We noticed a new sign-in to your ${appName} account.</p>
            <div class="details">
              <strong>Time:</strong> ${date}<br/>
              <strong>IP Address:</strong> ${ip}<br/>
              <strong>Device:</strong> ${device}
            </div>
            <p class="warning">If this was you, you can safely ignore this email. If you don't recognize this activity, please change your password immediately.</p>
            <div class="footer">&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</div>
          </div>
        </body>
      </html>
    `,
  });
};
