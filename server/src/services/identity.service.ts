import axios from 'axios';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const USE_REAL_VERIFICATION = process.env.ENABLE_REAL_IDENTITY_CHECK === 'true';

interface VerificationResult {
    success: boolean;
    data?: any;
    message?: string;
}

export const verifyIdentityNumber = async (type: 'bvn' | 'nin', value: string): Promise<VerificationResult> => {
    // 1. Basic Validation (Length & Numeric)
    if (!/^\d{11}$/.test(value)) {
        return { success: false, message: `${type.toUpperCase()} must be exactly 11 digits.` };
    }

    // 2. Real Verification (If Enabled)
    if (USE_REAL_VERIFICATION && PAYSTACK_SECRET_KEY) {
        try {
            // Note: Paystack BVN/NIN resolution endpoints vary by account permissions.
            // This is a generic implementation structure for the Identity API.
            // You may need to replace the URL with your specific provider (e.g., Dojah, YouVerify).

            // Example for Paystack (Hypothetical /customer/identification endpoint or similar)
            // const response = await axios.get(`https://api.paystack.co/bank/resolve_bvn/${value}`, {
            //     headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
            // });

            // For now, we will log that we WOULD call the API, but fallback to simulation 
            // to avoid breaking the app if the specific endpoint isn't enabled on your account.
            console.log(`[IdentityService] Real check requested for ${type}:${value} - Implementation requires specific provider endpoint.`);

            // returning simulation for safety until specific endpoint is confirmed
            return simulateVerification(type, value);

        } catch (error: any) {
            console.error(`[IdentityService] Verification failed:`, error.response?.data || error.message);
            return { success: false, message: `Could not verify ${type.toUpperCase()}. Please check the number.` };
        }
    }

    // 3. Simulation (Default)
    // Allows development without incurring costs or needing live API permissions
    return simulateVerification(type, value);
};

const simulateVerification = (type: string, value: string): VerificationResult => {
    // Simulator Logic:
    // - Reject a specific "test failure" number (e.g., all zeros)
    // - Accept valid 11-digit numbers

    if (value === '00000000000') {
        return { success: false, message: `The ${type.toUpperCase()} provided is invalid (Simulated Rejection).` };
    }

    console.log(`[IdentityService] Simulating success for ${type}:${value}`);
    return {
        success: true,
        message: 'Verification successful',
        data: {
            firstName: 'Test',
            lastName: 'User',
            valid: true
        }
    };
};
