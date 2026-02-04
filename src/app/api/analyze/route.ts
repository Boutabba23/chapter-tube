import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { getCookiesPath, cleanupCookies } from '@/lib/cookies';

export async function POST(req: NextRequest) {
    const cookiesPath = getCookiesPath();
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Execute yt-dlp using spawn to handle large metadata strings without buffer limits
        const metadata = await new Promise<any>((resolve, reject) => {
            console.log(`Analyzing URL: ${url}`);

            const args = [
                '--dump-json',
                '--no-playlist', // Ensure we only get one video if it's not explicitly a playlist
                '--no-warnings',
                '--newline',
                url
            ];

            if (cookiesPath) {
                args.unshift('--cookies', cookiesPath);
            }

            const ytDlp = spawn('yt-dlp', args, { shell: true });

            let stdout = '';
            let stderr = '';

            // Set a timeout for the analysis
            const timeout = setTimeout(() => {
                ytDlp.kill();
                reject(new Error('Analysis timed out after 30 seconds. This might be due to a slow connection or yt-dlp hanging.'));
            }, 30000);

            ytDlp.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            ytDlp.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`yt-dlp stderr: ${data.toString()}`);
            });

            ytDlp.on('close', (code) => {
                clearTimeout(timeout);
                console.log(`yt-dlp finished with code ${code}`);
                if (code === 0) {
                    try {
                        resolve(JSON.parse(stdout));
                    } catch (e) {
                        console.error('Failed to parse JSON:', stdout.slice(0, 500));
                        reject(new Error('Failed to parse video metadata. The response from YouTube was unexpected.'));
                    }
                } else {
                    reject(new Error(`yt-dlp failed with code ${code}: ${stderr.slice(-200)}`));
                }
            });

            ytDlp.on('error', (err) => {
                clearTimeout(timeout);
                reject(new Error(`Failed to start yt-dlp: ${err.message}`));
            });
        });

        // Extract relevant info
        const response = {
            id: metadata.id,
            title: metadata.title,
            channel: metadata.uploader || metadata.channel,
            views: metadata.view_count?.toLocaleString() || 'N/A',
            date: metadata.upload_date ? `${metadata.upload_date.slice(0, 4)}-${metadata.upload_date.slice(4, 6)}-${metadata.upload_date.slice(6, 8)}` : 'N/A',
            duration: formatDuration(metadata.duration),
            thumbnail: metadata.thumbnail,
            chapters: (metadata.chapters || []).map((ch: any, index: number) => ({
                id: index + 1,
                title: ch.title,
                start: formatDuration(ch.start_time),
                end: formatDuration(ch.end_time),
                startTime: ch.start_time,
                endTime: ch.end_time,
                duration: ch.end_time - ch.start_time,
                thumbnail: metadata.thumbnail
            }))
        };

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('Analyze Error:', error);
        // Include the specific error message to help the user diagnose issues (e.g. yt-dlp not in PATH)
        return NextResponse.json({
            error: error.message || 'Failed to analyze video',
            details: error.toString()
        }, { status: 500 });
    } finally {
        cleanupCookies(cookiesPath);
    }
}

function formatDuration(seconds: number): string {
    if (!seconds && seconds !== 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}
