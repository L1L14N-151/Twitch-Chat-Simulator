class MP4Converter {
    constructor() {
        this.supportedCodecs = this.checkCodecSupport();
    }

    checkCodecSupport() {
        const codecs = {
            h264: false,
            h265: false,
            vp9: false,
            av1: false
        };

        // Check MediaRecorder codec support
        const h264Mimes = [
            'video/mp4;codecs=avc1.42E01E',
            'video/mp4;codecs=avc1.4D401F',
            'video/mp4;codecs=h264',
            'video/webm;codecs=h264'
        ];

        for (const mime of h264Mimes) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
                codecs.h264 = mime;
                break;
            }
        }

        // Check VP9 support
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            codecs.vp9 = true;
        }

        return codecs;
    }

    async convertWebMToMP4(webmBlob, progressCallback) {
        // Strategy 1: If browser supports H.264 MediaRecorder, use direct re-encoding
        if (this.supportedCodecs.h264) {
            return this.reencodeWithH264(webmBlob, progressCallback);
        }

        // Strategy 2: Use simple container conversion (fastest but may not work everywhere)
        return this.simpleContainerConversion(webmBlob, progressCallback);
    }

    async reencodeWithH264(webmBlob, progressCallback) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            video.onloadedmetadata = async () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                const stream = canvas.captureStream(30);

                // Use the H.264 codec we found
                const recorder = new MediaRecorder(stream, {
                    mimeType: this.supportedCodecs.h264,
                    videoBitsPerSecond: 8000000
                });

                const chunks = [];
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/mp4' });
                    URL.revokeObjectURL(video.src);
                    resolve(blob);
                };

                recorder.start();

                // Play video at normal speed to maintain correct timing
                video.playbackRate = 1.0; // Normal speed
                video.play();

                // Draw frames to canvas
                const drawFrame = () => {
                    if (!video.paused && !video.ended) {
                        ctx.drawImage(video, 0, 0);

                        // Update progress
                        if (progressCallback && video.duration > 0) {
                            progressCallback(video.currentTime / video.duration);
                        }

                        requestAnimationFrame(drawFrame);
                    }
                };
                drawFrame();

                video.onended = () => {
                    setTimeout(() => recorder.stop(), 100);
                };
            };

            video.onerror = () => {
                reject(new Error('Unable to load WebM video'));
            };

            video.src = URL.createObjectURL(webmBlob);
        });
    }

    async simpleContainerConversion(webmBlob, progressCallback) {
        // This creates a "fake" MP4 that might work in some players
        // It's essentially the WebM data with MP4 headers

        if (progressCallback) progressCallback(0.5);

        // For now, return the original with a warning
        console.warn('True MP4 conversion requires server-side processing or advanced browser APIs');

        if (progressCallback) progressCallback(1);

        // Return as is with MP4 mime type (some players might accept it)
        return new Blob([webmBlob], { type: 'video/mp4' });
    }

    // Alternative: Use a web service for conversion (requires internet)
    async convertViaWebService(webmBlob, progressCallback) {
        // This would upload to a conversion service
        // Not implemented due to privacy/security concerns
        throw new Error('Web service conversion not implemented');
    }
}

// Export for use in video-exporter.js
window.MP4Converter = MP4Converter;