import { useState } from "react";
import { useRTDBChats, RTDBChat } from "@/hooks/useRealtimeDB";
import { useAuth } from "@/contexts/AuthContext";
import { useCall } from "@/contexts/CallContext";
import ChatSidebarRTDB from "./ChatSidebarRTDB";
import ChatMessagesRTDB from "./ChatMessagesRTDB";
import ChatInputRTDB from "./ChatInputRTDB";
import ChatHeaderRTDB from "./ChatHeaderRTDB";
import CallUI from "@/components/call/CallUI";
import { Button } from "@/components/ui/button";
import { Menu, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatLayoutRTDBProps {
    initialChatId?: string;
}

export default function ChatLayoutRTDB({ initialChatId }: ChatLayoutRTDBProps) {
    const [selectedChatId, setSelectedChatId] = useState<string | undefined>(initialChatId);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [replyTo, setReplyTo] = useState<{ id: string; text: string; senderName: string } | null>(null);
    const { chats } = useRTDBChats();
    const { user } = useAuth();
    const { state: callState, initiateCall } = useCall();

    const selectedChat = chats.find((c) => c.id === selectedChatId);

    const handleSelectChat = (chatId: string) => {
        setSelectedChatId(chatId);
        setReplyTo(null);
        setSidebarOpen(false);
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
        <div className="flex h-screen bg-background">
            {/* Call UI Overlay */}
            {callState.status !== "idle" && <CallUI />}

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <div
                className={cn(
                    "fixed md:relative inset-y-0 left-0 z-50 w-80 md:w-80 lg:w-96 transform transition-transform md:transform-none border-r",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}
            >
                <ChatSidebarRTDB
                    selectedChatId={selectedChatId}
                    onSelectChat={handleSelectChat}
                    onMobileClose={() => setSidebarOpen(false)}
                />
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {selectedChat ? (
                    <>
                        <ChatHeaderRTDB
                            chat={selectedChat}
                            currentUserId={user?.uid}
                            onMenuClick={() => setSidebarOpen(true)}
                            onCallStart={handleCallStart}
                        />
                        <ChatMessagesRTDB roomId={selectedChatId!} onReply={setReplyTo} />
                        <ChatInputRTDB
                            roomId={selectedChatId!}
                            onReply={replyTo}
                            onCancelReply={() => setReplyTo(null)}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-chat-background">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 left-4 md:hidden"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="h-6 w-6" />
                        </Button>
                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                            <MessageCircle className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <h2 className="text-xl font-medium mb-2">Welcome to ChatFlow</h2>
                        <p className="text-muted-foreground text-center max-w-md">
                            Select a chat from the sidebar or start a new conversation
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

