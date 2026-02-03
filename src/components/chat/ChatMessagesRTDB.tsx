import { useEffect, useRef, useState, useCallback } from "react";
import { useRTDBMessages, useMessageActions, useTypingIndicator, RTDBMessage } from "@/hooks/useRealtimeDB";
import { LinkPreview } from "./LinkPreview";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { Reply, Star, Trash2, Copy, Forward, Check, CheckCheck, FileIcon, Download, Smile } from "lucide-react";
import { toast } from "sonner";

interface ChatMessagesRTDBProps {
    roomId: string;
    onReply?: (msg: { id: string; text: string; senderName: string }) => void;
}

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export default function ChatMessagesRTDB({ roomId, onReply }: ChatMessagesRTDBProps) {
    const { messages, loading } = useRTDBMessages(roomId);
    const { markAsRead } = useMessageActions(roomId);
    const { typingUsers } = useTypingIndicator(roomId);
    const { user } = useAuth();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

    // Mark as read when viewing
    useEffect(() => {
        if (roomId && messages.length > 0) {
            markAsRead();
        }
    }, [roomId, messages.length, markAsRead]);

    // Safe message text parser
    const renderMessageText = (text: any): string => {
        // Handle normal string messages
        if (typeof text === 'string') return text;

        // Handle accidentally serialized objects
        if (typeof text === 'object') {
            // Check if it's a timestamp object incorrectly stored in text field
            if (text?.seconds) {
                console.error("Timestamp found in message text field - data structure error");
                return "[Message format error - please resend]";
            }

            // Check if it's a JSON object that needs to be parsed
            if (text?.content) return String(text.content);

            // Last resort: stringify the object for debugging
            try {
                return JSON.stringify(text);
            } catch (e) {
                console.error("Failed to parse message object:", e);
                return "[Unable to display message]";
            }
        }

        // Fallback for any other type
        return String(text);
    };

    const handleScroll = useCallback(() => {
        const scrollContainer = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
        if (!scrollContainer) return;

        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        setShouldAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
    }, []);

    useEffect(() => {
        const scrollContainer = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");

        if (!scrollContainer) {
            return;
        }

        // Capture the element reference for cleanup
        const element = scrollContainer;

        element.addEventListener("scroll", handleScroll);

        // Use the captured reference in cleanup
        return () => {
            element.removeEventListener("scroll", handleScroll);
        };
    }, [handleScroll]);

    // ... (rest of useEffects)

    useEffect(() => {
        if (scrollRef.current && shouldAutoScroll) {
            requestAnimationFrame(() => {
                const scrollContainer = scrollRef.current?.querySelector(
                    "[data-radix-scroll-area-viewport]"
                ) as HTMLElement;
                if (scrollContainer) {
                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                }
            });
        }
    }, [messages, shouldAutoScroll, typingUsers]);

    if (loading) {
        return (
            <div className="flex-1 p-4 space-y-4">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "justify-end" : "")}>
                        {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full" />}
                        <Skeleton className={cn("h-16 rounded-2xl", i % 2 === 0 ? "w-48" : "w-64")} />
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
                    <p className="text-sm text-muted-foreground">Send a message to start the conversation</p>
                </div>
            </div>
        );
    }

    return (
        <ScrollArea className="flex-1 bg-chat-background" ref={scrollRef}>
            <div className="p-4 space-y-2">
                {messages.map((message, index) => {
                    const isOwn = message.senderId === user?.uid;
                    const isFirstInBlock =
                        index === 0 || messages[index - 1]?.senderId !== message.senderId;
                    const isLastInBlock =
                        index === messages.length - 1 || messages[index + 1]?.senderId !== message.senderId;

                    const showAvatar = !isOwn && isFirstInBlock;
                    const showTail = isLastInBlock; // Show tail on the last message of a block

                    return (
                        <MessageBubble
                            key={message.id}
                            message={{ ...message, text: renderMessageText(message.text) }}
                            isOwn={isOwn}
                            showAvatar={showAvatar}
                            showTail={showTail}
                            roomId={roomId}
                            onReply={onReply}
                        />
                    );
                })}

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                    <div className="flex gap-2 items-end">
                        <div className="w-8" />
                        <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-md">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ScrollArea>
    );
}

function MessageBubble({
    message,
    isOwn,
    showAvatar,
    showTail,
    roomId,
    onReply,
}: {
    message: RTDBMessage;
    isOwn: boolean;
    showAvatar: boolean;
    showTail: boolean;
    roomId: string;
    onReply?: (msg: { id: string; text: string; senderName: string }) => void;
}) {
    const { deleteMessage, starMessage, addReaction, removeReaction } = useMessageActions(roomId);
    const { user } = useAuth();
    const isStarred = message.starredBy?.[user?.uid || ""];

    const handleCopy = () => {
        navigator.clipboard.writeText(message.text);
    };

    const handleReply = () => {
        onReply?.({
            id: message.id,
            text: message.text || `${message.type} message`,
            senderName: message.senderName,
        });
    };

    const handleReaction = (emoji: string) => {
        // Toggle reaction
        const hasReacted = message.reactions?.[emoji]?.[user?.uid || ""];

        if (hasReacted) {
            removeReaction(message.id, emoji);
        } else {
            addReaction(message.id, emoji);
        }
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger>
                <div className={cn("flex gap-2 items-end", isOwn ? "justify-end" : "justify-start", "group relative mb-1")}>
                    {!isOwn && (
                        <div className="w-8 shrink-0">
                            {showAvatar && (
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs bg-muted">
                                        {getInitials(message.senderName)}
                                    </AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    )}

                    <div
                        className={cn(
                            "max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-xl shadow-sm relative",
                            isOwn
                                ? "bg-chat-bubble-sent text-white rounded-br-none"
                                : "bg-chat-bubble-received rounded-bl-none",
                            showTail && (isOwn ? "bubble-tail-sent" : "bubble-tail-received")
                        )}
                    >
                        {!isOwn && showAvatar && (
                            <p className="text-xs font-medium text-primary mb-1">{message.senderName}</p>
                        )}

                        {/* Reply Preview */}
                        {message.replyTo && (
                            <div
                                className={cn(
                                    "text-xs mb-2 border-l-2 pl-2 py-1 rounded",
                                    isOwn ? "bg-white/10 border-white/50" : "bg-muted border-primary"
                                )}
                            >
                                <p className={cn("font-medium", isOwn ? "text-white/80" : "text-primary")}>
                                    {message.replyTo.senderName}
                                </p>
                                <p className={cn("truncate", isOwn ? "text-white/60" : "text-muted-foreground")}>
                                    {message.replyTo.text}
                                </p>
                            </div>
                        )}

                        {/* Media Content */}
                        {message.type === "image" && message.mediaURL && (
                            <a href={message.mediaURL} target="_blank" rel="noopener noreferrer">
                                <img
                                    src={message.mediaURL}
                                    alt="Image"
                                    className="max-w-full max-h-64 rounded-lg object-cover mb-2 cursor-pointer hover:opacity-90"
                                />
                            </a>
                        )}

                        {message.type === "video" && message.mediaURL && (
                            <video src={message.mediaURL} controls className="max-w-full max-h-64 rounded-lg mb-2" />
                        )}

                        {message.type === "audio" && message.mediaURL && (
                            <audio src={message.mediaURL} controls className="w-full mb-2" />
                        )}

                        {message.type === "document" && message.mediaURL && (
                            <a
                                href={message.mediaURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg mb-2",
                                    isOwn ? "bg-white/10" : "bg-muted"
                                )}
                            >
                                <FileIcon className={cn("h-8 w-8", isOwn ? "text-white" : "text-primary")} />
                                <div className="flex-1 min-w-0">
                                    <p className={cn("text-sm font-medium truncate", isOwn && "text-white")}>
                                        {message.mediaName}
                                    </p>
                                    <p className={cn("text-xs", isOwn ? "text-white/70" : "text-muted-foreground")}>
                                        {formatFileSize(message.mediaSize || 0)}
                                    </p>
                                </div>
                                <Download className={cn("h-4 w-4", isOwn ? "text-white/70" : "text-muted-foreground")} />
                            </a>
                        )}

                        {/* Text Content */}
                        {message.text && (
                            <div className="break-words">
                                {message.text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => (
                                    part.match(/https?:\/\/[^\s]+/) ? (
                                        <a href={part} key={i} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">
                                            {part}
                                        </a>
                                    ) : (
                                        <span key={i}>{part}</span>
                                    )
                                ))}
                            </div>
                        )}

                        {/* Link Preview (only for the first link found) */}
                        {message.text && (() => {
                            const match = message.text.match(/(https?:\/\/[^\s]+)/);
                            if (match) {
                                return <LinkPreview url={match[0]} />;
                            }
                            return null;
                        })()}

                        {/* Reactions Display */}
                        {message.reactions && Object.keys(message.reactions).length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                                {Object.entries(message.reactions).map(([emoji, users]) => (
                                    <span key={emoji} className="bg-background/80 rounded-full px-1.5 py-0.5 text-xs border shadow-sm">
                                        {emoji} {Object.keys(users).length > 1 && Object.keys(users).length}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Footer */}
                        <div
                            className={cn(
                                "flex items-center gap-1 mt-1 justify-end text-xs",
                                isOwn ? "text-white/70" : "text-muted-foreground"
                            )}
                        >
                            {isStarred && <Star className="h-3 w-3 fill-current" />}
                            <span>{formatTime(message.timestamp)}</span>
                            {isOwn && (
                                <>
                                    {message.status === "read" ? (
                                        <CheckCheck className="h-4 w-4 text-blue-400" />
                                    ) : message.status === "delivered" ? (
                                        <CheckCheck className="h-4 w-4" />
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onClick={handleReply}>
                    <Reply className="mr-2 h-4 w-4" />
                    Reply
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                </ContextMenuItem>
                <ContextMenuItem onClick={() => starMessage(message.id, !isStarred)}>
                    <Star className={cn("mr-2 h-4 w-4", isStarred && "fill-current")} />
                    {isStarred ? "Unstar" : "Star"}
                </ContextMenuItem>
                <ContextMenuItem>
                    <Smile className="mr-2 h-4 w-4" />
                    React
                </ContextMenuItem>
                {isOwn && (
                    <ContextMenuItem
                        onClick={() => deleteMessage(message.id, true)}
                        className="text-destructive"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete for Everyone
                    </ContextMenuItem>
                )}
                <ContextMenuItem
                    onClick={() => deleteMessage(message.id, false)}
                    className="text-destructive"
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete for Me
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}
