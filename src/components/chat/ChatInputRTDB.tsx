import { useState, useRef, useEffect, useCallback } from "react";
import { useRTDBSendMessage, useTypingIndicator } from "@/hooks/useRealtimeDB";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Smile, Paperclip, X, Loader2, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

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

    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

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

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            toast.error("Could not access microphone");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: "audio/webm" });
                setFiles((prev) => [...prev, audioFile]);
                setIsRecording(false);
                setRecordingTime(0);
                if (timerRef.current) clearInterval(timerRef.current);

                // Stop all tracks to release microphone
                mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
            };
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setRecordingTime(0);
            if (timerRef.current) clearInterval(timerRef.current);
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            audioChunksRef.current = [];
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const handleSend = async () => {
        if ((!message.trim() && files.length === 0) || sending) return;

        try {
            await sendMessage(message, files, onReply || undefined);
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

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [message]);

    return (
        <div className="p-3 pb-safe bg-chat-input border-t flex flex-col gap-2">
            {/* Reply Preview */}
            {onReply && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
                    <div className="flex-1 border-l-2 border-primary pl-2">
                        <p className="font-medium text-primary text-xs">{onReply.senderName}</p>
                        <p className="text-muted-foreground truncate">{onReply.text}</p>
                    </div>
                    <button onClick={onCancelReply} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* File Preview */}
            {files.length > 0 && (
                <div className="flex gap-2 overflow-x-auto py-2 px-1">
                    {files.map((f, i) => (
                        <div
                            key={i}
                            className="relative bg-muted p-2 rounded-lg text-xs flex items-center gap-2 shrink-0"
                        >
                            {f.type.startsWith("image/") ? (
                                <img
                                    src={URL.createObjectURL(f)}
                                    alt={f.name}
                                    className="h-12 w-12 object-cover rounded"
                                />
                            ) : f.type.startsWith("audio/") ? (
                                <div className="h-12 w-12 bg-emerald-100 rounded flex items-center justify-center">
                                    <Mic className="h-5 w-5 text-emerald-600" />
                                </div>
                            ) : (
                                <div className="h-12 w-12 bg-background rounded flex items-center justify-center">
                                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                                </div>
                            )}
                            <div className="flex flex-col max-w-[100px]">
                                <span className="truncate font-medium">{f.name}</span>
                                <span className="text-muted-foreground">{formatFileSize(f.size)}</span>
                            </div>
                            <button
                                onClick={() => removeFile(i)}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-end gap-2">
                {isRecording ? (
                    <div className="flex-1 flex items-center gap-4 bg-muted/50 p-2 rounded-full animate-in fade-in">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse ml-2" />
                        <span className="flex-1 font-mono text-sm">{formatTime(recordingTime)}</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelRecording}
                            className="text-destructive hover:text-destructive"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="icon"
                            className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white h-9 w-9"
                            onClick={stopRecording}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <>
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
                            className="rounded-full shrink-0 text-muted-foreground"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={sending}
                        >
                            <Paperclip className="h-5 w-5" />
                        </Button>

                        <Textarea
                            ref={textareaRef}
                            placeholder="Type a message"
                            className="flex-1 resize-none min-h-[44px] max-h-[120px] py-3 rounded-3xl border-0 bg-background focus-visible:ring-1"
                            value={message}
                            onChange={(e) => {
                                setMessage(e.target.value);
                                handleTyping();
                            }}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            disabled={sending}
                        />

                        {message.trim() || files.length > 0 ? (
                            <Button
                                size="icon"
                                className="rounded-full shrink-0 h-11 w-11"
                                onClick={handleSend}
                                disabled={sending}
                            >
                                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                            </Button>
                        ) : (
                            <Button
                                size="icon"
                                className="rounded-full shrink-0 h-11 w-11 bg-muted hover:bg-muted-foreground/10 text-muted-foreground"
                                onClick={startRecording}
                                disabled={sending}
                            >
                                <Mic className="h-5 w-5" />
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
