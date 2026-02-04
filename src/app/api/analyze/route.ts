import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Execute yt-dlp using spawn to handle large metadata strings without buffer limits
        const metadata = await new Promise<any>((resolve, reject) => {
            const ytDlp = spawn('yt-dlp', ['--dump-json', '--flat-playlist', '--no-warnings', url]);
            let stdout = '';
            let stderr = '';

            ytDlp.stdout.on('data', (data) => stdout += data.toString());
            ytDlp.stderr.on('data', (data) => stderr += data.toString());

            ytDlp.on('close', (code) => {
                if (code === 0) {
                    try {
                        resolve(JSON.parse(stdout));
                    } catch (e) {
                        reject(new Error('Failed to parse yt-dlp output'));
                    }
                } else {
                    reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
                }
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
