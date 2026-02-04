import { useState, useRef, useCallback } from "react";

export interface AudioRecorderState {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
    visualizerData: number[];
}

export const useAudioRecorder = () => {
    const [state, setState] = useState<AudioRecorderState>({
        isRecording: false,
        isPaused: false,
        duration: 0,
        visualizerData: [],
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.start(100); // Collect data every 100ms for visualizer if needed
            setState(prev => ({ ...prev, isRecording: true, duration: 0 }));

            timerRef.current = setInterval(() => {
                setState(prev => ({ ...prev, duration: prev.duration + 1 }));
            }, 1000);

        } catch (error) {
            console.error("Error accessing microphone:", error);
            throw error;
        }
    }, []);

    const stopRecording = useCallback((): Promise<File> => {
        return new Promise((resolve, reject) => {
            if (!mediaRecorderRef.current) {
                reject(new Error("No recording in progress"));
                return;
            }

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: "audio/webm" });

                // Cleanup
                streamRef.current?.getTracks().forEach(track => track.stop());
                if (timerRef.current) clearInterval(timerRef.current);

                setState({
                    isRecording: false,
                    isPaused: false,
                    duration: 0,
                    visualizerData: [],
                });

                resolve(audioFile);
            };

            mediaRecorderRef.current.stop();
        });
    }, []);

    const cancelRecording = useCallback(() => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            streamRef.current?.getTracks().forEach(track => track.stop());
            if (timerRef.current) clearInterval(timerRef.current);

            setState({
                isRecording: false,
                isPaused: false,
                duration: 0,
                visualizerData: [],
            });
            audioChunksRef.current = [];
        }
    }, []);

    return {
        ...state,
        startRecording,
        stopRecording,
        cancelRecording,
    };
};
