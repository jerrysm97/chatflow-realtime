import { useState, useRef, useEffect } from "react";
import { useMessages } from "@/hooks/useChat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Smile } from "lucide-react";

interface ChatInputProps {
  roomId: string;
}

export default function ChatInput({ roomId }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { sendMessage } = useMessages(roomId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(message);
      setMessage("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
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

  return (
    <div className="p-3 bg-chat-input border-t">
      <div className="flex items-end gap-2">
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
        />
        <Button
          size="icon"
          className="rounded-full shrink-0 h-11 w-11"
          onClick={handleSend}
          disabled={!message.trim() || sending}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
