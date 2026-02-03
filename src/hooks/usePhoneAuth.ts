import { useState, useCallback } from "react";
import {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult,
    PhoneAuthProvider,
    signInWithCredential,
    updateProfile,
} from "firebase/auth";
import { ref, set, serverTimestamp } from "firebase/database";
import { auth, rtdb } from "@/lib/firebase";

declare global {
    interface Window {
        recaptchaVerifier: RecaptchaVerifier;
        confirmationResult: ConfirmationResult;
    }
}

export interface PhoneAuthState {
    step: "phone" | "otp" | "profile";
    phoneNumber: string;
    loading: boolean;
    error: string | null;
}

export function usePhoneAuth() {
    const [state, setState] = useState<PhoneAuthState>({
        step: "phone",
        phoneNumber: "",
        loading: false,
        error: null,
    });

    const setupRecaptcha = useCallback((containerId: string) => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
                size: "invisible",
                callback: () => {
                    // reCAPTCHA solved
                },
                "expired-callback": () => {
                    setState((prev) => ({ ...prev, error: "reCAPTCHA expired. Please try again." }));
                },
            });
        }
    }, []);

    const sendOTP = useCallback(async (phoneNumber: string) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            // Format phone number (ensure it has + prefix)
            const formattedNumber = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;

            const appVerifier = window.recaptchaVerifier;
            const confirmationResult = await signInWithPhoneNumber(auth, formattedNumber, appVerifier);
            window.confirmationResult = confirmationResult;

            setState((prev) => ({
                ...prev,
                step: "otp",
                phoneNumber: formattedNumber,
                loading: false,
            }));

            return true;
        } catch (error: any) {
            console.error("Error sending OTP:", error);
            let errorMessage = "Failed to send OTP. Please try again.";

            if (error.code === "auth/invalid-phone-number") {
                errorMessage = "Invalid phone number. Please check and try again.";
            } else if (error.code === "auth/too-many-requests") {
                errorMessage = "Too many requests. Please try again later.";
            } else if (error.code === "auth/quota-exceeded") {
                errorMessage = "SMS quota exceeded. Please try again later.";
            }

            setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
            return false;
        }
    }, []);

    const verifyOTP = useCallback(async (otp: string) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const result = await window.confirmationResult.confirm(otp);
            const user = result.user;

            // Check if user has profile (new user goes to profile setup)
            if (!user.displayName) {
                setState((prev) => ({ ...prev, step: "profile", loading: false }));
            } else {
                // Existing user - update presence
                await set(ref(rtdb, `users/${user.uid}`), {
                    uid: user.uid,
                    phoneNumber: user.phoneNumber,
                    displayName: user.displayName,
                    photoURL: user.photoURL || "",
                    isOnline: true,
                    lastSeen: serverTimestamp(),
                });
                setState((prev) => ({ ...prev, loading: false }));
            }

            return true;
        } catch (error: any) {
            console.error("Error verifying OTP:", error);
            let errorMessage = "Invalid OTP. Please try again.";

            if (error.code === "auth/invalid-verification-code") {
                errorMessage = "Invalid verification code. Please check and try again.";
            } else if (error.code === "auth/code-expired") {
                errorMessage = "Verification code expired. Please request a new one.";
            }

            setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
            return false;
        }
    }, []);

    const setupProfile = useCallback(async (displayName: string, photoURL?: string) => {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No user found");

            // Update Firebase Auth profile
            await updateProfile(user, {
                displayName,
                photoURL: photoURL || null,
            });

            // Create user in RTDB
            await set(ref(rtdb, `users/${user.uid}`), {
                uid: user.uid,
                phoneNumber: user.phoneNumber,
                displayName,
                photoURL: photoURL || "",
                about: "Hey there! I am using ChatFlow",
                isOnline: true,
                lastSeen: serverTimestamp(),
                createdAt: serverTimestamp(),
            });

            setState((prev) => ({ ...prev, loading: false }));
            return true;
        } catch (error: any) {
            console.error("Error setting up profile:", error);
            setState((prev) => ({ ...prev, loading: false, error: "Failed to set up profile." }));
            return false;
        }
    }, []);

    const resetState = useCallback(() => {
        setState({
            step: "phone",
            phoneNumber: "",
            loading: false,
            error: null,
        });
    }, []);

    return {
        state,
        setupRecaptcha,
        sendOTP,
        verifyOTP,
        setupProfile,
        resetState,
    };
}
