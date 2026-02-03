import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatArea from "@/components/chat/ChatArea";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Chat() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showSidebar, setShowSidebar] = useState(!roomId);

  const handleSelectRoom = (selectedRoomId: string) => {
    navigate(`/chat/${selectedRoomId}`);
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  const handleBack = () => {
    navigate("/");
    setShowSidebar(true);
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          "h-full border-r transition-all duration-300",
          isMobile
            ? showSidebar
              ? "w-full absolute inset-0 z-10"
              : "hidden"
            : "w-80 lg:w-96 shrink-0"
        )}
      >
        <ChatSidebar
          selectedRoomId={roomId}
          onSelectRoom={handleSelectRoom}
          onMobileClose={() => setShowSidebar(false)}
        />
      </div>

      {/* Chat Area */}
      <div
        className={cn(
          "flex-1 h-full",
          isMobile && showSidebar && "hidden"
        )}
      >
        {roomId ? (
          <ChatArea
            roomId={roomId}
            onBack={handleBack}
            showBackButton={isMobile}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-muted/30">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
              <MessageCircle className="w-12 h-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">ChatApp Web</h2>
            <p className="text-muted-foreground text-center max-w-md px-4">
              Send and receive messages in real-time. Select a conversation to start chatting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
