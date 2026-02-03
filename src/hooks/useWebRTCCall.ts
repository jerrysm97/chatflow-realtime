import { useState, useEffect, useRef, useCallback } from "react";
import { ref, push, set, onValue, off, remove, onChildAdded, update } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export type CallType = "audio" | "video";
export type CallStatus = "idle" | "calling" | "ringing" | "connected" | "ended";

export interface CallData {
    id: string;
    callerId: string;
    callerName: string;
    callerPhoto?: string;
    receiverId: string;
    receiverName: string;
    type: CallType;
    status: "pending" | "accepted" | "rejected" | "ended" | "missed";
    createdAt: number;
    answeredAt?: number;
    endedAt?: number;
}

export interface CallState {
    status: CallStatus;
    callData: CallData | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isMuted: boolean;
    isVideoOff: boolean;
    callDuration: number;
}

const ICE_SERVERS = {
    iceServers: [
        // STUN server for NAT discovery
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },

        // TURN server for relay (CRITICAL for production)
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
    ],
};

export interface CallState {
    status: CallStatus;
    callData: CallData | null;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isMuted: boolean;
    isVideoOff: boolean;
    callDuration: number;
    connectionState: "new" | "checking" | "connected" | "completed" | "failed" | "disconnected" | "closed";
}

export function useWebRTCCall() {
    const { user } = useAuth();
    const [state, setState] = useState<CallState>({
        status: "idle",
        callData: null,
        localStream: null,
        remoteStream: null,
        isMuted: false,
        isVideoOff: false,
        callDuration: 0,
        connectionState: "new",
    });

    const [isFrontCamera, setIsFrontCamera] = useState(true);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const callIdRef = useRef<string | null>(null);
    const durationInterval = useRef<NodeJS.Timeout | null>(null);

    const cleanup = useCallback(() => {
        // Stop all tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        // Close peer connection
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }

        // Clear duration timer
        if (durationInterval.current) {
            clearInterval(durationInterval.current);
            durationInterval.current = null;
        }

        callIdRef.current = null;

        setState({
            status: "idle",
            callData: null,
            localStream: null,
            remoteStream: null,
            isMuted: false,
            isVideoOff: false,
            callDuration: 0,
            connectionState: "new",
        });
    }, []);

    // Listen for incoming calls
    useEffect(() => {
        if (!user) return;

        const incomingCallsRef = ref(rtdb, `calls/${user.uid}/incoming`);

        const unsubscribe = onChildAdded(incomingCallsRef, async (snapshot) => {
            const callData = snapshot.val() as CallData;

            if (callData && callData.status === "pending" && state.status === "idle") {
                callIdRef.current = snapshot.key;
                setState((prev) => ({
                    ...prev,
                    status: "ringing",
                    callData: { ...callData, id: snapshot.key! },
                }));
            }
        });

        return () => off(incomingCallsRef);
    }, [user, state.status]);

    // Listen for call status changes (Remote Hangup)
    useEffect(() => {
        if (!user || !state.callData?.id) return;

        const callId = state.callData.id;
        // Determine the path to listen to based on who initiated
        const isCaller = state.callData.callerId === user.uid;
        const callPath = isCaller
            ? `calls/${state.callData.receiverId}/incoming/${callId}`
            : `calls/${user.uid}/incoming/${callId}`;

        const callStatusRef = ref(rtdb, callPath);

        const unsubscribe = onValue(callStatusRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (data.status === "ended" || data.status === "rejected") {
                    console.log("Call ended by remote peer");
                    cleanup();
                } else if (data.status === "accepted" && state.status === "calling") {
                    // Ensure we update local state to connected/accepted if we missed it
                    // (Though initiateCall handles this via answer check, this is a backup)
                }
            } else {
                // Call data removed? Treat as ended
                cleanup();
            }
        });

        return () => off(callStatusRef);
    }, [user, state.callData?.id, state.status, cleanup]);

    const getMediaStream = useCallback(async (type: CallType, facingMode: 'user' | 'environment' = 'user') => {
        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: type === "video" ? {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } : false,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = stream;
            setState((prev) => ({ ...prev, localStream: stream }));
            return stream;
        } catch (error) {
            console.error("Error getting media stream:", error);
            throw new Error("Could not access camera/microphone");
        }
    }, []);

    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate && callIdRef.current && user) {
                const candidatesRef = ref(
                    rtdb,
                    `calls/${callIdRef.current}/candidates/${user.uid}`
                );
                push(candidatesRef, event.candidate.toJSON());
            }
        };

        pc.ontrack = (event) => {
            setState((prev) => ({
                ...prev,
                remoteStream: event.streams[0],
            }));
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") {
                setState((prev) => ({ ...prev, status: "connected" }));
                startDurationTimer();
            } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
                endCall();
            }
        };

        pc.oniceconnectionstatechange = () => {
            const connectionState = pc.iceConnectionState;
            console.log("ICE Connection State:", connectionState);

            setState(prev => ({
                ...prev,
                connectionState
            }));

            // Handle connection failures
            if (connectionState === "failed") {
                console.error("ICE connection failed - likely NAT/firewall issue");
                // Attempt to restart ICE
                pc.restartIce();
            }
        };

        peerConnection.current = pc;
        return pc;
    }, [user]);

    const startDurationTimer = useCallback(() => {
        if (durationInterval.current) clearInterval(durationInterval.current);
        durationInterval.current = setInterval(() => {
            setState((prev) => ({ ...prev, callDuration: prev.callDuration + 1 }));
        }, 1000);
    }, []);

    // Helper: Process queued candidates
    const candidateQueue = useRef<RTCIceCandidate[]>([]);

    const processCandidateQueue = useCallback(async () => {
        if (!peerConnection.current || !peerConnection.current.remoteDescription) return;

        while (candidateQueue.current.length > 0) {
            const candidate = candidateQueue.current.shift();
            if (candidate) {
                try {
                    await peerConnection.current.addIceCandidate(candidate);
                } catch (e) {
                    console.error("Error adding queued candidate:", e);
                }
            }
        }
    }, []);

    const handleCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
        if (!peerConnection.current) return;

        const iceCandidate = new RTCIceCandidate(candidate);

        if (peerConnection.current.remoteDescription) {
            try {
                await peerConnection.current.addIceCandidate(iceCandidate);
            } catch (e) {
                console.error("Error adding candidate:", e);
            }
        } else {
            console.log("Queueing candidate (no remote description)");
            candidateQueue.current.push(iceCandidate);
        }
    }, []);

    const initiateCall = useCallback(
        async (receiverId: string, receiverName: string, type: CallType) => {
            if (!user || state.status !== "idle") return;

            try {
                setState((prev) => ({ ...prev, status: "calling" }));

                // Get local media stream
                const stream = await getMediaStream(type);

                // Create peer connection
                const pc = createPeerConnection();

                // Add tracks
                stream.getTracks().forEach((track) => {
                    pc.addTrack(track, stream);
                });

                // Create call data
                const callData: Omit<CallData, "id"> = {
                    callerId: user.uid,
                    callerName: user.displayName || "Unknown",
                    callerPhoto: user.photoURL || null as any,
                    receiverId,
                    receiverName,
                    type,
                    status: "pending",
                    createdAt: Date.now(),
                };

                // Create call in Firebase
                const callsRef = ref(rtdb, `calls/${receiverId}/incoming`);
                const newCallRef = push(callsRef);
                callIdRef.current = newCallRef.key;

                await set(newCallRef, callData);

                // Create offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                // Store offer
                await set(ref(rtdb, `calls/${callIdRef.current}/offer`), {
                    type: offer.type,
                    sdp: offer.sdp,
                });

                setState((prev) => ({
                    ...prev,
                    callData: { ...callData, id: callIdRef.current! },
                }));

                // Listen for answer
                const answerRef = ref(rtdb, `calls/${callIdRef.current}/answer`);
                onValue(answerRef, async (snapshot) => {
                    const answer = snapshot.val();
                    if (answer && pc.signalingState !== "stable") {
                        await pc.setRemoteDescription(new RTCSessionDescription(answer));
                        await processCandidateQueue(); // Process any queued candidates
                    }
                });

                // Listen for ICE candidates from receiver
                const candidatesRef = ref(rtdb, `calls/${callIdRef.current}/candidates/${receiverId}`);
                onChildAdded(candidatesRef, async (snapshot) => {
                    const candidate = snapshot.val();
                    if (candidate) {
                        handleCandidate(candidate);
                    }
                });

            } catch (error) {
                console.error("Error initiating call:", error);
                endCall();
                throw error; // Re-throw so UI can handle it
            }
        },
        [user, state.status, getMediaStream, createPeerConnection, processCandidateQueue, handleCandidate] // Added dependencies
    );

    const answerCall = useCallback(async () => {
        if (!user || !state.callData || state.status !== "ringing") return;

        try {
            // Get local media stream
            const stream = await getMediaStream(state.callData.type);

            // Create peer connection
            const pc = createPeerConnection();

            // Add tracks
            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream);
            });

            // Get offer
            const offerRef = ref(rtdb, `calls/${callIdRef.current}/offer`);
            const offerSnapshot = await new Promise<any>((resolve) => {
                onValue(offerRef, resolve, { onlyOnce: true });
            });
            const offer = offerSnapshot.val();

            if (offer) {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));

                // Create answer
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                // Store answer
                await set(ref(rtdb, `calls/${callIdRef.current}/answer`), {
                    type: answer.type,
                    sdp: answer.sdp,
                });

                // Update call status
                await update(ref(rtdb, `calls/${user.uid}/incoming/${callIdRef.current}`), {
                    status: "accepted",
                    answeredAt: Date.now(),
                });

                // Listen for ICE candidates from caller
                const candidatesRef = ref(
                    rtdb,
                    `calls/${callIdRef.current}/candidates/${state.callData.callerId}`
                );
                onChildAdded(candidatesRef, async (snapshot) => {
                    const candidate = snapshot.val();
                    if (candidate) {
                        handleCandidate(candidate);
                    }
                });

                // Process queue just in case
                await processCandidateQueue();
            }
        } catch (error) {
            console.error("Error answering call:", error);
            endCall();
        }
    }, [user, state.callData, state.status, getMediaStream, createPeerConnection, processCandidateQueue, handleCandidate]);


    const rejectCall = useCallback(async () => {
        if (!user || !callIdRef.current) return;

        await update(ref(rtdb, `calls/${user.uid}/incoming/${callIdRef.current}`), {
            status: "rejected",
            endedAt: Date.now(),
        });

        cleanup();
    }, [user]);

    const endCall = useCallback(async () => {
        if (callIdRef.current && user && state.callData) {
            // Update call status
            const callRef = state.callData.callerId === user.uid
                ? ref(rtdb, `calls/${state.callData.receiverId}/incoming/${callIdRef.current}`)
                : ref(rtdb, `calls/${user.uid}/incoming/${callIdRef.current}`);

            await update(callRef, {
                status: "ended",
                endedAt: Date.now(),
            });
        }

        cleanup();
    }, [user, state.callData]);

    const switchCamera = useCallback(async () => {
        if (!state.localStream) {
            console.error("No local stream available");
            return;
        }

        const videoTrack = state.localStream.getVideoTracks()[0];
        if (!videoTrack) {
            console.error("No video track found");
            return;
        }

        // Determine new facing mode
        const newFacingMode = isFrontCamera ? 'environment' : 'user';

        try {
            // Stop current video track
            videoTrack.stop();

            // Request new stream with new facing mode
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: {
                    facingMode: newFacingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            const newVideoTrack = newStream.getVideoTracks()[0];
            const audioTrack = state.localStream.getAudioTracks()[0];

            // Create new MediaStream with new video and existing audio
            const updatedStream = new MediaStream([newVideoTrack, audioTrack]);

            // Replace video track in peer connection (seamless switch without renegotiation)
            if (peerConnection.current) {
                const sender = peerConnection.current
                    .getSenders()
                    .find(s => s.track?.kind === 'video');

                if (sender) {
                    await sender.replaceTrack(newVideoTrack);
                    console.log("Video track replaced successfully");
                }
            }

            // Update local stream state
            setState(prev => ({
                ...prev,
                localStream: updatedStream
            }));

            // Toggle camera state
            setIsFrontCamera(!isFrontCamera);

        } catch (err) {
            console.error("Failed to switch camera:", err);
            // alert("Unable to switch camera. Please check camera permissions."); // Don't use alert in React
        }
    }, [state.localStream, isFrontCamera]);



    const toggleMute = useCallback(() => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setState((prev) => ({ ...prev, isMuted: !audioTrack.enabled }));
            }
        }
    }, []);

    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setState((prev) => ({ ...prev, isVideoOff: !videoTrack.enabled }));
            }
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    return {
        state,
        initiateCall,
        answerCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        switchCamera,
        isFrontCamera
    };
}

export function formatCallDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
