import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ref, update, onValue, off } from "firebase/database";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth, rtdb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useRealtimeDB";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    ArrowLeft, User, Bell, Lock, Shield, Eye, MessageCircle,
    Trash2, Save, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserSettings {
    privacy: {
        lastSeen: "everyone" | "contacts" | "nobody";
        profilePhoto: "everyone" | "contacts" | "nobody";
        about: "everyone" | "contacts" | "nobody";
        readReceipts: boolean;
        typingIndicators: boolean;
    };
    notifications: {
        enabled: boolean;
        sound: boolean;
        vibration: boolean;
    };
}

const defaultSettings: UserSettings = {
    privacy: {
        lastSeen: "everyone",
        profilePhoto: "everyone",
        about: "everyone",
        readReceipts: true,
        typingIndicators: true,
    },
    notifications: {
        enabled: true,
        sound: true,
        vibration: true,
    },
};

export default function Settings() {
    const { user, signOut } = useAuth();
    const { userProfile } = useUserProfile();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [settings, setSettings] = useState<UserSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Password change state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);

    // Load settings from RTDB
    useEffect(() => {
        if (!user) return;

        const settingsRef = ref(rtdb, `users/${user.uid}/settings`);
        const unsubscribe = onValue(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                setSettings({ ...defaultSettings, ...snapshot.val() });
            }
            setLoading(false);
        });

        return () => off(settingsRef);
    }, [user]);

    const handleSaveSettings = async () => {
        if (!user) return;

        setSaving(true);
        try {
            await update(ref(rtdb, `users/${user.uid}/settings`), settings);
            toast({ title: "Settings saved", description: "Your settings have been updated." });
        } catch (error) {
            console.error("[Settings] Error saving:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to save settings." });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!user?.email) {
            toast({ variant: "destructive", title: "Error", description: "Email login required to change password." });
            return;
        }

        if (newPassword !== confirmPassword) {
            toast({ variant: "destructive", title: "Error", description: "Passwords do not match." });
            return;
        }

        if (newPassword.length < 6) {
            toast({ variant: "destructive", title: "Error", description: "Password must be at least 6 characters." });
            return;
        }

        setChangingPassword(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(auth.currentUser!, credential);
            await updatePassword(auth.currentUser!, newPassword);

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast({ title: "Password changed", description: "Your password has been updated." });
        } catch (error: any) {
            console.error("[Settings] Password change error:", error);
            if (error.code === "auth/wrong-password") {
                toast({ variant: "destructive", title: "Error", description: "Current password is incorrect." });
            } else {
                toast({ variant: "destructive", title: "Error", description: "Failed to change password." });
            }
        } finally {
            setChangingPassword(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
            return;
        }

        try {
            // TODO: Implement full account deletion (remove data from RTDB, then delete auth account)
            toast({ variant: "destructive", title: "Coming soon", description: "Account deletion will be available soon." });
        } catch (error) {
            console.error("[Settings] Delete account error:", error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-2xl font-bold">Settings</h1>
                </div>

                <div className="space-y-6">
                    {/* Profile Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Profile
                            </CardTitle>
                            <CardDescription>Manage your public profile</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col items-center justify-center mb-4 gap-2">
                                <div className="h-24 w-24 rounded-full overflow-hidden bg-muted border-2 border-primary/20">
                                    <img
                                        src={settings.privacy.userProfile?.photoURL || user?.photoURL || ""}
                                        alt="Profile"
                                        className="h-full w-full object-cover"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                    />
                                </div>
                                <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                    ID: <span className="font-mono select-all">{userProfile?.userId}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="displayName">Display Name</Label>
                                <Input
                                    id="displayName"
                                    value={userProfile?.displayName || user?.displayName || ""}
                                    onChange={(e) => {
                                        // In a real app we'd update local state then save, 
                                        // but here we might need a separate 'profile' state or modify the 'settings' object logic if we want to save it strictly via 'save settings'
                                        // For now, let's assume valid 'user' object updates or we handle it in handleSaveSettings
                                    }}
                                    placeholder="Your Name"
                                    disabled={true} // For now disabled until we implement profile update logic properly in handleSaveSettings
                                />
                                <p className="text-xs text-muted-foreground">Name updates coming in next patch</p>
                            </div>
                        </CardContent>
                    </Card>
                    {/* Privacy Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Eye className="h-5 w-5" />
                                Privacy
                            </CardTitle>
                            <CardDescription>Control who can see your information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Read Receipts</Label>
                                    <p className="text-sm text-muted-foreground">Show when you've read messages</p>
                                </div>
                                <Switch
                                    checked={settings.privacy.readReceipts}
                                    onCheckedChange={(checked) =>
                                        setSettings(s => ({ ...s, privacy: { ...s.privacy, readReceipts: checked } }))
                                    }
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Typing Indicators</Label>
                                    <p className="text-sm text-muted-foreground">Show when you're typing</p>
                                </div>
                                <Switch
                                    checked={settings.privacy.typingIndicators}
                                    onCheckedChange={(checked) =>
                                        setSettings(s => ({ ...s, privacy: { ...s.privacy, typingIndicators: checked } }))
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Notifications Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="h-5 w-5" />
                                Notifications
                            </CardTitle>
                            <CardDescription>Manage notification preferences</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Push Notifications</Label>
                                    <p className="text-sm text-muted-foreground">Receive notifications for new messages</p>
                                </div>
                                <Switch
                                    checked={settings.notifications.enabled}
                                    onCheckedChange={(checked) =>
                                        setSettings(s => ({ ...s, notifications: { ...s.notifications, enabled: checked } }))
                                    }
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Sound</Label>
                                    <p className="text-sm text-muted-foreground">Play sound for notifications</p>
                                </div>
                                <Switch
                                    checked={settings.notifications.sound}
                                    onCheckedChange={(checked) =>
                                        setSettings(s => ({ ...s, notifications: { ...s.notifications, sound: checked } }))
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Security Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="h-5 w-5" />
                                Security
                            </CardTitle>
                            <CardDescription>Change your password</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword">Current Password</Label>
                                <Input
                                    id="currentPassword"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                />
                            </div>
                            <Button
                                onClick={handleChangePassword}
                                disabled={changingPassword || !currentPassword || !newPassword}
                                className="w-full"
                            >
                                {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Change Password
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Danger Zone */}
                    <Card className="border-red-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-600">
                                <Trash2 className="h-5 w-5" />
                                Danger Zone
                            </CardTitle>
                            <CardDescription>Irreversible actions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="destructive" onClick={handleDeleteAccount} className="w-full">
                                Delete Account
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Save Button */}
                    <Button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
                    >
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Settings
                    </Button>
                </div>
            </div>
        </div>
    );
}
