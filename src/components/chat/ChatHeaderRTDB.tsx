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
        if (isGroup) {
            const memberCount = Object.keys(chat.participants).length;
            return `${memberCount} members`;
        }
        if (otherUserStatus?.isOnline) {
            return "Online";
        }
        if (otherUserStatus?.lastSeen) {
            const date = new Date(otherUserStatus.lastSeen);
            const now = new Date();
            const diff = now.getTime() - date.getTime();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));

            if (days === 0) {
                return `Last seen today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
            } else if (days === 1) {
                return "Last seen yesterday";
            } else {
                return `Last seen ${date.toLocaleDateString()}`;
            }
        }
        return "";
    };

    return (
        <div className="px-4 py-3 bg-chat-header border-b flex items-center gap-3">
            {/* Mobile Back/Menu Button */}
            {onBack ? (
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            ) : (
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onMenuClick}>
                    <Menu className="h-5 w-5" />
                </Button>
            )}

            {/* Avatar */}
            <Avatar className="h-10 w-10 shrink-0">
                {chat.icon ? (
                    <AvatarImage src={chat.icon} />
                ) : (
                    <AvatarFallback className={cn("text-primary-foreground", isGroup ? "bg-chat-avatar" : "bg-primary")}>
                        {getInitials(displayName)}
                    </AvatarFallback>
                )}
            </Avatar>

            {/* Name & Status */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold truncate">{displayName}</h2>
                    {isGroup && <Users className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
                <p
                    className={cn(
                        "text-xs truncate",
                        otherUserStatus?.isOnline ? "text-green-500" : "text-muted-foreground"
                    )}
                >
                    {getStatusText()}
                </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => onCallStart?.("video")}
                >
                    <Video className="h-5 w-5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => onCallStart?.("audio")}
                >
                    <Phone className="h-5 w-5" />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
                            Mute
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <Pin className="mr-2 h-4 w-4" />
                            Pin Chat
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Chat
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
