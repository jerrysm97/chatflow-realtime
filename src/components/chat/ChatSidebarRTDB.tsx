import { useState } from "react";
import { useRTDBChats, useRTDBUserSearch, useUserProfile, RTDBChat, RTDBUser } from "@/hooks/useRealtimeDB";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    MessageCircle,
    Plus,
    Search,
    LogOut,
    User,
    Users,
    Loader2,
    Settings,
    Phone,
    Video,
    MoreVertical,
    Check,
    CheckCheck
} from "lucide-react";

// ... (existing imports/code)

function ChatItem({
    chat,
    currentUserId,
    isSelected,
    onClick,
}: {
    chat: RTDBChat;
    currentUserId?: string;
    isSelected: boolean;
    onClick: () => void;
}) {
    const displayName = getChatDisplayName(chat, currentUserId);
    const isGroup = chat.type === "group";
    const unreadCount = chat.unreadCount || 0;
    const hasUnread = unreadCount > 0;
    const isMeLastSender = chat.lastMessageSender === currentUserId;

    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left",
                isSelected && "bg-muted"
            )}
        >
            <div className="relative">
                <Avatar className="h-12 w-12">
                    {chat.icon ? (
                        <AvatarImage src={chat.icon} />
                    ) : (
                        <AvatarFallback className={cn("text-primary-foreground", isGroup ? "bg-chat-avatar" : "bg-primary")}>
                            {getInitials(displayName)}
                        </AvatarFallback>
                    )}
                </Avatar>
                {/* Online Indicator (Optional, if we had it for specific user) */}
                {/* 
                <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-background rounded-full"></div> 
                */}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <p className={cn("truncate text-base", hasUnread ? "font-bold text-foreground" : "font-medium text-foreground")}>
                            {displayName}
                        </p>
                        {isGroup && <Users className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </div>
                    <span className={cn("text-xs", hasUnread ? "text-green-500 font-medium" : "text-muted-foreground")}>
                        {formatTime(chat.lastMessageTime)}
                    </span>
                </div>

                <div className="flex items-center justify-between mt-0.5">
                    <div className="flex items-center gap-1 truncate max-w-[85%]">
                        {isMeLastSender && (
                            <CheckCheck className="h-4 w-4 text-blue-400 shrink-0" /> // Assuming read, or use gray for delivered
                        )}
                        {chat.lastMessage && (
                            <p className={cn("text-sm truncate", hasUnread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                                {chat.lastMessage}
                            </p>
                        )}
                    </div>

                    {hasUnread && (
                        <div className="bg-green-500 text-white text-[10px] font-bold h-5 min-w-[1.25rem] px-1.5 rounded-full flex items-center justify-center">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
}
import { cn } from "@/lib/utils";

interface ChatSidebarRTDBProps {
    selectedChatId?: string;
    onSelectChat: (chatId: string) => void;
    onMobileClose?: () => void;
    filterType?: "direct" | "group";
}

function formatTime(timestamp: number | undefined): string {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
        return "Yesterday";
    } else if (days < 7) {
        return date.toLocaleDateString([], { weekday: "short" });
    } else {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export default function ChatSidebarRTDB({
    selectedChatId,
    onSelectChat,
    onMobileClose,
    filterType,
}: ChatSidebarRTDBProps) {
    const { chats, loading, createChat } = useRTDBChats();
    const { results, searching, searchUsers, clearResults } = useRTDBUserSearch();
    const { user, signOut } = useAuth();
    const [searchQuery, setSearchQuery] = useState("");
    const [userSearchQuery, setUserSearchQuery] = useState("");
    const [newGroupName, setNewGroupName] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [activeTab, setActiveTab] = useState<"direct" | "group">("direct");

    // Initialize user profile
    const { userProfile } = useUserProfile();

    const filteredChats = chats.filter((chat) => {
        if (filterType && chat.type !== filterType) return false;
        const chatName = getChatDisplayName(chat, user?.uid);
        return chatName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const handleUserSearch = () => {
        if (userSearchQuery.trim()) {
            searchUsers(userSearchQuery.trim());
        }
    };

    const handleCreateDirectChat = async (targetUser: RTDBUser) => {
        setCreating(true);
        try {
            const chatId = await createChat("direct", [targetUser.uid]);
            if (chatId) {
                onSelectChat(chatId);
                setDialogOpen(false);
                setUserSearchQuery("");
                clearResults();
                onMobileClose?.();
            }
        } finally {
            setCreating(false);
        }
    };

    const handleCreateGroupChat = async () => {
        if (!newGroupName.trim()) return;
        setCreating(true);
        try {
            const chatId = await createChat("group", [], newGroupName.trim());
            if (chatId) {
                onSelectChat(chatId);
                setDialogOpen(false);
                setNewGroupName("");
                onMobileClose?.();
            }
        } finally {
            setCreating(false);
        }
    };

    const handleDialogClose = (open: boolean) => {
        setDialogOpen(open);
        if (!open) {
            setUserSearchQuery("");
            setNewGroupName("");
            clearResults();
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="p-4 bg-chat-header border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.location.href = '/settings'}>
                        <AvatarImage src={user?.photoURL || ""} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(user?.displayName || user?.email || "U")}
                        </AvatarFallback>
                    </Avatar>
                    <div className="">
                        <h1 className="font-bold text-lg tracking-tight">Titan</h1>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="rounded-full" title="Settings" onClick={() => window.location.href = '/settings'}>
                        <Settings className="h-5 w-5" />
                    </Button>
                    <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <Plus className="h-5 w-5" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>New Chat</DialogTitle>
                            </DialogHeader>
                            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "direct" | "group")} className="pt-4">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="direct" className="gap-2">
                                        <User className="h-4 w-4" />
                                        Direct
                                    </TabsTrigger>
                                    <TabsTrigger value="group" className="gap-2">
                                        <Users className="h-4 w-4" />
                                        Group
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="direct" className="space-y-4 pt-4">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Search by 6-digit ID, name or email"
                                            value={userSearchQuery}
                                            onChange={(e) => setUserSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleUserSearch()}
                                        />
                                        <Button onClick={handleUserSearch} disabled={searching || !userSearchQuery.trim()}>
                                            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        </Button>
                                    </div>

                                    {results.length > 0 && (
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {results.map((result) => (
                                                <button
                                                    key={result.uid}
                                                    onClick={() => handleCreateDirectChat(result)}
                                                    disabled={creating}
                                                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                                                >
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={result.photoURL || ""} />
                                                        <AvatarFallback>{getInitials(result.displayName || "U")}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium truncate">{result.displayName}</p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-mono text-primary">#{result.userId}</span>
                                                            <span className="text-sm text-muted-foreground truncate">{result.email}</span>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            "h-2 w-2 rounded-full",
                                                            result.isOnline ? "bg-green-500" : "bg-gray-400"
                                                        )}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {userSearchQuery && results.length === 0 && !searching && (
                                        <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                                    )}
                                </TabsContent>

                                <TabsContent value="group" className="space-y-4 pt-4">
                                    <Input
                                        placeholder="Group name"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleCreateGroupChat()}
                                    />
                                    <Button onClick={handleCreateGroupChat} className="w-full" disabled={!newGroupName.trim() || creating}>
                                        {creating ? "Creating..." : "Create Group"}
                                    </Button>
                                </TabsContent>
                            </Tabs>
                        </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={signOut}>
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="p-2 bg-muted/30">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search chats"
                        className="pl-10 bg-background border-0"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Chat List */}
            <ScrollArea className="flex-1">
                {loading ? (
                    <div className="p-4 space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-12 w-12 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <MessageCircle className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium text-lg mb-1">No chats yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">Start a new conversation</p>
                        <Button onClick={() => setDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Chat
                        </Button>
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredChats.map((chat) => (
                            <ChatItem
                                key={chat.id}
                                chat={chat}
                                currentUserId={user?.uid}
                                isSelected={chat.id === selectedChatId}
                                onClick={() => {
                                    onSelectChat(chat.id);
                                    onMobileClose?.();
                                }}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
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

