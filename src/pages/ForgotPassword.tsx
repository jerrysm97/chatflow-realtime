import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            setError("Please enter your email address");
            return;
        }

        setLoading(true);
        setError("");

        try {
            await sendPasswordResetEmail(auth, email.trim());
            setSuccess(true);
        } catch (err: any) {
            console.error("[ForgotPassword] Error:", err);
            if (err.code === "auth/user-not-found") {
                setError("No account found with this email address");
            } else if (err.code === "auth/invalid-email") {
                setError("Please enter a valid email address");
            } else {
                setError("Failed to send reset email. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
                <Card className="w-full max-w-md shadow-xl">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-4">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl">Check Your Email</CardTitle>
                        <CardDescription className="text-base">
                            We've sent a password reset link to <strong>{email}</strong>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground text-center">
                            Click the link in the email to reset your password. If you don't see it, check your spam folder.
                        </p>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setSuccess(false);
                                setEmail("");
                            }}
                        >
                            Send Another Link
                        </Button>
                        <Link to="/login" className="w-full">
                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Login
                            </Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-emerald-100 p-3 rounded-full w-fit mb-4">
                        <Mail className="h-8 w-8 text-emerald-600" />
                    </div>
                    <CardTitle className="text-2xl">Forgot Password?</CardTitle>
                    <CardDescription>
                        Enter your email address and we'll send you a link to reset your password.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                className="h-12"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button
                            type="submit"
                            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
                            disabled={loading}
                        >
                            {loading ? "Sending..." : "Send Reset Link"}
                        </Button>
                        <Link to="/login" className="text-sm text-emerald-600 hover:underline">
                            <ArrowLeft className="h-4 w-4 inline mr-1" />
                            Back to Login
                        </Link>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
