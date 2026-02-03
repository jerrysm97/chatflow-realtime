import { useState, useEffect } from "react";
import { useRTDBChats, RTDBChat } from "@/hooks/useRealtimeDB";
import { useAuth } from "@/contexts/AuthContext";
import { useCall } from "@/contexts/CallContext";
import ChatSidebarRTDB from "@/components/chat/ChatSidebarRTDB";
import ChatMessagesRTDB from "@/components/chat/ChatMessagesRTDB";
import ChatInputRTDB from "@/components/chat/ChatInputRTDB";
import ChatHeaderRTDB from "@/components/chat/ChatHeaderRTDB";
import ChatBottomNav from "@/components/chat/ChatBottomNav";
import CallUI from "@/components/call/CallUI";
import { Button } from "@/components/ui/button";
import { Menu, MessageCircle, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Settings from "@/pages/Settings";

interface ChatLayoutRTDBProps {
    initialChatId?: string;
}

export type MobileTab = "chats" | "groups" | "calls" | "settings";

export default function ChatLayoutRTDB({ initialChatId }: ChatLayoutRTDBProps) {
    const [selectedChatId, setSelectedChatId] = useState<string | undefined>(initialChatId);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<MobileTab>("chats");
    const [replyTo, setReplyTo] = useState<{ id: string; text: string; senderName: string } | null>(null);
    const { chats } = useRTDBChats();
    const { user } = useAuth();
    const { state: callState, initiateCall } = useCall();

    const selectedChat = chats.find((c) => c.id === selectedChatId);

    // Filter chats based on active tab for mobile
    const filteredChats = chats.filter(chat => {
        if (activeTab === "groups") return chat.type === "group";
        if (activeTab === "chats") return chat.type === "direct";
        return true;
    });

    const handleSelectChat = (chatId: string) => {
        setSelectedChatId(chatId);
        setReplyTo(null);
        setSidebarOpen(false);
    };

    const handleBackToList = () => {
        setSelectedChatId(undefined);
    };

    const handleCallStart = async (type: "audio" | "video") => {
        if (!selectedChat || !user) return;

        // Get the other participant for direct chats
        if (selectedChat.type === "direct") {
            const otherUserId = Object.keys(selectedChat.participants).find((id) => id !== user.uid);
            if (otherUserId && selectedChat.participantNames) {
                const otherUserName = selectedChat.participantNames[otherUserId] || "User";
                try {
                    await initiateCall(otherUserId, otherUserName, type);
                } catch (error) {
                    console.error("Call failed:", error);
                    toast.error("Failed to start call. Please check camera/microphone permissions.");
                }
            }
        }
    };

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Call UI Overlay */}
            {callState.status !== "idle" && <CallUI />}

            {/* Desktop Layout or Mobile List View */}
            <div className={cn(
                "flex-1 flex overflow-hidden",
                selectedChatId ? "hidden md:flex" : "flex"
            )}>
                {/* Sidebar - Unified for desktop/mobile list */}
                <div className="w-full md:w-80 lg:w-96 border-r flex flex-col relative pb-16 md:pb-0">
                    {activeTab === "settings" ? (
                        <Settings onBack={() => setActiveTab("chats")} />
                    ) : activeTab === "calls" ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                            <Phone className="h-12 w-12 mb-4 opacity-20" />
                            <h3 className="text-lg font-medium text-foreground">Calls</h3>
                            <p>No recent calls</p>
                        </div>
                    ) : (
                        <ChatSidebarRTDB
                            selectedChatId={selectedChatId}
                            onSelectChat={handleSelectChat}
                            onMobileClose={() => setSidebarOpen(false)}
                            filterType={activeTab === "groups" ? "group" : "direct"}
                        />
                    )}

                    {/* Bottom Nav for Mobile */}
                    <ChatBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
                </div>

                {/* Main Chat Area (Placeholder for desktop when no chat selected) */}
                <div className="hidden md:flex flex-1 flex-col min-w-0 bg-chat-background items-center justify-center relative">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                        <MessageCircle className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h2 className="text-xl font-medium mb-2 text-foreground">Titan Messenger</h2>
                    <p className="text-muted-foreground text-center max-w-md">
                        Select a chat to start messaging
                    </p>
                </div>
            </div>

            {/* Active Chat Window - Mobile or Desktop overlay */}
            {selectedChatId && (
                <div className={cn(
                    "fixed inset-0 z-50 md:relative md:inset-auto md:flex-1 flex flex-col bg-background transform transition-transform duration-300 md:transform-none",
                    selectedChatId ? "translate-x-0" : "translate-x-full md:translate-x-0"
                )}>
                    {selectedChat ? (
                        <>
                            <ChatHeaderRTDB
                                chat={selectedChat}
                                currentUserId={user?.uid}
                                onMenuClick={() => setSidebarOpen(true)}
                                onCallStart={handleCallStart}
                                onBack={handleBackToList}
                            />
                            <div className="flex-1 overflow-hidden relative bg-chat-background bg-chat-pattern">
                                <ChatMessagesRTDB roomId={selectedChatId!} onReply={setReplyTo} />
                            </div>
                            <ChatInputRTDB
                                roomId={selectedChatId!}
                                onReply={replyTo}
                                onCancelReply={() => setReplyTo(null)}
                            />
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}



