import { useParams, useNavigate } from "react-router-dom";
import ChatLayoutRTDB from "@/components/chat/ChatLayoutRTDB";
import { usePresence } from "@/hooks/useRealtimeDB";

export default function Chat() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // Initialize presence tracking
  usePresence();

  return <ChatLayoutRTDB initialChatId={roomId} />;
}

