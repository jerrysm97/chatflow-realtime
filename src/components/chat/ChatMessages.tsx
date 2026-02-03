import { useEffect, useRef } from "react";
import { useMessages } from "@/hooks/useChat";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Message } from "@/types/chat";
import { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";

interface ChatMessagesProps {
  roomId: string;
}

function formatMessageTime(timestamp: Timestamp | Date): string {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ChatMessages({ roomId }: ChatMessagesProps) {
  const { messages, loading } = useMessages(roomId);
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={cn("flex gap-2", i % 2 === 0 ? "justify-end" : "")}
          >
            {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full" />}
            <Skeleton
              className={cn(
                "h-16 rounded-2xl",
                i % 2 === 0 ? "w-48" : "w-64"
              )}
            />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chat-background">
        <div className="text-center">
          <p className="text-muted-foreground">No messages yet</p>
          <p className="text-sm text-muted-foreground">
            Send a message to start the conversation
          </p>
        </div>
      </div>
    );
  }

  // Reverse to show oldest first (Firestore query is desc)
  const orderedMessages = [...messages].reverse();

  return (
    <ScrollArea className="flex-1 bg-chat-background" ref={scrollRef}>
      <div className="p-4 space-y-4">
        {orderedMessages.map((message, index) => {
          const isOwn = message.user._id === user?.uid;
          const showAvatar =
            !isOwn &&
            (index === 0 ||
              orderedMessages[index - 1]?.user._id !== message.user._id);

          return (
            <MessageBubble
              key={message._id}
              message={message}
              isOwn={isOwn}
              showAvatar={showAvatar}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
}

function MessageBubble({
  message,
  isOwn,
  showAvatar,
}: {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 items-end",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {!isOwn && (
        <div className="w-8">
          {showAvatar && (
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-muted">
                {getInitials(message.user.name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}
      <div
        className={cn(
          "max-w-[70%] px-4 py-2 rounded-2xl shadow-sm",
          isOwn
            ? "bg-chat-bubble-sent text-white rounded-br-md"
            : "bg-chat-bubble-received rounded-bl-md"
        )}
      >
        {!isOwn && showAvatar && (
          <p className="text-xs font-medium text-primary mb-1">
            {message.user.name}
          </p>
        )}
        <p className="break-words">{message.text}</p>
        <p
          className={cn(
            "text-xs mt-1 text-right",
            isOwn ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {message.createdAt && formatMessageTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
