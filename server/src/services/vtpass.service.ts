import axios, { AxiosInstance } from 'axios';

/**
 * VTPass Service — Airtime, Data, Electricity, Cable TV
 *
 * VTPass API Documentation: https://www.vtpass.com/documentation/
 * Auth: api-key + secret-key (POST) | api-key + public-key (GET)
 *
 * Set VTPASS_API_KEY, VTPASS_PUBLIC_KEY, VTPASS_SECRET_KEY, VTPASS_BASE_URL in env.
 */

const VTPASS_API_KEY = (process.env.VTPASS_API_KEY || '').trim();
const VTPASS_PUBLIC_KEY = (process.env.VTPASS_PUBLIC_KEY || '').trim();
const VTPASS_SECRET_KEY = (process.env.VTPASS_SECRET_KEY || '').trim();
const VTPASS_BASE_URL = (process.env.VTPASS_BASE_URL || 'https://sandbox.vtpass.com').trim();

// Debug logs to verify keys (masked)
console.log(`[VTPass] Config: BASE_URL=${VTPASS_BASE_URL}, API_KEY=${VTPASS_API_KEY ? 'Yes' : 'No'}(${VTPASS_API_KEY.length}), SECRET_KEY=${VTPASS_SECRET_KEY ? 'Yes' : 'No'}(${VTPASS_SECRET_KEY.length})`);

// ── Axios Instances ──────────────────────────────────────

/** POST requests use api-key + secret-key */
const vtpassPost: AxiosInstance = axios.create({
    baseURL: VTPASS_BASE_URL,
    headers: {
        'api-key': VTPASS_API_KEY,
        'secret-key': VTPASS_SECRET_KEY,
        'Content-Type': 'application/json',
    },
    timeout: 60000,
});

/** GET requests use api-key + public-key */
const vtpassGet: AxiosInstance = axios.create({
    baseURL: VTPASS_BASE_URL,
    headers: {
        'api-key': VTPASS_API_KEY,
        'public-key': VTPASS_PUBLIC_KEY,
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

// ── Types ────────────────────────────────────────────────

export interface VTPassResponse {
    code: string;
    content?: any;
    response_description?: string;
    requestId?: string;
    amount?: number;
    transaction_date?: string;
    purchased_code?: string;
}

export interface VTPassBalance {
    balance: number;
}

// ── Helpers ──────────────────────────────────────────────

/**
 * Generate a VTPass-compliant request ID.
 * Format: YYYYMMDDHHmm + random alphanumeric suffix (≥12 chars total)
 */
export const generateRequestId = (): string => {
    const now = new Date();
    // Use Africa/Lagos timezone (GMT+1)
    const lagosDate = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));

    const year = lagosDate.getFullYear();
    const month = String(lagosDate.getMonth() + 1).padStart(2, '0');
    const day = String(lagosDate.getDate()).padStart(2, '0');
    const hour = String(lagosDate.getHours()).padStart(2, '0');
    const minute = String(lagosDate.getMinutes()).padStart(2, '0');

    const datePrefix = `${year}${month}${day}${hour}${minute}`;
    const randomSuffix = Math.random().toString(36).substring(2, 12);

    return `${datePrefix}${randomSuffix}`;
};

/**
 * Check if a VTPass response indicates success
 */
const isSuccess = (response: VTPassResponse): boolean => {
    return response.code === '000';
};

// ── Service Map ──────────────────────────────────────────

/**
 * Map frontend service IDs → VTPass serviceIDs
 */
export const SERVICE_ID_MAP: Record<string, string> = {
    // Airtime
    'airtime-mtn': 'mtn',
    'airtime-glo': 'glo',
    'airtime-airtel': 'airtel',
    'airtime-9mobile': 'etisalat',
    // Data
    'data-mtn': 'mtn-data',
    'data-glo': 'glo-data',
    'data-airtel': 'airtel-data',
    'data-9mobile': 'etisalat-data',
    'data-smile': 'smile-direct',
    // Insurance
    'insurance-motor': 'third-party-motor-insurance',
    'insurance-accident': 'personal-accident-insurance',
    'insurance-health': 'health-insurance',
    'insurance-home': 'home-cover',
    // Electricity
    'ikeja-electric': 'ikeja-electric',
    'eko-electric': 'eko-electric',
    'abuja-electric': 'abuja-electric',
    'kano-electric': 'kano-electric',
    'portharcourt-electric': 'portharcourt-electric',
    'jos-electric': 'jos-electric',
    'ibadan-electric': 'ibadan-electric',
    'kaduna-electric': 'kaduna-electric',
    'enugu-electric': 'enugu-electric',
    'benin-electric': 'benin-electric',
    // Cable
    'dstv': 'dstv',
    'gotv': 'gotv',
    'startimes': 'startimes',
};

// ── API Functions ────────────────────────────────────────

/**
 * Get VTPass wallet balance
 */
export const getBalance = async (): Promise<VTPassBalance> => {
    try {
        const response = await vtpassGet.get('/api/balance');
        if (response.data?.code === 1 || response.data?.contents) {
            return { balance: response.data.contents.balance };
        }
        throw new Error('Unexpected balance response');
    } catch (error: any) {
        console.error('[VTPass] Balance fetch error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Get variation codes for a service (data plans, electricity types, cable packages)
 */
export const getVariations = async (serviceID: string): Promise<any> => {
    try {
        const response = await vtpassGet.get(`/api/service-variations?serviceID=${serviceID}`);
        return response.data;
    } catch (error: any) {
        console.error('[VTPass] Variations fetch error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Verify a meter number or smart card number
 */
export const verifyMeter = async (
    billersCode: string,
    serviceID: string,
    type: 'prepaid' | 'postpaid'
): Promise<any> => {
    try {
        const response = await vtpassPost.post('/api/merchant-verify', {
            billersCode,
            serviceID,
            type,
        });
        return response.data;
    } catch (error: any) {
        console.error('[VTPass] Meter verify error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Purchase airtime
 */
export const purchaseAirtime = async (
    phone: string,
    amount: number,
    serviceID: string
): Promise<VTPassResponse> => {
    const request_id = generateRequestId();

    try {
        console.log(`[VTPass] Purchasing airtime: ${serviceID} ₦${amount} → ${phone}`);

        const response = await vtpassPost.post('/api/pay', {
            request_id,
            serviceID,
            amount,
            phone,
        });

        const data: VTPassResponse = response.data;
        console.log(`[VTPass] Airtime response: ${data.code} - ${data.response_description}`);

        return data;
    } catch (error: any) {
        console.error('[VTPass] Airtime purchase error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Purchase data bundle
 */
export const purchaseData = async (
    phone: string,
    serviceID: string,
    variationCode: string,
    amount?: number
): Promise<VTPassResponse> => {
    const request_id = generateRequestId();

    try {
        console.log(`[VTPass] Purchasing data: ${serviceID}/${variationCode} → ${phone}`);

        const payload: any = {
            request_id,
            serviceID,
            phone,
            billersCode: variationCode,
            variation_code: variationCode,
        };
        if (amount) payload.amount = amount;

        const response = await vtpassPost.post('/api/pay', payload);
        const data: VTPassResponse = response.data;

        console.log(`[VTPass] Data response: ${data.code} - ${data.response_description}`);
        return data;
    } catch (error: any) {
        console.error('[VTPass] Data purchase error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Purchase electricity (prepaid/postpaid)
 */
export const purchaseElectricity = async (
    meterNumber: string,
    serviceID: string,
    variationCode: string,
    amount: number,
    phone: string
): Promise<VTPassResponse> => {
    const request_id = generateRequestId();

    try {
        console.log(`[VTPass] Purchasing electricity: ${serviceID}/${variationCode} ₦${amount} → meter:${meterNumber}`);

        const response = await vtpassPost.post('/api/pay', {
            request_id,
            serviceID,
            billersCode: meterNumber,
            variation_code: variationCode,
            amount,
            phone,
        });

        const data: VTPassResponse = response.data;
        console.log(`[VTPass] Electricity response: ${data.code} - ${data.response_description}`);

        return data;
    } catch (error: any) {
        console.error('[VTPass] Electricity purchase error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Purchase cable TV subscription (DSTV, GOtv, Startimes)
 */
export const purchaseCable = async (
    smartCardNumber: string,
    serviceID: string,
    variationCode: string,
    amount: number,
    phone: string
): Promise<VTPassResponse> => {
    const request_id = generateRequestId();

    try {
        console.log(`[VTPass] Purchasing cable: ${serviceID}/${variationCode} → card:${smartCardNumber}`);

        const response = await vtpassPost.post('/api/pay', {
            request_id,
            serviceID,
            billersCode: smartCardNumber,
            variation_code: variationCode,
            amount,
            phone,
        });

        const data: VTPassResponse = response.data;
        console.log(`[VTPass] Cable response: ${data.code} - ${data.response_description}`);

        return data;
    } catch (error: any) {
        console.error('[VTPass] Cable purchase error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Purchase Insurance (Motor, Home, Accident, Health)
 */
export const purchaseInsurance = async (
    serviceID: string,
    variationCode: string,
    amount: number,
    phone: string,
    billersCode: string, // e.g. Plate Number for Motor, or Phone for others
    metadata: any = {}
): Promise<VTPassResponse> => {
    const request_id = generateRequestId();

    try {
        console.log(`[VTPass] Purchasing insurance: ${serviceID}/${variationCode} → ${billersCode}`);

        // Construct payload with required fields for different insurance types
        const payload = {
            request_id,
            serviceID,
            billersCode,
            variation_code: variationCode,
            amount,
            phone,
            ...metadata // Spread additional fields (Engine No, Chassis No, Insured Name, etc.)
        };

        const response = await vtpassPost.post('/api/pay', payload);
        const data: VTPassResponse = response.data;
        console.log(`[VTPass] Insurance response: ${data.code} - ${data.response_description}`);

        return data;
    } catch (error: any) {
        console.error('[VTPass] Insurance purchase error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Requery a transaction status
 */
export const requeryTransaction = async (requestId: string): Promise<VTPassResponse> => {
    try {
        const response = await vtpassPost.post('/api/requery', {
            request_id: requestId,
        });
        return response.data;
    } catch (error: any) {
        console.error('[VTPass] Requery error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Check if VTPass is properly configured
 */
export const isVTPassConfigured = (): boolean => {
    return !!(VTPASS_API_KEY && VTPASS_SECRET_KEY && VTPASS_PUBLIC_KEY);
};
