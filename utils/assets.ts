import { loadImage, type Image } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const CACHE_DIR = path.join(process.cwd(), ".skport", "cache", "images");

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const memoryCache = new Map<string, Image>();

export async function getRemoteAsset(url: string): Promise<Image | null> {
    if (memoryCache.has(url)) return memoryCache.get(url)!;

    const urlHash = crypto.createHash("md5").update(url).digest("hex");
    const ext = url.split(".").pop()?.split(/[?#]/)[0] || "png";
    const cachePath = path.join(CACHE_DIR, `${urlHash}.${ext}`);

    if (fs.existsSync(cachePath)) {
        try {
            const img = await loadImage(fs.readFileSync(cachePath));
            memoryCache.set(url, img);
            return img;
        } catch {
            fs.unlinkSync(cachePath);
        }
    }

    try {
        ak.Logger.debug(`Fetching remote asset: ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(cachePath, buffer);

        const img = await loadImage(buffer);
        memoryCache.set(url, img);
        return img;
    } catch (error) {
        ak.Logger.error(`Failed to fetch remote asset: ${url}`, error);
        return null;
    }
}
