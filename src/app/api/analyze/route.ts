import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Execute yt-dlp to get metadata in JSON format
        const { stdout } = await execPromise(`yt-dlp --dump-json --flat-playlist "${url}"`);
        const metadata = JSON.parse(stdout);

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
                thumbnail: metadata.thumbnail // Default to video thumbnail for chapters
            }))
        };

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('Analyze Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to analyze video' }, { status: 500 });
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
