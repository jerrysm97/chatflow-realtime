import { useState } from "react";
import { useChatRooms } from "@/hooks/useChat";
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
import { MessageCircle, Plus, Search, LogOut } from "lucide-react";
import { ChatRoom } from "@/types/chat";
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
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      const roomId = await createRoom(newRoomName.trim());
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

  const handleSelectRoom = (roomId: string) => {
    onSelectRoom(roomId);
    onMobileClose?.();
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Chat Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Room name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                />
                <Button
                  onClick={handleCreateRoom}
                  className="w-full"
                  disabled={!newRoomName.trim() || creating}
                >
                  {creating ? "Creating..." : "Create Room"}
                </Button>
              </div>
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
            placeholder="Search or start new chat"
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
              Create a new chat room to get started
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

function RoomItem({
  room,
  isSelected,
  onClick,
}: {
  room: ChatRoom;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left",
        isSelected && "bg-muted"
      )}
    >
      <Avatar className="h-12 w-12">
        <AvatarFallback className="bg-chat-avatar text-primary-foreground">
          {getInitials(room.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-medium truncate">{room.name}</p>
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
