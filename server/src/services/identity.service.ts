import axios from 'axios';
import { resolveBVN } from './paystack.service';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const USE_REAL_VERIFICATION = process.env.ENABLE_REAL_IDENTITY_CHECK === 'true';

interface VerificationResult {
    success: boolean;
    data?: any;
    message?: string;
}

export type IdentityType = 'bvn' | 'nin' | 'nin_modification' | 'nin_validation' | 'nin_personalization' | 'bvn_modification' | 'bvn_validation' | 'bvn_retrieval';

export const verifyIdentityNumber = async (type: IdentityType, value: string, details?: string): Promise<VerificationResult> => {
    // 0. Handle Retrieval (Phone Number)
    if (type === 'bvn_retrieval') {
        if (!/^\d{11}$/.test(value)) {
            return { success: false, message: 'Phone number must be 11 digits.' };
        }
        return simulateRetrieval(type, value);
    }

    // 1. Basic Validation (Length & Numeric) for standard ID types
    // NIN and BVN are 11 digits
    if (!/^\d{11}$/.test(value)) {
        return { success: false, message: `${type.toUpperCase().replace('_', ' ')} value must be exactly 11 digits.` };
    }

    // 2. Handle Modifications & Personalization (Manual Request Simulation)
    if (['nin_modification', 'nin_personalization', 'bvn_modification'].includes(type)) {
        // In a real app, this might upload files or save a request to a distinct table.
        // Here we simulate accepting the request.
        return {
            success: true,
            message: 'Request received successfully',
            data: {
                status: 'Request Received',
                details: details || 'No details provided',
                reference: `REQ-${Math.floor(Math.random() * 1000000)}`
            }
        };
    }

    // 3. Real Verification (If Enabled) for standard Verify/Validate
    if (USE_REAL_VERIFICATION && PAYSTACK_SECRET_KEY) {
        try {
            console.log(`[IdentityService] Real check requested for ${type}:${value}`);

            if (type === 'bvn' || type === 'bvn_validation') {
                const result = await resolveBVN(value);
                if (result.success) {
                    return {
                        success: true,
                        message: 'Verification successful',
                        data: {
                            firstName: result.data.first_name,
                            lastName: result.data.last_name,
                            dob: result.data.dob,
                            phone: result.data.mobile,
                            valid: true
                        }
                    };
                } else {
                    return { success: false, message: result.message || 'BVN Resolution failed' };
                }
            }

            // Fallback for other types (NIN) to simulation until provider added
            console.log(`[IdentityService] No real provider configured for ${type}, utilizing simulation.`);
            return simulateVerification(type, value);

        } catch (error: any) {
            console.error(`[IdentityService] Verification failed:`, error.response?.data || error.message);
            return { success: false, message: `Could not verify ${type.toUpperCase()}. Please check the number.` };
        }
    }

    // 4. Simulation (Default)
    return simulateVerification(type, value);
};

const simulateRetrieval = (type: string, value: string): VerificationResult => {
    return {
        success: true,
        message: 'Retrieval successful',
        data: {
            bvn: '222' + value.slice(-8), // Simulate a BVN derived from phone
            phone: value,
            name: 'Test Retrieval User'
        }
    };
};

const simulateVerification = (type: string, value: string): VerificationResult => {
    // Simulator Logic:
    // - Reject a specific "test failure" number (e.g., all zeros)

    if (value === '00000000000') {
        return { success: false, message: `The ${type.toUpperCase().replace('_', ' ')} provided is invalid (Simulated Rejection).` };
    }

    console.log(`[IdentityService] Simulating success for ${type}:${value}`);
    return {
        success: true,
        message: 'Verification successful',
        data: {
            firstName: 'Test',
            lastName: 'User',
            valid: true,
            photoUrl: 'https://via.placeholder.com/150'
        }
    };
};
