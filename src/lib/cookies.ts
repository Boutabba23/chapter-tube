import fs from 'fs';
import path from 'path';
import os from 'os';

export function getCookiesPath(): string | null {
    const cookiesContent = process.env.YT_COOKIES;
    if (!cookiesContent) return null;

    // Create a temporary file for cookies
    const tempDir = os.tmpdir();
    const cookiesPath = path.join(tempDir, `cookies_${Date.now()}.txt`);

    try {
        fs.writeFileSync(cookiesPath, cookiesContent);
        return cookiesPath;
    } catch (error) {
        console.error('Failed to write temporary cookies file:', error);
        return null;
    }
}

export function cleanupCookies(cookiesPath: string | null) {
    if (cookiesPath && fs.existsSync(cookiesPath)) {
        try {
            fs.unlinkSync(cookiesPath);
        } catch (error) {
            console.error('Failed to delete temporary cookies file:', error);
        }
    }
}
