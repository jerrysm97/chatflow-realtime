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
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-xl flex flex-col h-[100dvh] overflow-hidden">
            {/* Connection Status Indicators */}
            {state.connectionState === "checking" && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-white px-4 py-2 rounded-full text-sm z-50 animate-in fade-in zoom-in">
                    Connecting...
                </div>
            )}

            {state.connectionState === "failed" && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-full text-sm z-50 animate-in fade-in zoom-in">
                    Connection failed - Check your network
                </div>
            )}

            {/* Video Streams */}
            {isVideoCall && state.status === "connected" ? (
                <div className="flex-1 relative min-h-0 bg-black">
                    {/* Remote Video (Full Screen) */}
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />

                    {/* Local Video (PiP) */}
                    <div className="absolute top-4 right-4 w-32 h-48 md:w-40 md:h-56 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 transition-all hover:scale-105">
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
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                                <VideoOff className="w-8 h-8 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // Audio call or waiting state
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                        <Avatar className="w-32 h-32 md:w-40 md:h-40 border-4 border-background shadow-2xl relative z-10">
                            <AvatarImage src={state.callData?.callerPhoto} />
                            <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                                {getInitials(otherUserName)}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{otherUserName}</h2>

                    <p className="text-xl text-muted-foreground font-medium">
                        {state.status === "calling" && "Calling..."}
                        {state.status === "ringing" && "Incoming call..."}
                        {state.status === "connected" && formatCallDuration(state.callDuration)}
                    </p>

                    {state.status === "ringing" && (
                        <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-muted/50 rounded-full">
                            {state.callData?.type === "video" ? (
                                <Video className="w-5 h-5 text-primary" />
                            ) : (
                                <Phone className="w-5 h-5 text-primary" />
                            )}
                            <span className="text-sm font-medium">{state.callData?.type === "video" ? "Video Call" : "Voice Call"}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Controls */}
            <div className="p-6 md:p-8 bg-gradient-to-t from-background/90 via-background/50 to-transparent backdrop-blur-sm">
                <div className="flex items-center justify-center gap-8 max-w-md mx-auto">
                    {/* Incoming Call Controls */}
                    {state.status === "ringing" && (
                        <>
                            <div className="flex flex-col items-center gap-2">
                                <Button
                                    size="lg"
                                    variant="destructive"
                                    className="w-16 h-16 rounded-full shadow-lg hover:scale-110 transition-transform"
                                    onClick={rejectCall}
                                >
                                    <PhoneOff className="w-8 h-8" />
                                </Button>
                                <span className="text-xs font-medium text-muted-foreground">Decline</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <Button
                                    size="lg"
                                    className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg hover:scale-110 transition-transform animate-pulse"
                                    onClick={answerCall}
                                >
                                    <PhoneIncoming className="w-8 h-8" />
                                </Button>
                                <span className="text-xs font-medium text-muted-foreground">Accept</span>
                            </div>
                        </>
                    )}

                    {/* In-Call Controls */}
                    {(state.status === "calling" || state.status === "connected") && (
                        <>
                            <Button
                                size="lg"
                                variant={state.isMuted ? "destructive" : "secondary"}
                                className="w-14 h-14 rounded-full shadow-md"
                                onClick={toggleMute}
                            >
                                {state.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </Button>

                            {isVideoCall && (
                                <>
                                    <Button
                                        size="lg"
                                        variant={state.isVideoOff ? "destructive" : "secondary"}
                                        className="w-14 h-14 rounded-full shadow-md"
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
                                        className="w-14 h-14 rounded-full shadow-md"
                                        title="Switch Camera"
                                    >
                                        <RotateCcw className="h-6 w-6" />
                                    </Button>
                                </>
                            )}

                            <Button
                                size="lg"
                                variant="destructive"
                                className="w-16 h-16 rounded-full shadow-lg hover:scale-105 transition-transform"
                                onClick={endCall}
                            >
                                <PhoneOff className="w-8 h-8" />
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
