import { useEffect, useRef } from "react";
import { formatCallDuration, CallType } from "@/hooks/useWebRTCCall";
import { useCall } from "@/contexts/CallContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Phone,
    PhoneOff,
    Video,
    VideoOff,
    Mic,
    MicOff,
    RotateCcw,
    PhoneIncoming,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CallUIProps {
    onClose?: () => void;
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

export default function CallUI({ onClose }: CallUIProps) {
    const {
        state,
        answerCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        switchCamera,
    } = useCall();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Attach streams to video elements
    useEffect(() => {
        if (localVideoRef.current && state.localStream) {
            localVideoRef.current.srcObject = state.localStream;
        }
    }, [state.localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && state.remoteStream) {
            remoteVideoRef.current.srcObject = state.remoteStream;
        }
    }, [state.remoteStream]);

    if (state.status === "idle") {
        return null;
    }

    const isVideoCall = state.callData?.type === "video";
    const otherUserName = state.callData?.callerName || state.callData?.receiverName || "Unknown";

    return (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col h-[100dvh] overflow-hidden">
            {/* Connection Status Indicators */}
            {state.connectionState === "checking" && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-white px-4 py-2 rounded-full text-sm z-50">
                    Connecting...
                </div>
            )}

            {state.connectionState === "failed" && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-full text-sm z-50">
                    Connection failed - Check your network
                </div>
            )}

            {/* Video Streams */}
            {isVideoCall && state.status === "connected" ? (
                <div className="flex-1 relative min-h-0">
                    {/* Remote Video (Full Screen) */}
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />

                    {/* Local Video (PiP) */}
                    <div className="absolute top-4 right-4 w-32 h-48 md:w-40 md:h-56 rounded-lg overflow-hidden shadow-lg border-2 border-white/20">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className={cn(
                                "w-full h-full object-cover mirror", // Added mirror class
                                state.isVideoOff && "hidden"
                            )}
                        />
                        {state.isVideoOff && (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                <VideoOff className="w-8 h-8 text-gray-500" />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // Audio call or waiting state
                <div className="flex-1 flex flex-col items-center justify-center">
                    <Avatar className="w-32 h-32 mb-6">
                        <AvatarImage src={state.callData?.callerPhoto} />
                        <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                            {getInitials(otherUserName)}
                        </AvatarFallback>
                    </Avatar>

                    <h2 className="text-2xl font-semibold text-white mb-2">{otherUserName}</h2>

                    <p className="text-lg text-gray-400">
                        {state.status === "calling" && "Calling..."}
                        {state.status === "ringing" && "Incoming call..."}
                        {state.status === "connected" && formatCallDuration(state.callDuration)}
                    </p>

                    {state.status === "ringing" && (
                        <div className="flex items-center gap-2 mt-2">
                            {/* isVideoCall logic is tricky here because callData might be partial. 
                                It's safer to rely on callData.type 
                            */}
                            {state.callData?.type === "video" ? (
                                <Video className="w-5 h-5 text-gray-400" />
                            ) : (
                                <Phone className="w-5 h-5 text-gray-400" />
                            )}
                            <span className="text-gray-400">{state.callData?.type === "video" ? "Video Call" : "Voice Call"}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Controls */}
            <div className="p-4 pb-8 md:p-8 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-center gap-6">
                    {/* Incoming Call Controls */}
                    {state.status === "ringing" && (
                        <>
                            <Button
                                size="lg"
                                variant="destructive"
                                className="w-16 h-16 rounded-full"
                                onClick={rejectCall}
                            >
                                <PhoneOff className="w-7 h-7" />
                            </Button>
                            <Button
                                size="lg"
                                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600"
                                onClick={answerCall}
                            >
                                <PhoneIncoming className="w-7 h-7" />
                            </Button>
                        </>
                    )}

                    {/* In-Call Controls */}
                    {(state.status === "calling" || state.status === "connected") && (
                        <>
                            <Button
                                size="lg"
                                variant={state.isMuted ? "destructive" : "secondary"}
                                className="w-14 h-14 rounded-full"
                                onClick={toggleMute}
                            >
                                {state.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </Button>

                            {isVideoCall && (
                                <>
                                    <Button
                                        size="lg"
                                        variant={state.isVideoOff ? "destructive" : "secondary"}
                                        className="w-14 h-14 rounded-full"
                                        onClick={toggleVideo}
                                    >
                                        {state.isVideoOff ? (
                                            <VideoOff className="w-6 h-6" />
                                        ) : (
                                            <Video className="w-6 h-6" />
                                        )}
                                    </Button>

                                    <Button
                                        variant="secondary"
                                        size="icon"
                                        onClick={() => switchCamera()}
                                        className="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 text-white"
                                        title="Switch Camera"
                                    >
                                        <RotateCcw className="h-6 w-6" />
                                    </Button>
                                </>
                            )}

                            <Button
                                size="lg"
                                variant="destructive"
                                className="w-16 h-16 rounded-full"
                                onClick={endCall}
                            >
                                <PhoneOff className="w-7 h-7" />
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// Compact incoming call notification
export function IncomingCallNotification({
    callerName,
    callerPhoto,
    callType,
    onAnswer,
    onReject,
}: {
    callerName: string;
    callerPhoto?: string;
    callType: CallType;
    onAnswer: () => void;
    onReject: () => void;
}) {
    return (
        <div className="fixed top-4 right-4 z-50 bg-background border rounded-xl shadow-2xl p-4 w-80 animate-in slide-in-from-top">
            <div className="flex items-center gap-3 mb-4">
                <Avatar className="w-12 h-12">
                    <AvatarImage src={callerPhoto} />
                    <AvatarFallback>{getInitials(callerName)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{callerName}</p>
                    <p className="text-sm text-muted-foreground">
                        {callType === "video" ? "Video Call" : "Voice Call"}
                    </p>
                </div>
            </div>
            <div className="flex gap-2">
                <Button variant="destructive" className="flex-1" onClick={onReject}>
                    <PhoneOff className="mr-2 h-4 w-4" />
                    Decline
                </Button>
                <Button className="flex-1 bg-green-500 hover:bg-green-600" onClick={onAnswer}>
                    <Phone className="mr-2 h-4 w-4" />
                    Answer
                </Button>
            </div>
        </div>
    );
}
