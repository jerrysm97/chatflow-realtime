import { useState, useEffect } from "react";
import { ExternalLink, Loader2, ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LinkPreviewProps {
    url: string;
}

interface PreviewData {
    title: string;
    description: string;
    image: string;
    url: string;
}

export function LinkPreview({ url }: LinkPreviewProps) {
    const [data, setData] = useState<PreviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchPreview = async () => {
            try {
                // Using a public CORS proxy for demo purposes. 
                // In production, this should be your own backend function.
                const encodedUrl = encodeURIComponent(url);
                const response = await fetch(`https://api.allorigins.win/get?url=${encodedUrl}`);
                const json = await response.json();

                if (json.contents) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(json.contents, "text/html");

                    const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                        doc.querySelector('title')?.textContent || "";

                    const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                        doc.querySelector('meta[name="description"]')?.getAttribute('content') || "";

                    const image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || "";

                    if (title || description || image) {
                        // Resolve relative URLs for images
                        let finalImage = image;
                        if (image && !image.startsWith('http')) {
                            const newUrl = new URL(url);
                            finalImage = `${newUrl.protocol}//${newUrl.host}${image.startsWith('/') ? '' : '/'}${image}`;
                        }

                        setData({
                            title,
                            description,
                            image: finalImage,
                            url
                        });
                    } else {
                        setError(true);
                    }
                } else {
                    setError(true);
                }
            } catch (err) {
                console.error("Failed to fetch link preview", err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchPreview();
    }, [url]);

    if (error) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:opacity-80 break-all"
            >
                {url}
            </a>
        );
    }

    if (loading) {
        return <div className="max-w-sm w-full space-y-2 my-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full rounded-md" />
        </div>;
    }

    if (!data) return null;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block my-2 max-w-sm bg-muted/30 border rounded-lg overflow-hidden hover:bg-muted/50 transition-colors group"
        >
            {data.image && (
                <div className="relative h-32 w-full overflow-hidden bg-muted">
                    <img
                        src={data.image}
                        alt={data.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                </div>
            )}
            <div className="p-3">
                <h3 className="font-semibold text-sm line-clamp-1 mb-1 group-hover:text-primary transition-colors">
                    {data.title || url}
                </h3>
                {data.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {data.description}
                    </p>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">{new URL(url).hostname}</span>
                </div>
            </div>
        </a>
    );
}
