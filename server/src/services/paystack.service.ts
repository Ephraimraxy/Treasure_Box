import axios from 'axios';
import crypto from 'crypto';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const paystackApi = axios.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
    },
});

// Initialize a transaction
export const initializeTransaction = async (
    email: string,
    amount: number, // in Naira
    reference: string,
    metadata?: Record<string, any>
) => {
    const response = await paystackApi.post('/transaction/initialize', {
        email,
        amount: amount * 100, // Convert to kobo
        reference,
        metadata,
        callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
    });
    return response.data;
};

// Verify a transaction
export const verifyTransaction = async (reference: string) => {
    const response = await paystackApi.get(`/transaction/verify/${reference}`);
    return response.data;
};

// Create a transfer recipient (for withdrawals)
export const createTransferRecipient = async (
    name: string,
    accountNumber: string,
    bankCode: string
) => {
    const response = await paystackApi.post('/transferrecipient', {
        type: 'nuban',
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
    });
    return response.data;
};

// Initiate a transfer (for withdrawals)
export const initiateTransfer = async (
    amount: number,
    recipientCode: string,
    reference: string,
    reason: string
) => {
    const response = await paystackApi.post('/transfer', {
        source: 'balance',
        amount: amount * 100,
        recipient: recipientCode,
        reference,
        reason,
    });
    return response.data;
};

// Get list of banks
export const getBanks = async () => {
    const response = await paystackApi.get('/bank?country=nigeria');
    return response.data;
};

// Verify account number
export const verifyAccountNumber = async (accountNumber: string, bankCode: string) => {
    const response = await paystackApi.get(
        `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
    );
    return response.data;
};

// Verify webhook signature
export const verifyWebhookSignature = (payload: string, signature: string): boolean => {
    const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET_KEY || '')
        .update(payload)
        .digest('hex');
    return hash === signature;
};

// Generate unique reference
export const generateReference = (prefix: string = 'TB'): string => {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};
