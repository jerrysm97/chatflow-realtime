import { X, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface MediaLightboxProps {
    url: string;
    isOpen: boolean;
    onClose: () => void;
    fileName?: string;
}

export default function MediaLightbox({ url, isOpen, onClose, fileName }: MediaLightboxProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 text-white z-10">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium truncate max-w-[200px]">
                            {fileName || "Photo"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 rounded-full"
                            onClick={() => window.open(url, "_blank")}
                        >
                            <Download className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/10 rounded-full"
                            onClick={onClose}
                        >
                            <X className="h-6 w-6" />
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                    <TransformWrapper
                        initialScale={1}
                        initialPositionX={0}
                        initialPositionY={0}
                        centerOnInit={true}
                    >
                        {({ zoomIn, zoomOut, resetTransform }) => (
                            <>
                                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 z-10">
                                    <button onClick={() => zoomIn()} className="text-white/80 hover:text-white transition-colors">
                                        <ZoomIn className="h-5 w-5" />
                                    </button>
                                    <button onClick={() => zoomOut()} className="text-white/80 hover:text-white transition-colors">
                                        <ZoomOut className="h-5 w-5" />
                                    </button>
                                    <button onClick={() => resetTransform()} className="text-white/80 hover:text-white transition-colors">
                                        <RotateCcw className="h-5 w-5" />
                                    </button>
                                </div>
                                <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <motion.img
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        src={url}
                                        alt="Fullscreen"
                                        className="max-w-full max-h-full object-contain select-none"
                                    />
                                </TransformComponent>
                            </>
                        )}
                    </TransformWrapper>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
