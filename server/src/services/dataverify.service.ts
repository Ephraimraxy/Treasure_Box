import axios from 'axios';

/**
 * DataVerify Service — NIN & BVN Verification
 * 
 * Uses the DataVerify API (dataverify.com.ng) for real identity verification.
 * Set DATAVERIFY_API_KEY and DATAVERIFY_BASE_URL in your Railway / .env config.
 */

const DATAVERIFY_API_KEY = process.env.DATAVERIFY_API_KEY;
const DATAVERIFY_BASE_URL = process.env.DATAVERIFY_BASE_URL || 'https://dataverify.com.ng/api';

interface VerificationResult {
    success: boolean;
    data?: any;
    message?: string;
}

const dataverifyApi = axios.create({
    baseURL: DATAVERIFY_BASE_URL,
    headers: {
        'Authorization': `Bearer ${DATAVERIFY_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    timeout: 30000, // 30 second timeout
});

/**
 * Verify a National Identification Number (NIN)
 */
export const verifyNIN = async (nin: string): Promise<VerificationResult> => {
    try {
        console.log(`[DataVerify] Verifying NIN: ${nin.substring(0, 3)}****`);

        const response = await dataverifyApi.post('/nin/verify', {
            nin,
        });

        const data = response.data;

        if (data.status === 'success' || data.success) {
            return {
                success: true,
                message: 'NIN verification successful',
                data: {
                    firstName: data.data?.firstname || data.data?.first_name,
                    lastName: data.data?.lastname || data.data?.last_name,
                    middleName: data.data?.middlename || data.data?.middle_name,
                    phone: data.data?.phone || data.data?.telephoneno,
                    dob: data.data?.birthdate || data.data?.dob,
                    gender: data.data?.gender,
                    photoUrl: data.data?.photo || data.data?.image,
                    valid: true,
                },
            };
        }

        return {
            success: false,
            message: data.message || 'NIN verification failed',
        };
    } catch (error: any) {
        console.error('[DataVerify] NIN verification error:', error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data?.message || 'Could not verify NIN. Please check the number and try again.',
        };
    }
};

/**
 * Verify a Bank Verification Number (BVN)
 */
export const verifyBVN = async (bvn: string): Promise<VerificationResult> => {
    try {
        console.log(`[DataVerify] Verifying BVN: ${bvn.substring(0, 3)}****`);

        const response = await dataverifyApi.post('/bvn/verify', {
            bvn,
        });

        const data = response.data;

        if (data.status === 'success' || data.success) {
            return {
                success: true,
                message: 'BVN verification successful',
                data: {
                    firstName: data.data?.firstname || data.data?.first_name,
                    lastName: data.data?.lastname || data.data?.last_name,
                    middleName: data.data?.middlename || data.data?.middle_name,
                    phone: data.data?.phone || data.data?.mobile,
                    dob: data.data?.birthdate || data.data?.dob,
                    gender: data.data?.gender,
                    photoUrl: data.data?.photo || data.data?.image,
                    valid: true,
                },
            };
        }

        return {
            success: false,
            message: data.message || 'BVN verification failed',
        };
    } catch (error: any) {
        console.error('[DataVerify] BVN verification error:', error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data?.message || 'Could not verify BVN. Please check the number and try again.',
        };
    }
};

/**
 * Check if DataVerify is properly configured
 */
export const isDataVerifyConfigured = (): boolean => {
    return !!(DATAVERIFY_API_KEY && DATAVERIFY_API_KEY.length > 5);
};
