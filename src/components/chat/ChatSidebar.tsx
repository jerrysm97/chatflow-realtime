import { useState } from "react";
import { useChatRooms, useUserSearch } from "@/hooks/useChat";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { MessageCircle, Plus, Search, LogOut, User, Users, Loader2 } from "lucide-react";
import { ChatRoom, AuthUser } from "@/types/chat";
import { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  selectedRoomId?: string;
  onSelectRoom: (roomId: string) => void;
  onMobileClose?: () => void;
}

function formatTime(timestamp: Timestamp | Date | undefined): string {
  if (!timestamp) return "";
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
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

export default function ChatSidebar({
  selectedRoomId,
  onSelectRoom,
  onMobileClose,
}: ChatSidebarProps) {
  const { rooms, loading, createRoom } = useChatRooms();
  const { searchUsers, searchResults, searching, createDirectChat, clearSearch } = useUserSearch();
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"group" | "direct">("direct");

  const filteredRooms = rooms.filter((room) => {
    const roomName = getRoomDisplayName(room, user?.uid);
    return roomName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      const roomId = await createRoom(newRoomName.trim(), 'group');
      if (roomId) {
        onSelectRoom(roomId);
        setNewRoomName("");
        setDialogOpen(false);
        onMobileClose?.();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUserSearch = () => {
    if (userSearchQuery.trim()) {
      searchUsers(userSearchQuery.trim());
    }
  };

  const handleCreateDirectChat = async (targetUser: AuthUser) => {
    setCreating(true);
    try {
      const roomId = await createDirectChat(targetUser);
      if (roomId) {
        onSelectRoom(roomId);
        setUserSearchQuery("");
        clearSearch();
        setDialogOpen(false);
        onMobileClose?.();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSelectRoom = (roomId: string) => {
    onSelectRoom(roomId);
    onMobileClose?.();
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setUserSearchQuery("");
      clearSearch();
      setNewRoomName("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 bg-chat-header border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(user?.displayName || user?.email || "U")}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:block">
            <p className="font-medium text-sm">
              {user?.displayName || user?.email?.split("@")[0]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "group" | "direct")} className="pt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="direct" className="gap-2">
                    <User className="h-4 w-4" />
                    Direct Message
                  </TabsTrigger>
                  <TabsTrigger value="group" className="gap-2">
                    <Users className="h-4 w-4" />
                    Group Chat
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="direct" className="space-y-4 pt-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter email address"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUserSearch()}
                    />
                    <Button onClick={handleUserSearch} disabled={searching || !userSearchQuery.trim()}>
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={result.uid}
                          onClick={() => handleCreateDirectChat(result)}
                          disabled={creating}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {getInitials(result.displayName || result.email || "U")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {result.displayName || result.email?.split("@")[0]}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {result.email}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {userSearchQuery && searchResults.length === 0 && !searching && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No users found with that email
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="group" className="space-y-4 pt-4">
                  <Input
                    placeholder="Group name"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                  />
                  <Button
                    onClick={handleCreateRoom}
                    className="w-full"
                    disabled={!newRoomName.trim() || creating}
                  >
                    {creating ? "Creating..." : "Create Group"}
                  </Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 bg-muted/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations"
            className="pl-10 bg-background border-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Rooms List */}
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
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg mb-1">No conversations yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start a new chat to get connected
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {filteredRooms.map((room) => (
              <RoomItem
                key={room.id}
                room={room}
                currentUserId={user?.uid}
                isSelected={room.id === selectedRoomId}
                onClick={() => handleSelectRoom(room.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function getRoomDisplayName(room: ChatRoom, currentUserId?: string): string {
  if (room.type === 'direct' && room.participantNames && currentUserId) {
    // Find the other participant's name
    const otherParticipantId = room.participants.find(id => id !== currentUserId);
    if (otherParticipantId && room.participantNames[otherParticipantId]) {
      return room.participantNames[otherParticipantId];
    }
  }
  return room.name || "Chat";
}

function RoomItem({
  room,
  currentUserId,
  isSelected,
  onClick,
}: {
  room: ChatRoom;
  currentUserId?: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const displayName = getRoomDisplayName(room, currentUserId);
  const isDirect = room.type === 'direct';

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left",
        isSelected && "bg-muted"
      )}
    >
      <Avatar className="h-12 w-12">
        <AvatarFallback className={cn(
          "text-primary-foreground",
          isDirect ? "bg-primary" : "bg-chat-avatar"
        )}>
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <p className="font-medium truncate">{displayName}</p>
            {!isDirect && <Users className="h-3 w-3 text-muted-foreground shrink-0" />}
          </div>
          {room.lastMessage?.createdAt && (
            <span className="text-xs text-muted-foreground">
              {formatTime(room.lastMessage.createdAt)}
            </span>
          )}
        </div>
        {room.lastMessage && (
          <p className="text-sm text-muted-foreground truncate">
            {room.lastMessage.text}
          </p>
        )}
      </div>
    </button>
  );
}

