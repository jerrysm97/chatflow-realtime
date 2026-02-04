import { useState, useRef, useEffect, useCallback } from "react";
import { useRTDBSendMessage, useTypingIndicator } from "@/hooks/useRealtimeDB";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Smile, Paperclip, X, Loader2, Mic, Trash2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChatInputRTDBProps {
    roomId: string;
    onReply?: { id: string; text: string; senderName: string } | null;
    onCancelReply?: () => void;
}

const ONE_GB = 1024 * 1024 * 1024;

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

export default function ChatInputRTDB({ roomId, onReply, onCancelReply }: ChatInputRTDBProps) {
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const { sendMessage, sending } = useRTDBSendMessage(roomId);
    const { setTyping, clearTyping } = useTypingIndicator(roomId);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { isRecording, duration, startRecording, stopRecording, cancelRecording } = useAudioRecorder();
    const [isDragging, setIsDragging] = useState(false);
    const [dragX, setDragX] = useState(0);
    const CANCEL_THRESHOLD = -100;

    // Handle typing indicator
    const handleTyping = useCallback(() => {
        setTyping();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            clearTyping();
        }, 3000);
    }, [setTyping, clearTyping]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selected = Array.from(e.target.files);
            const validFiles: File[] = [];
            const oversizedFiles: string[] = [];

            selected.forEach((file) => {
                if (file.size > ONE_GB) {
                    oversizedFiles.push(file.name);
                } else {
                    validFiles.push(file);
                }
            });

            if (oversizedFiles.length > 0) {
                toast.error(`Files exceeding 1GB: ${oversizedFiles.join(", ")}`);
            }

            setFiles((prev) => [...prev, ...validFiles]);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const handleSend = async (audioFile?: File) => {
        const currentFiles = audioFile ? [...files, audioFile] : files;
        if ((!message.trim() && currentFiles.length === 0) || sending) return;

        try {
            await sendMessage(message, currentFiles, onReply || undefined);
            setMessage("");
            setFiles([]);
            clearTyping();
            onCancelReply?.();
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Failed to send");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const onMicPress = async () => {
        try {
            await startRecording();
        } catch (err) {
            toast.error("Microphone access denied");
        }
    };

    const onMicRelease = async () => {
        if (dragX <= CANCEL_THRESHOLD) {
            cancelRecording();
            setDragX(0);
        } else {
            try {
                const audioFile = await stopRecording();
                handleSend(audioFile);
                setDragX(0);
            } catch (err) {
                console.error(err);
            }
        }
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [message]);

    return (
        <div className="p-3 pb-safe bg-chat-input border-t flex flex-col gap-2 relative z-40">
            <AnimatePresence>
                {/* Reply Preview */}
                {onReply && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm"
                    >
                        <div className="flex-1 border-l-2 border-primary pl-2">
                            <p className="font-semibold text-primary text-[11px] uppercase tracking-wider">{onReply.senderName}</p>
                            <p className="text-muted-foreground truncate italic text-[13px]">{onReply.text}</p>
                        </div>
                        <button onClick={onCancelReply} className="text-muted-foreground hover:text-foreground p-1">
                            <X className="h-4 w-4" />
                        </button>
                    </motion.div>
                )}

                {/* File Preview */}
                {files.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex gap-2 overflow-x-auto py-2 px-1"
                    >
                        {files.map((f, i) => (
                            <div
                                key={i}
                                className="relative bg-muted p-2 rounded-lg text-xs flex items-center gap-2 shrink-0 border"
                            >
                                {f.type.startsWith("image/") ? (
                                    <img
                                        src={URL.createObjectURL(f)}
                                        alt={f.name}
                                        className="h-12 w-12 object-cover rounded shadow-sm"
                                    />
                                ) : (
                                    <div className="h-12 w-12 bg-background rounded flex items-center justify-center border">
                                        <Paperclip className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex flex-col max-w-[100px]">
                                    <span className="truncate font-medium">{f.name}</span>
                                    <span className="text-muted-foreground">{formatFileSize(f.size)}</span>
                                </div>
                                <button
                                    onClick={() => removeFile(i)}
                                    className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 shadow-sm"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex items-end gap-2 relative">
                <AnimatePresence mode="wait">
                    {isRecording ? (
                        <motion.div
                            key="recording-ui"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex-1 flex items-center justify-between bg-muted/30 p-1.5 rounded-full pr-4"
                        >
                            <div className="flex items-center gap-3">
                                <motion.div
                                    animate={{ opacity: [1, 0] }}
                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                    className="w-2.5 h-2.5 bg-red-500 rounded-full ml-3"
                                />
                                <span className="font-mono text-base font-medium">{formatTime(duration)}</span>
                            </div>

                            <motion.div
                                animate={{ x: [0, -5, 0] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="flex items-center gap-2 text-muted-foreground/60 text-sm select-none pointer-events-none"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                <span>Slide to cancel</span>
                            </motion.div>

                            <div className="w-10" /> {/* Spacer */}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="input-ui"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex items-end gap-2"
                        >
                            <input
                                type="file"
                                multiple
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt"
                            />

                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full shrink-0 text-muted-foreground hover:bg-muted/50"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={sending}
                            >
                                <Paperclip className="h-5 w-5" />
                            </Button>

                            <Textarea
                                ref={textareaRef}
                                placeholder="Message"
                                className="flex-1 resize-none min-h-[44px] max-h-[120px] py-3 px-4 rounded-[22px] border-0 bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20 text-[15px]"
                                value={message}
                                onChange={(e) => {
                                    setMessage(e.target.value);
                                    handleTyping();
                                }}
                                onKeyDown={handleKeyDown}
                                rows={1}
                                disabled={sending}
                            />

                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full shrink-0 text-muted-foreground hover:bg-muted/50"
                                onClick={() => {/* Emoji Picker Toggle */ }}
                                disabled={sending}
                            >
                                <Smile className="h-6 w-6" />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="shrink-0 relative">
                    <AnimatePresence mode="wait">
                        {message.trim() || files.length > 0 ? (
                            <motion.div
                                key="send-btn"
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                            >
                                <Button
                                    size="icon"
                                    className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-md active:scale-95 transition-transform"
                                    onClick={() => handleSend()}
                                    disabled={sending}
                                >
                                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}
                                </Button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="mic-btn"
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                className="relative"
                            >
                                <motion.button
                                    drag="x"
                                    dragConstraints={{ left: -200, right: 0 }}
                                    dragElastic={0.1}
                                    onDrag={(e, info) => setDragX(info.offset.x)}
                                    onDragStart={() => setIsDragging(true)}
                                    onDragEnd={(e, info) => {
                                        setIsDragging(false);
                                        onMicRelease();
                                    }}
                                    onPointerDown={onMicPress}
                                    className={cn(
                                        "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200",
                                        isRecording
                                            ? "bg-primary text-white scale-150 shadow-xl z-50"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    )}
                                >
                                    <Mic className={cn("h-6 w-6", isRecording && "animate-pulse")} />
                                </motion.button>

                                {isRecording && dragX < -20 && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: dragX }}
                                        className="absolute -left-12 top-1/2 -translate-y-1/2 p-2 rounded-full bg-destructive text-white"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

