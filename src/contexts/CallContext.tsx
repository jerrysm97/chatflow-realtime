import { createContext, useContext, ReactNode } from "react";
import { useWebRTCCall, CallState, CallType } from "@/hooks/useWebRTCCall";

interface CallContextType {
    state: CallState;
    initiateCall: (receiverId: string, receiverName: string, type: CallType) => Promise<void>;
    answerCall: () => Promise<void>;
    rejectCall: () => Promise<void>;
    endCall: () => Promise<void>;
    toggleMute: () => void;
    toggleVideo: () => void;
    switchCamera: () => Promise<void>;
    isFrontCamera: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
    const call = useWebRTCCall();

    return (
        <CallContext.Provider value={call}>
            {children}
        </CallContext.Provider>
    );
}

export function useCall() {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error("useCall must be used within a CallProvider");
    }
    return context;
}
