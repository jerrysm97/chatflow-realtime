import imageCompression from "browser-image-compression";

export const compressImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return file;

    const options = {
        maxSizeMB: 1, // Max size 1MB
        maxWidthOrHeight: 1920, // Max dimension 1920px
        useWebWorker: true,
        initialQuality: 0.8,
    };

    try {
        console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        const compressedFile = await imageCompression(file, options);
        console.log(`Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

        // Return compressed file with original name
        return new File([compressedFile], file.name, { type: compressedFile.type });
    } catch (error) {
        console.error("Compression failed:", error);
        return file; // Fallback to original
    }
};

export const generatePlaceholder = async (file: File): Promise<string> => {
    // Generate a very low-res base64 placeholder for blur-up effect if needed
    const options = {
        maxSizeMB: 0.01,
        maxWidthOrHeight: 20,
        useWebWorker: true,
    };
    try {
        const compressed = await imageCompression(file, options);
        return await imageCompression.getDataUrlFromFile(compressed);
    } catch {
        return "";
    }
};
