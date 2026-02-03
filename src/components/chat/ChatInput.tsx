import { useState, useRef, useEffect } from "react";
import { useSendMessage } from "@/hooks/useChat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Smile, Paperclip, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ChatInputProps {
  roomId: string;
}

const ONE_GB = 1024 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export default function ChatInput({ roomId }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const { sendMessage, uploading } = useSendMessage(roomId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const validFiles: File[] = [];
      const oversizedFiles: string[] = [];

      selected.forEach(file => {
        if (file.size > ONE_GB) {
          oversizedFiles.push(file.name);
        } else {
          validFiles.push(file);
        }
      });

      if (oversizedFiles.length > 0) {
        toast.error(`Files exceeding 1GB limit: ${oversizedFiles.join(", ")}`);
      }

      setFiles(prev => [...prev, ...validFiles]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!message.trim() && files.length === 0) || sending) return;

    setSending(true);
    try {
      await sendMessage(message, files);
      setMessage("");
      setFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [message]);

  const isUploading = uploading || sending;

  return (
    <div className="p-3 bg-chat-input border-t flex flex-col gap-2">
      {/* File Preview Area */}
      {files.length > 0 && (
        <div className="flex gap-2 overflow-x-auto py-2 px-1">
          {files.map((f, i) => (
            <div
              key={i}
              className="relative bg-muted p-2 rounded-lg text-xs flex items-center gap-2 shrink-0"
            >
              {f.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(f)}
                  alt={f.name}
                  className="h-12 w-12 object-cover rounded"
                />
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
        {/* Hidden File Input */}
        <input
          type="file"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,video/*,.pdf,.doc,.docx,.zip,.txt"
        />

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full shrink-0 text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full shrink-0 text-muted-foreground"
        >
          <Smile className="h-5 w-5" />
        </Button>

        <Textarea
          ref={textareaRef}
          placeholder="Type a message"
          className="flex-1 resize-none min-h-[44px] max-h-[120px] py-3 rounded-3xl border-0 bg-background focus-visible:ring-1"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isUploading}
        />

        <Button
          size="icon"
          className="rounded-full shrink-0 h-11 w-11"
          onClick={handleSend}
          disabled={(!message.trim() && files.length === 0) || isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}

