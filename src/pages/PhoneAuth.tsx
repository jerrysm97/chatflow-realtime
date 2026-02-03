import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePhoneAuth } from "@/hooks/usePhoneAuth";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Phone, ArrowLeft, Loader2, User, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PhoneAuth() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { state, setupRecaptcha, sendOTP, verifyOTP, setupProfile, resetState } = usePhoneAuth();

    const [phoneNumber, setPhoneNumber] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [displayName, setDisplayName] = useState("");
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Redirect if already authenticated
    useEffect(() => {
        if (user && user.displayName) {
            navigate("/");
        }
    }, [user, navigate]);

    // Setup reCAPTCHA on mount
    useEffect(() => {
        setupRecaptcha("recaptcha-container");
    }, [setupRecaptcha]);

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneNumber.trim()) return;
        await sendOTP(phoneNumber);
    };

    const handleOTPChange = (index: number, value: string) => {
        if (value.length > 1) {
            value = value.slice(-1);
        }
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }

        // Auto-submit when complete
        if (newOtp.every((digit) => digit) && value) {
            const otpString = newOtp.join("");
            verifyOTP(otpString);
        }
    };

    const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName.trim()) return;
        const success = await setupProfile(displayName);
        if (success) {
            navigate("/");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800 p-4">
            <div id="recaptcha-container" />

            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                        <MessageCircle className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl">
                            {state.step === "phone" && "Welcome to ChatFlow"}
                            {state.step === "otp" && "Enter Verification Code"}
                            {state.step === "profile" && "Set Up Your Profile"}
                        </CardTitle>
                        <CardDescription className="mt-2">
                            {state.step === "phone" && "Enter your phone number to get started"}
                            {state.step === "otp" && `We sent a code to ${state.phoneNumber}`}
                            {state.step === "profile" && "Tell us a bit about yourself"}
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent>
                    {/* Phone Number Step */}
                    {state.step === "phone" && (
                        <form onSubmit={handleSendOTP} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="+1 234 567 8900"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        className="pl-10"
                                        autoFocus
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Include country code (e.g., +1 for US)
                                </p>
                            </div>

                            {state.error && (
                                <p className="text-sm text-destructive text-center">{state.error}</p>
                            )}

                            <Button type="submit" className="w-full" disabled={state.loading || !phoneNumber.trim()}>
                                {state.loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    "Send Verification Code"
                                )}
                            </Button>

                            <div className="text-center">
                                <Button variant="link" onClick={() => navigate("/login")} className="text-sm">
                                    Use email instead
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* OTP Verification Step */}
                    {state.step === "otp" && (
                        <div className="space-y-6">
                            <div className="flex justify-center gap-2">
                                {otp.map((digit, index) => (
                                    <Input
                                        key={index}
                                        ref={(el) => (otpRefs.current[index] = el)}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOTPChange(index, e.target.value)}
                                        onKeyDown={(e) => handleOTPKeyDown(index, e)}
                                        className={cn(
                                            "w-12 h-14 text-center text-xl font-semibold",
                                            digit && "border-primary"
                                        )}
                                        autoFocus={index === 0}
                                    />
                                ))}
                            </div>

                            {state.error && (
                                <p className="text-sm text-destructive text-center">{state.error}</p>
                            )}

                            {state.loading && (
                                <div className="flex justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            )}

                            <div className="text-center space-y-2">
                                <p className="text-sm text-muted-foreground">Didn't receive the code?</p>
                                <Button
                                    variant="ghost"
                                    onClick={() => sendOTP(state.phoneNumber)}
                                    disabled={state.loading}
                                >
                                    Resend Code
                                </Button>
                            </div>

                            <Button variant="outline" className="w-full" onClick={resetState}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Change Number
                            </Button>
                        </div>
                    )}

                    {/* Profile Setup Step */}
                    {state.step === "profile" && (
                        <form onSubmit={handleProfileSubmit} className="space-y-6">
                            <div className="flex justify-center">
                                <div className="relative">
                                    <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center">
                                        <User className="w-12 h-12 text-muted-foreground" />
                                    </div>
                                    <button
                                        type="button"
                                        className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center"
                                    >
                                        <Camera className="w-4 h-4 text-primary-foreground" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="displayName">Your Name</Label>
                                <Input
                                    id="displayName"
                                    placeholder="Enter your name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {state.error && (
                                <p className="text-sm text-destructive text-center">{state.error}</p>
                            )}

                            <Button type="submit" className="w-full" disabled={state.loading || !displayName.trim()}>
                                {state.loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Setting up...
                                    </>
                                ) : (
                                    "Get Started"
                                )}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
