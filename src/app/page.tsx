'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Chapter {
  id: number;
  title: string;
  start: string;
  end: string;
  startTime: number;
  endTime: number;
  duration: number;
  thumbnail: string;
}

interface VideoMetadata {
  id: string;
  title: string;
  channel: string;
  views: string;
  date: string;
  duration: string;
  thumbnail: string;
  chapters: Chapter[];
}

interface QualityOption {
  label: string;
  value: string;
  size: string;
  available: boolean;
}

const qualityOptions: QualityOption[] = [
  { label: '4K', value: '2160p', size: '1.2 GB', available: true },
  { label: '1440p', value: '1440p', size: '850 MB', available: true },
  { label: '1080p', value: '1080p', size: '520 MB', available: true },
  { label: '720p', value: '720p', size: '280 MB', available: true },
  { label: '480p', value: '480p', size: '180 MB', available: true },
  { label: '360p', value: '360p', size: '120 MB', available: true }
];

export default function Home() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [videoData, setVideoData] = useState<VideoMetadata | null>(null);
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [downloadFormat, setDownloadFormat] = useState('mp4');
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentDownloadChapter, setCurrentDownloadChapter] = useState('');
  const [downloadPath, setDownloadPath] = useState('');
  const [history, setHistory] = useState<any[]>([]);

  // Helper to format seconds into mm:ss
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Analyze Video Logic
  const analyzeVideo = async () => {
    if (!videoUrl.trim()) return;

    setIsAnalyzing(true);
    setVideoData(null);
    setAnalyzeProgress(0);
    setLoadingText('Connecting to server...');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to analyze video');
      setVideoData(data);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Download Logic
  const startDownload = async () => {
    if (selectedChapters.size === 0 || !videoData) return;

    setIsDownloading(true);
    setDownloadProgress(0);
    setCurrentDownloadChapter('Initializing...');

    const selectedList = videoData.chapters.filter(ch => selectedChapters.has(ch.id));

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoUrl,
          chapters: selectedList,
          format: downloadFormat,
          quality: selectedQuality,
          videoTitle: videoData.title
        }),
      });

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) throw new Error(data.error);

              if (data.status) setCurrentDownloadChapter(data.status);
              if (data.progress !== undefined) setDownloadProgress(data.progress);
              if (data.currentChapter) setCurrentDownloadChapter(`${data.currentChapter}: ${data.status}`);
              if (data.folderPath) setDownloadPath(data.folderPath);

              if (data.progress === 100) {
                addToHistory(selectedList.length);
              }
            } catch (e) {
              console.error('Error parsing SSE:', e);
            }
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Download failed');
      setIsDownloading(false);
    }
  };

  const addToHistory = (count: number) => {
    if (!videoData) return;
    const newItem = {
      title: videoData.title,
      chapters: count,
      thumbnail: videoData.thumbnail,
      timestamp: 'Just now'
    };
    setHistory(prev => [newItem, ...prev]);
  };

  const toggleChapter = (id: number) => {
    const newSelected = new Set(selectedChapters);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedChapters(newSelected);
  };

  const selectAll = () => {
    if (videoData) {
      setSelectedChapters(new Set(videoData.chapters.map(c => c.id)));
    }
  };

  const deselectAll = () => setSelectedChapters(new Set());

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-x-hidden relative text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-800 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
              <i className="fas fa-play text-white text-lg" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="gradient-text">ChapterSplit</span>
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400">
              <i className="fas fa-moon" />
            </button>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400">
              <i className="fas fa-cog" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* URL Input */}
        <section className="mb-8">
          <div className="glass-panel rounded-2xl p-6 md:p-8">
            <label className="block text-sm font-medium text-gray-400 mb-3">YouTube Video URL</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
                />
                <i className="fab fa-youtube absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
              <button
                onClick={analyzeVideo}
                disabled={isAnalyzing}
                className="download-btn px-8 py-3 rounded-xl font-semibold text-white flex items-center justify-center space-x-2 min-w-[140px] disabled:opacity-50"
              >
                <i className={`fas ${isAnalyzing ? 'fa-spinner fa-spin' : 'fa-search'}`} />
                <span>{isAnalyzing ? 'Analyzing...' : 'Analyze'}</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">Supports: youtube.com, youtu.be, youtube.com/shorts</p>
          </div>
        </section>

        {/* Loading State */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="glass-panel rounded-2xl p-8 text-center">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <svg className="progress-ring w-20 h-20" viewBox="0 0 80 80">
                    <circle className="text-gray-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="36" cx="40" cy="40" />
                    <motion.circle
                      className="progress-ring-circle text-red-500"
                      strokeWidth="4"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="36" cx="40" cy="40"
                      strokeDasharray={226.19}
                      animate={{ strokeDashoffset: 226.19 - (226.19 * analyzeProgress) / 100 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-spinner fa-spin text-red-500 text-xl" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-1">Analyzing Video...</h3>
                <p className="text-gray-400 text-sm">{loadingText}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Content */}
        {videoData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Video Header Card */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row gap-6">
              <div className="relative w-full md:w-64 aspect-video rounded-xl overflow-hidden bg-black flex-shrink-0 group">
                <img src={videoData.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-medium">
                  {videoData.duration}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl md:text-2xl font-bold mb-2 line-clamp-2">{videoData.title}</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-400 mb-4">
                  <span className="flex items-center space-x-1">
                    <i className="fas fa-user-circle" />
                    <span>{videoData.channel}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <i className="fas fa-eye" />
                    <span>{videoData.views}</span>
                  </span>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Quality</label>
                  <div className="flex flex-wrap gap-2">
                    {qualityOptions.map((q) => (
                      <button
                        key={q.value}
                        onClick={() => setSelectedQuality(q.value)}
                        className={`quality-badge px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedQuality === q.value ? 'ring-2 ring-red-500 bg-red-500/20' : 'hover:bg-white/10'}`}
                      >
                        {q.label} • {q.size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {['mp4', 'mp3'].map(f => (
                    <label key={f} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="format"
                        checked={downloadFormat === f}
                        onChange={() => setDownloadFormat(f)}
                        className="w-4 h-4 text-red-600 bg-transparent border-gray-600 focus:ring-red-500"
                      />
                      <span className="text-sm">{f.toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Chapters */}
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center space-x-2">
                    <i className="fas fa-list-ul text-red-500" />
                    <span>Chapters</span>
                    <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs">{videoData.chapters.length}</span>
                  </h3>
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={selectAll} className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10">Select All</button>
                  <button onClick={deselectAll} className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10">Deselect All</button>
                </div>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {videoData.chapters.map((ch, idx) => (
                  <div
                    key={ch.id}
                    onClick={() => toggleChapter(ch.id)}
                    className={`chapter-card p-4 rounded-xl border flex items-center cursor-pointer ${selectedChapters.has(ch.id) ? 'selected border-red-500' : 'border-white/5'}`}
                  >
                    <div className={`w-5 h-5 rounded border-2 mr-4 flex items-center justify-center ${selectedChapters.has(ch.id) ? 'bg-red-500 border-red-500' : 'border-white/30'}`}>
                      {selectedChapters.has(ch.id) && <i className="fas fa-check text-[10px]" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm truncate">{ch.title}</h4>
                      <span className="text-xs text-gray-500">{ch.start} - {ch.end} ({formatDuration(ch.duration)})</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-sm text-gray-400">{selectedChapters.size} chapters selected</span>
                <button
                  onClick={startDownload}
                  disabled={selectedChapters.size === 0}
                  className="download-btn px-8 py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  Download Selected
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Download Overlay */}
        <AnimatePresence>
          {isDownloading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <div className="glass-panel rounded-2xl p-8 max-w-md w-full">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
                    <i className="fas fa-cloud-download-alt text-2xl text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">Downloading...</h3>
                  <p className="text-gray-400 text-sm">{currentDownloadChapter}</p>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white font-medium">{downloadProgress}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-red-600 to-red-400"
                      animate={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
                {downloadPath && (
                  <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-xs text-gray-500 mb-1">Saved to:</p>
                    <p className="text-xs font-mono text-gray-300 break-all">{downloadPath}</p>
                  </div>
                )}
                {downloadProgress === 100 ? (
                  <button
                    onClick={() => {
                      setIsDownloading(false);
                      setDownloadPath('');
                    }}
                    className="mt-6 w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold transition-colors"
                  >
                    Done
                  </button>
                ) : (
                  <button
                    onClick={() => setIsDownloading(false)}
                    className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
          <i className="fas fa-history text-gray-400" />
          <span>Recent Downloads</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map((item, idx) => (
            <div key={idx} className="glass-panel rounded-xl p-4 flex items-center space-x-4">
              <img src={item.thumbnail} className="w-16 h-12 rounded bg-gray-800 object-cover" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{item.title}</h4>
                <p className="text-xs text-gray-400">{item.chapters} chapters • {item.timestamp}</p>
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <div className="glass-panel rounded-xl p-6 text-center text-gray-500 text-sm col-span-full">
              No recent downloads
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
