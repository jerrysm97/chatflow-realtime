import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, MoreVertical, Phone, Video } from "lucide-react";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";

interface ChatAreaProps {
  roomId: string;
  onBack?: () => void;
  showBackButton?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ChatArea({ roomId, onBack, showBackButton }: ChatAreaProps) {
  const [roomName, setRoomName] = useState<string>("");

  useEffect(() => {
    const fetchRoom = async () => {
      const roomDoc = await getDoc(doc(db, "chatRooms", roomId));
      if (roomDoc.exists()) {
        setRoomName(roomDoc.data().name || "Chat Room");
      }
    };
    fetchRoom();
  }, [roomId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-chat-header border-b">
        {showBackButton && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-chat-avatar text-primary-foreground">
            {getInitials(roomName || "CR")}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="font-semibold">{roomName}</h2>
          <p className="text-xs text-muted-foreground">Online</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ChatMessages roomId={roomId} />

      {/* Input */}
      <ChatInput roomId={roomId} />
    </div>
  );
}
