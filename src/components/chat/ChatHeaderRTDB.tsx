import { useState, useEffect } from "react";
import { ref, onValue, off } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { RTDBChat } from "@/hooks/useRealtimeDB";
import GroupInfoPanel from "@/components/group/GroupInfoPanel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, Phone, Video, MoreVertical, Search, Users, Trash2, VolumeX, Pin, Info, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTypingIndicator } from "@/hooks/useRealtimeDB";

interface ChatHeaderRTDBProps {
    chat: RTDBChat;
    currentUserId?: string;
    onMenuClick?: () => void;
    onCallStart?: (type: "audio" | "video") => void;
    onBack?: () => void;
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function getChatDisplayName(chat: RTDBChat, currentUserId?: string): string {
    if (chat.type === "group") {
        return chat.name || "Group";
    }
    if (chat.participantNames && currentUserId) {
        const otherUserId = Object.keys(chat.participants).find((id) => id !== currentUserId);
        if (otherUserId && chat.participantNames[otherUserId]) {
            return chat.participantNames[otherUserId];
        }
    }
    return "Chat";
}

export default function ChatHeaderRTDB({
    chat,
    currentUserId,
    onMenuClick,
    onCallStart,
    onBack,
}: ChatHeaderRTDBProps) {
    const [otherUserStatus, setOtherUserStatus] = useState<{ isOnline: boolean; lastSeen: number } | null>(null);

    const displayName = getChatDisplayName(chat, currentUserId);
    const isGroup = chat.type === "group";
    const { typingUsers } = useTypingIndicator(chat.id);

    // Get other user's online status for direct chats
    useEffect(() => {
        if (isGroup || !currentUserId) return;

        const otherUserId = Object.keys(chat.participants).find((id) => id !== currentUserId);
        if (!otherUserId) return;

        const userRef = ref(rtdb, `users/${otherUserId}`);
        const unsubscribe = onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                setOtherUserStatus({
                    isOnline: data.isOnline || false,
                    lastSeen: data.lastSeen || 0,
                });
            }
        });

        return () => off(userRef);
    }, [chat, currentUserId, isGroup]);

    const getStatusText = () => {
        if (typingUsers.length > 0) {
            return isGroup ? "Someone is typing..." : "typing...";
        }
        if (isGroup) {
            const memberCount = Object.keys(chat.participants).length;
            return `${memberCount} members`;
        }
        if (otherUserStatus?.isOnline) {
            return "online";
        }
        if (otherUserStatus?.lastSeen) {
            const date = new Date(otherUserStatus.lastSeen);
            const now = new Date();
            const diff = now.getTime() - date.getTime();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));

            if (days === 0) {
                return `last seen today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
            } else if (days === 1) {
                return "last seen yesterday";
            } else {
                return `last seen ${date.toLocaleDateString()}`;
            }
        }
        return "";
    };

    return (
        <div className="px-4 py-2.5 bg-chat-header text-white flex items-center gap-3 shadow-sm z-30">
            {/* Mobile Back/Menu Button */}
            {onBack ? (
                <Button variant="ghost" size="icon" className="md:hidden shrink-0 text-white hover:bg-white/10" onClick={onBack}>
                    <ArrowLeft className="h-6 w-6" />
                </Button>
            ) : (
                <Button variant="ghost" size="icon" className="md:hidden shrink-0 text-white hover:bg-white/10" onClick={onMenuClick}>
                    <Menu className="h-6 w-6" />
                </Button>
            )}

            {/* Avatar */}
            <div className="relative shrink-0 cursor-pointer hover:opacity-90 transition-opacity">
                <Avatar className="h-10 w-10 border border-white/10">
                    {chat.icon ? (
                        <AvatarImage src={chat.icon} />
                    ) : (
                        <AvatarFallback className={cn("text-primary-foreground text-white", isGroup ? "bg-chat-avatar" : "bg-white/20")}>
                            {getInitials(displayName)}
                        </AvatarFallback>
                    )}
                </Avatar>
            </div>

            {/* Name & Status */}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {/* Future: Open Profile */ }}>
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-[17px] truncate leading-tight">{displayName}</h2>
                </div>
                <p className="text-[13px] truncate text-white/80 leading-tight">
                    {getStatusText()}
                </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-0.5">
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-white hover:bg-white/10"
                    onClick={() => onCallStart?.("video")}
                >
                    <Video className="h-[22px] w-[22px]" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-white hover:bg-white/10"
                    onClick={() => onCallStart?.("audio")}
                >
                    <Phone className="h-[20px] w-[20px]" />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/10">
                            <MoreVertical className="h-[22px] w-[22px]" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        {isGroup && (
                            <GroupInfoPanel
                                group={chat}
                                trigger={
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <Info className="mr-2 h-4 w-4" />
                                        Group Info
                                    </DropdownMenuItem>
                                }
                            />
                        )}
                        <DropdownMenuItem>
                            <Search className="mr-2 h-4 w-4" />
                            Search
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <VolumeX className="mr-2 h-4 w-4" />
                            Mute notifications
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <Pin className="mr-2 h-4 w-4" />
                            Pin Chat
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Clear Chat
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
