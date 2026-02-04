import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioMessageProps {
    url: string;
    isOwn: boolean;
    duration?: number;
}

export default function AudioMessage({ url, isOwn }: AudioMessageProps) {
    const waveformRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [currentTime, setCurrentTime] = useState("0:00");
    const [totalDuration, setTotalDuration] = useState("0:00");

    useEffect(() => {
        if (!waveformRef.current) return;

        wavesurfer.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: isOwn ? "#94a3b8" : "#94a3b8",
            progressColor: isOwn ? "#0ea5e9" : "#0ea5e9",
            cursorWidth: 0,
            barWidth: 2,
            barGap: 3,
            height: 35,
            barRadius: 2,
            url: url,
        });

        wavesurfer.current.on("ready", () => {
            setIsReady(true);
            const duration = wavesurfer.current?.getDuration() || 0;
            setTotalDuration(formatTime(duration));
        });

        wavesurfer.current.on("play", () => setIsPlaying(true));
        wavesurfer.current.on("pause", () => setIsPlaying(false));
        wavesurfer.current.on("finish", () => {
            setIsPlaying(false);
            wavesurfer.current?.seekTo(0);
        });

        wavesurfer.current.on("audioprocess", () => {
            const current = wavesurfer.current?.getCurrentTime() || 0;
            setCurrentTime(formatTime(current));
        });

        return () => {
            wavesurfer.current?.destroy();
        };
    }, [url, isOwn]);

    const handlePlayPause = () => {
        wavesurfer.current?.playPause();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className="flex items-center gap-2 py-1 min-w-[200px] max-w-full">
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "h-10 w-10 shrink-0 rounded-full",
                    isOwn ? "text-primary/80 hover:bg-white/10" : "text-primary hover:bg-muted"
                )}
                onClick={handlePlayPause}
                disabled={!isReady}
            >
                {!isReady ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : isPlaying ? (
                    <Pause className="h-6 w-6 fill-current" />
                ) : (
                    <Play className="h-6 w-6 fill-current ml-1" />
                )}
            </Button>

            <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                <div ref={waveformRef} className="w-full" />
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] opacity-70 font-mono">
                        {isPlaying ? currentTime : totalDuration}
                    </span>
                    <div className="flex gap-1">
                        {/* Playback speed indicator could go here */}
                    </div>
                </div>
            </div>
        </div>
    );
}
