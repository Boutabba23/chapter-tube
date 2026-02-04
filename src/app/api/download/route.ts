import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
    const { url, chapters, format, quality, videoTitle } = await req.json();

    if (!url || !chapters || !chapters.length) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendUpdate = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                const sanitizedTitle = (videoTitle || 'Downloaded Video').replace(/[<>:"/\\|?*]/g, '_').trim();
                const downloadDir = path.join(process.cwd(), 'Video', sanitizedTitle);
                if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

                const videoFile = path.join(downloadDir, `full_video.mp4`);

                // 1. Download full video
                sendUpdate({ status: 'Downloading video...', progress: 0 });

                let formatArg = 'bestvideo+bestaudio/best';
                if (format === 'mp3') {
                    formatArg = 'bestaudio/best';
                } else if (quality) {
                    const height = quality.replace('p', '');
                    formatArg = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`;
                }

                const ytDlp = spawn('yt-dlp', [
                    '-f', formatArg,
                    '--merge-output-format', 'mp4',
                    '--newline',
                    '--progress',
                    '-o', videoFile,
                    url
                ]);

                await new Promise((resolve, reject) => {
                    ytDlp.on('error', (err) => reject(new Error(`Failed to start yt-dlp: ${err.message}`)));
                    ytDlp.stdout.on('data', (data) => {
                        const line = data.toString();
                        const match = line.match(/\[download\]\s+(\d+\.\d+)%/);
                        if (match) {
                            const percent = parseFloat(match[1]);
                            sendUpdate({ status: 'Downloading video...', progress: Math.round(percent * 0.7) }); // 70% of total process
                        }
                    });
                    ytDlp.stderr.on('data', (data) => console.log(`yt-dlp stderr: ${data}`));
                    ytDlp.on('close', (code) => code === 0 ? resolve(null) : reject(new Error(`yt-dlp exited with code ${code}`)));
                });

                // 2. Split chapters
                sendUpdate({ status: 'Splitting chapters...', progress: 70 });

                for (let i = 0; i < chapters.length; i++) {
                    const chapter = chapters[i];
                    const chapterTitle = chapter.title.replace(/[<>:"/\\|?*]/g, '_');
                    const ext = format === 'mp3' ? 'mp3' : 'mp4';
                    const outputName = `${(i + 1).toString().padStart(2, '0')} - ${chapterTitle}.${ext}`;
                    const outputPath = path.join(downloadDir, outputName);

                    // Use -ss and -to after -i for better accuracy and format detection
                    const ffmpegArgs = [
                        '-y',
                        '-i', videoFile,
                        '-ss', chapter.startTime.toString(),
                        '-to', chapter.endTime.toString(),
                        '-avoid_negative_ts', 'make_zero'
                    ];

                    if (format === 'mp3') {
                        ffmpegArgs.push('-q:a', '0', '-map', 'a');
                    } else {
                        // Re-encoding might be safer than copy for arbitrary splits/formats
                        // but let's try copy first with better placement.
                        // Actually, if it crashes with code -2, re-encoding might be safer.
                        // Let's use re-encoding to be safe and ensure it works across formats.
                        ffmpegArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-c:a', 'aac');
                    }

                    ffmpegArgs.push(outputPath);

                    sendUpdate({
                        status: `Processing ${chapter.title}...`,
                        progress: 70 + Math.round(((i + 1) / chapters.length) * 30),
                        currentChapter: `Chapter ${i + 1}/${chapters.length}`
                    });

                    await new Promise((resolve, reject) => {
                        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
                        let stderr = '';
                        ffmpeg.on('error', (err) => reject(new Error(`Failed to start ffmpeg: ${err.message}`)));
                        ffmpeg.stderr.on('data', (data) => {
                            stderr += data.toString();
                        });
                        ffmpeg.on('close', (code) => {
                            if (code === 0) {
                                resolve(null);
                            } else {
                                console.error(`ffmpeg error: ${stderr}`);
                                reject(new Error(`ffmpeg exited with code ${code}. Error: ${stderr.slice(-200)}`));
                            }
                        });
                    });
                }

                // 3. Complete
                // Cleanup temp file
                if (fs.existsSync(videoFile)) fs.unlinkSync(videoFile);

                sendUpdate({
                    status: 'Complete!',
                    progress: 100,
                    downloadUrl: `/downloads/${downloadId}`, // This would need a way to serve the files
                    folderPath: downloadDir
                });

                controller.close();
            } catch (error: any) {
                sendUpdate({ error: error.message || 'Download failed' });
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
