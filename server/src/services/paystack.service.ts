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

// Create Paystack Customer
export const createCustomer = async (email: string, firstName: string, lastName: string, phone: string) => {
    try {
        const response = await paystackApi.post('/customer', {
            email,
            first_name: firstName,
            last_name: lastName,
            phone
        });
        return response.data;
    } catch (error: any) {
        // If customer already exists, Paystack returns 400 but might populate data or we just ignore
        // For robustness, if it fails, we might try to fetch customer ?? 
        // But usually creation is idempotent or we handle the error "Customer already exists"
        console.error("Create Customer Error", error.response?.data);
        throw error;
    }
};

// Update existing Paystack Customer (ensure phone/name are synced)
export const updateCustomer = async (customerCode: string, data: { first_name?: string; last_name?: string; phone?: string }) => {
    try {
        const response = await paystackApi.put(`/customer/${customerCode}`, data);
        return response.data;
    } catch (error: any) {
        console.error("Update Customer Error", error.response?.data || error.message);
        throw error;
    }
};

// Create Dedicated Virtual Account
export const createDedicatedAccount = async (
    customerCode: string,
    preferredBank?: string,
    phone?: string,
    country: string = 'NG'
) => {
    const payload: any = {
        customer: customerCode,
        preferred_bank: preferredBank, // e.g., "wema-bank"
    };
    if (phone) payload.phone = phone;
    if (country) payload.country = country;

    const response = await paystackApi.post('/dedicated_account', payload);
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

// ... existing code ...

// Generate unique reference
export const generateReference = (prefix: string = 'TB'): string => {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

// Resolve BVN (requires activation on Paystack Dashboard)
export const resolveBVN = async (bvn: string) => {
    try {
        const response = await paystackApi.get(`/bank/resolve_bvn/${bvn}`);
        return { success: true, data: response.data.data };
    } catch (error: any) {
        console.error("BVN Resolution Error", error.response?.data);
        return { success: false, message: error.response?.data?.message || 'Could not resolve BVN' };
    }
};

// Validate Account (NUBAN) - already exists as verifyAccountNumber but exporting clearer alias if needed
export const resolveNuban = verifyAccountNumber;
