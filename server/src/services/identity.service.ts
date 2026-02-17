import axios from 'axios';
import { resolveBVN } from './paystack.service';
import { verifyNIN as dataverifyNIN, verifyBVN as dataverifyBVN, isDataVerifyConfigured } from './dataverify.service';

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
    if (USE_REAL_VERIFICATION) {
        try {
            console.log(`[IdentityService] Real check requested for ${type}:${value}`);

            // ── NIN Verification ─────────────────────────────────
            if (type === 'nin' || type === 'nin_validation') {
                // Try DataVerify first (preferred for NIN)
                if (isDataVerifyConfigured()) {
                    console.log(`[IdentityService] Using DataVerify for NIN verification`);
                    const result = await dataverifyNIN(value);
                    if (result.success) {
                        return {
                            success: true,
                            message: 'Verification successful',
                            data: {
                                firstName: result.data.firstName,
                                lastName: result.data.lastName,
                                middleName: result.data.middleName,
                                dob: result.data.dob,
                                phone: result.data.phone,
                                gender: result.data.gender,
                                photoUrl: result.data.photoUrl,
                                valid: true
                            }
                        };
                    } else {
                        return { success: false, message: result.message || 'NIN verification failed' };
                    }
                }

                // Fallback to simulation if DataVerify not configured
                console.log(`[IdentityService] DataVerify not configured for NIN, using simulation.`);
                return simulateVerification(type, value);
            }

            // ── BVN Verification ─────────────────────────────────
            if (type === 'bvn' || type === 'bvn_validation') {
                // Try DataVerify first (preferred)
                if (isDataVerifyConfigured()) {
                    console.log(`[IdentityService] Using DataVerify for BVN verification`);
                    const result = await dataverifyBVN(value);
                    if (result.success) {
                        return {
                            success: true,
                            message: 'Verification successful',
                            data: {
                                firstName: result.data.firstName,
                                lastName: result.data.lastName,
                                middleName: result.data.middleName,
                                dob: result.data.dob,
                                phone: result.data.phone,
                                gender: result.data.gender,
                                photoUrl: result.data.photoUrl,
                                valid: true
                            }
                        };
                    }
                    // If DataVerify fails, try Paystack as fallback
                    console.log(`[IdentityService] DataVerify BVN failed, trying Paystack fallback`);
                }

                // Fallback to Paystack BVN resolution
                if (PAYSTACK_SECRET_KEY) {
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

                // No provider available — simulation
                console.log(`[IdentityService] No real provider configured for BVN, using simulation.`);
                return simulateVerification(type, value);
            }

            // Fallback for other types to simulation
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
