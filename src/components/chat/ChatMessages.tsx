import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/hooks/useChat";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Message, Attachment } from "@/types/chat";
import { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { FileIcon, Download, Play } from "lucide-react";

interface ChatMessagesProps {
  roomId: string;
}

function formatMessageTime(timestamp: Timestamp | Date | null): string {
  if (!timestamp) return "Sending...";
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
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
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Handle scroll behavior
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // If user is near bottom (within 100px), enable auto-scroll
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isNearBottom);
    }
  };

  useEffect(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  useEffect(() => {
    // Only auto-scroll if enabled or if it's the very first load
    if (scrollRef.current && (shouldAutoScroll || messages.length === 0)) {
      // Using requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }
        }
      });
    }
  }, [messages, shouldAutoScroll]);

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

  // Use messages directly (already sorted asc)
  const orderedMessages = messages;

  return (
    <ScrollArea className="flex-1 bg-chat-background" ref={scrollRef}>
      <div className="p-4 space-y-4">
        {orderedMessages.map((message, index) => {
          // Check for valid user object, fallback if missing
          const messageUser = message.user || { _id: "unknown", name: "Unknown" };
          const isOwn = messageUser._id === user?.uid;

          const showAvatar =
            !isOwn &&
            (index === 0 ||
              orderedMessages[index - 1]?.user?._id !== messageUser._id);

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

function AttachmentRenderer({ attachment, isOwn }: { attachment: Attachment; isOwn: boolean }) {
  if (attachment.type === 'image') {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-w-full max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }

  if (attachment.type === 'video') {
    return (
      <div className="relative max-w-full">
        <video
          src={attachment.url}
          controls
          className="max-w-full max-h-64 rounded-lg"
        />
      </div>
    );
  }

  // Generic file
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors",
        isOwn ? "bg-white/10 hover:bg-white/20" : "bg-muted hover:bg-muted/80"
      )}
    >
      <div className={cn(
        "h-10 w-10 rounded-lg flex items-center justify-center",
        isOwn ? "bg-white/20" : "bg-primary/10"
      )}>
        <FileIcon className={cn("h-5 w-5", isOwn ? "text-white" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", isOwn ? "text-white" : "")}>
          {attachment.name}
        </p>
        <p className={cn("text-xs", isOwn ? "text-white/70" : "text-muted-foreground")}>
          {formatFileSize(attachment.size)}
        </p>
      </div>
      <Download className={cn("h-4 w-4 shrink-0", isOwn ? "text-white/70" : "text-muted-foreground")} />
    </a>
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
  const hasAttachments = message.attachments && message.attachments.length > 0;
  const hasText = message.text && message.text.trim().length > 0;

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
                {getInitials(message.user?.name || "U")}
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
            {message.user?.name || "Unknown"}
          </p>
        )}

        {/* Render attachments */}
        {hasAttachments && (
          <div className="space-y-2 mb-2">
            {message.attachments!.map((attachment, i) => (
              <AttachmentRenderer key={i} attachment={attachment} isOwn={isOwn} />
            ))}
          </div>
        )}

        {hasText && <p className="break-words">{message.text}</p>}

        <p
          className={cn(
            "text-xs mt-1 text-right",
            isOwn ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {formatMessageTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

