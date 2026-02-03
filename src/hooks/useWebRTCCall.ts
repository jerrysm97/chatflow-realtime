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
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
    ],
};

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
    });

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const callIdRef = useRef<string | null>(null);
    const durationInterval = useRef<NodeJS.Timeout | null>(null);

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

    const getMediaStream = useCallback(async (type: CallType) => {
        try {
            const constraints = {
                audio: true,
                video: type === "video",
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

        peerConnection.current = pc;
        return pc;
    }, [user]);

    const startDurationTimer = useCallback(() => {
        if (durationInterval.current) clearInterval(durationInterval.current);
        durationInterval.current = setInterval(() => {
            setState((prev) => ({ ...prev, callDuration: prev.callDuration + 1 }));
        }, 1000);
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

                // Add tracks to peer connection
                stream.getTracks().forEach((track) => {
                    pc.addTrack(track, stream);
                });

                // Create call data
                const callData: Omit<CallData, "id"> = {
                    callerId: user.uid,
                    callerName: user.displayName || "Unknown",
                    callerPhoto: user.photoURL || undefined,
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
                    }
                });

                // Listen for ICE candidates from receiver
                const candidatesRef = ref(rtdb, `calls/${callIdRef.current}/candidates/${receiverId}`);
                onChildAdded(candidatesRef, async (snapshot) => {
                    const candidate = snapshot.val();
                    if (candidate && pc.remoteDescription) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                });

            } catch (error) {
                console.error("Error initiating call:", error);
                endCall();
            }
        },
        [user, state.status, getMediaStream, createPeerConnection]
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
                    if (candidate && pc.remoteDescription) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                });
            }
        } catch (error) {
            console.error("Error answering call:", error);
            endCall();
        }
    }, [user, state.callData, state.status, getMediaStream, createPeerConnection]);

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
        });
    }, []);

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
    };
}

export function formatCallDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
