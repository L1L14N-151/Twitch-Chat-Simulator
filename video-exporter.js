class TwitchChatVideoExporter {
    constructor() {
        // MP4 converter instance
        this.mp4converter = null;

        // Active usernames for this video session
        this.activeUsernames = [];

        // Store user profiles (color & badges) for consistency
        this.userProfiles = new Map();

        // Quality presets
        this.qualityPresets = {
            low: {
                width: 1280,
                height: 720,
                fps: 24,
                bitrate: 2000000 // 2 Mbps
            },
            medium: {
                width: 1920,
                height: 1080,
                fps: 30,
                bitrate: 8000000 // 8 Mbps
            },
            high: {
                width: 1920,
                height: 1080,
                fps: 60,
                bitrate: 16000000 // 16 Mbps
            },
            ultra: {
                width: 2560,
                height: 1440,
                fps: 60,
                bitrate: 24000000 // 24 Mbps
            },
            '4k': {
                width: 3840,
                height: 2160,
                fps: 30,
                bitrate: 40000000 // 40 Mbps
            }
        };

        // Default settings
        this.quality = 'medium';
        this.width = 1920;
        this.height = 1080;
        this.fps = 30;
        this.bitrate = 8000000;
        this.duration = 60; // Default 60 seconds
        this.messagesPerSecond = 1;
        this.maxVisibleMessages = 20;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d');

        this.messages = [];
        this.currentFrame = 0;
        this.totalFrames = this.duration * this.fps;

        // Stable viewer count for the entire video
        this.videoViewerCount = null;

        this.isExporting = false;
        this.abortController = null;

        // Image caches
        this.badgeImages = new Map();
        this.emoteImages = new Map();
        this.imageLoadPromises = [];

        // UI elements
        this.exportBtn = document.getElementById('export-btn');
        this.exportSettingsModal = document.getElementById('export-settings-modal');
        this.exportModal = document.getElementById('export-modal');
        this.exportProgress = document.getElementById('export-progress');
        this.exportStatus = document.getElementById('export-status');
        this.cancelBtn = document.getElementById('cancel-export');
        this.startExportBtn = document.getElementById('start-export-btn');
        this.cancelSettingsBtn = document.getElementById('cancel-export-settings');

        this.initEventListeners();
        this.loadFonts();
    }

    loadFonts() {
        // Preload fonts for consistent rendering including emoji support
        this.ctx.font = '18px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Inter, -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.fillText('', 0, 0);

        // Preload emojis to ensure they render properly
        const testEmojis = ['😂', '🔥', '💯', '👀', '🎮', '❤️', '💜', '💚', '💙', '🤖'];
        testEmojis.forEach(emoji => {
            this.ctx.fillText(emoji, -100, -100); // Draw off-screen to preload
        });

        // Add roundRect polyfill if not available
        if (!this.ctx.roundRect) {
            CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
                const r = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
                this.beginPath();
                this.moveTo(x + r[0], y);
                this.lineTo(x + width - r[1], y);
                this.quadraticCurveTo(x + width, y, x + width, y + r[1]);
                this.lineTo(x + width, y + height - r[2]);
                this.quadraticCurveTo(x + width, y + height, x + width - r[2], y + height);
                this.lineTo(x + r[3], y + height);
                this.quadraticCurveTo(x, y + height, x, y + height - r[3]);
                this.lineTo(x, y + r[0]);
                this.quadraticCurveTo(x, y, x + r[0], y);
                this.closePath();
                return this;
            };
        }
    }

    initEventListeners() {
        this.exportBtn?.addEventListener('click', () => this.showExportSettings());
        this.startExportBtn?.addEventListener('click', () => this.startExport());
        this.cancelBtn?.addEventListener('click', () => this.cancelExport());
        this.cancelSettingsBtn?.addEventListener('click', () => this.hideExportSettings());

        // Duration buttons
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('custom-duration').value = '';
            });
        });

        // Custom duration input
        const customDuration = document.getElementById('custom-duration');
        customDuration?.addEventListener('input', () => {
            if (customDuration.value) {
                document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
            }
        });

        // Quality radio buttons click area
        document.querySelectorAll('.quality-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (e.target.type !== 'radio') {
                    const radio = option.querySelector('input[type="radio"]');
                    if (radio) radio.checked = true;
                }
            });
        });

        // Format radio buttons click area
        document.querySelectorAll('.format-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (e.target.type !== 'radio') {
                    const radio = option.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.checked = true;
                        // Preload FFmpeg if MP4 is selected
                        if (radio.value === 'mp4' && !this.mp4converter) {
                            this.initMP4Converter().then(() => {
                                console.log('MP4 converter ready');
                            });
                        }
                    }
                }
            });
        });
    }

    showExportSettings() {
        if (this.exportSettingsModal) {
            this.exportSettingsModal.style.display = 'flex';
            this.detectBrowserAndShowWarning();
        }
    }

    detectBrowserAndShowWarning() {
        const warningDiv = document.getElementById('browser-warning');
        const warningTitle = document.getElementById('warning-title');
        const warningMessage = document.getElementById('warning-message');
        const mp4Radio = document.getElementById('format-mp4');

        if (!warningDiv) return;

        // Detect browser
        const userAgent = navigator.userAgent.toLowerCase();
        const isFirefox = userAgent.includes('firefox');
        const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
        const isChrome = userAgent.includes('chrome') && !userAgent.includes('edg');
        const isEdge = userAgent.includes('edg');

        if (isFirefox) {
            warningDiv.style.display = 'flex';
            warningDiv.className = 'browser-warning';
            warningTitle.textContent = 'Firefox détecté';
            warningMessage.textContent = 'Export WebM uniquement. La conversion MP4 peut échouer.';

            // Pre-select WebM for Firefox
            const webmRadio = document.getElementById('format-webm');
            if (webmRadio) webmRadio.checked = true;
            if (mp4Radio) {
                mp4Radio.disabled = true;
                const mp4Label = mp4Radio.parentElement.querySelector('label');
                if (mp4Label) {
                    mp4Label.style.opacity = '0.5';
                    mp4Label.style.cursor = 'not-allowed';
                }
            }
        } else if (isSafari) {
            warningDiv.style.display = 'flex';
            warningDiv.className = 'browser-warning error';
            warningTitle.textContent = 'Safari détecté';
            warningMessage.textContent = 'Support très limité. Export WebM basique uniquement.';

            // Pre-select WebM and disable MP4 for Safari
            const webmRadio = document.getElementById('format-webm');
            if (webmRadio) webmRadio.checked = true;
            if (mp4Radio) {
                mp4Radio.disabled = true;
                const mp4Label = mp4Radio.parentElement.querySelector('label');
                if (mp4Label) {
                    mp4Label.style.opacity = '0.5';
                    mp4Label.style.cursor = 'not-allowed';
                }
            }
        } else if (isChrome || isEdge) {
            // Chrome/Edge have full support, hide warning
            warningDiv.style.display = 'none';
            if (mp4Radio) {
                mp4Radio.disabled = false;
                const mp4Label = mp4Radio.parentElement.querySelector('label');
                if (mp4Label) {
                    mp4Label.style.opacity = '1';
                    mp4Label.style.cursor = 'pointer';
                }
            }
        } else {
            // Unknown browser, show generic warning
            warningDiv.style.display = 'flex';
            warningDiv.className = 'browser-warning';
            warningTitle.textContent = 'Navigateur non testé';
            warningMessage.textContent = 'Certaines fonctionnalités peuvent ne pas fonctionner correctement.';
        }
    }

    hideExportSettings() {
        if (this.exportSettingsModal) {
            this.exportSettingsModal.style.display = 'none';
        }
    }

    async startExport() {
        if (this.isExporting) return;

        // Hide settings modal
        this.hideExportSettings();

        // Get duration from settings modal
        const customDurationInput = document.getElementById('custom-duration');
        if (customDurationInput && customDurationInput.value) {
            this.duration = parseInt(customDurationInput.value);
        } else {
            const activeDurationBtn = document.querySelector('.duration-btn.active');
            this.duration = activeDurationBtn ? parseInt(activeDurationBtn.dataset.duration) : 60;
        }

        // Get quality settings
        const qualityRadio = document.querySelector('input[name="quality"]:checked');
        this.quality = qualityRadio ? qualityRadio.value : 'medium';

        // Check if crop to chat is enabled
        const cropToChat = document.getElementById('crop-to-chat')?.checked ?? true;
        this.cropToChat = cropToChat;

        // Apply quality preset
        const preset = this.qualityPresets[this.quality];

        if (cropToChat) {
            // If cropping to chat, set canvas size to chat dimensions
            const widthSlider = document.getElementById('width-slider');
            const heightSlider = document.getElementById('height-slider');
            const responsiveCheckbox = document.getElementById('responsive-checkbox');

            if (responsiveCheckbox?.checked) {
                // For responsive mode, use a standard size
                this.width = Math.min(preset.width, 600);
                this.height = Math.min(preset.height, 800);
            } else {
                // Use the actual chat dimensions
                this.width = widthSlider ? parseInt(widthSlider.value) : 400;
                this.height = heightSlider ? parseInt(heightSlider.value) : 600;
            }
        } else {
            // Use full preset dimensions
            this.width = preset.width;
            this.height = preset.height;
        }

        this.fps = preset.fps;
        this.bitrate = preset.bitrate;

        // Update canvas size
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Get message rate from speed slider
        const speedSlider = document.getElementById('speed-slider');
        const messageDelay = speedSlider ? parseInt(speedSlider.value) : 1000;
        this.messagesPerSecond = 1000 / messageDelay;

        this.totalFrames = this.duration * this.fps;

        this.isExporting = true;
        this.abortController = new AbortController();
        this.messages = [];
        this.currentFrame = 0;

        // Save current chat dimensions for consistent rendering
        const widthSlider = document.getElementById('width-slider');
        const heightSlider = document.getElementById('height-slider');
        this.chatBaseWidth = widthSlider ? parseInt(widthSlider.value) : 400;
        this.chatBaseHeight = heightSlider ? parseInt(heightSlider.value) : 600;
        this.responsiveMode = document.getElementById('responsive-checkbox')?.checked || false;

        // Show modal
        this.exportModal.style.display = 'flex';
        this.updateProgress(0);
        this.exportStatus.textContent = 'Chargement des ressources...';

        try {
            // Preload all images first
            await this.preloadAllImages();

            this.exportStatus.textContent = `Génération des messages pour ${this.duration} secondes...`;

            // Generate stable viewer count for this video
            const viewerMultiplier = document.getElementById('viewer-multiplier');
            const activeChatters = viewerMultiplier ? parseInt(viewerMultiplier.value) : 25;
            const baseViewers = activeChatters * 3;
            this.videoViewerCount = Math.max(1, baseViewers + Math.floor(Math.random() * 7) - 3);

            // Setup active usernames based on viewer count
            this.setupActiveUsernames(activeChatters);

            // Generate persistent profiles for each active username
            this.generateUserProfiles();

            // Generate all messages for the video
            this.generateAllMessages();

            // Create video
            await this.createVideo();

        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Export error:', error);
                alert('Erreur lors de l\'export: ' + error.message);
            }
        } finally {
            this.isExporting = false;
            this.exportModal.style.display = 'none';
        }
    }

    async preloadAllImages() {
        this.imageLoadPromises = [];
        this.badgeImages.clear();
        this.emoteImages.clear();

        // Preload official badge images
        const badgeUrls = {
            'broadcaster': 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3',
            'mod': 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3',
            'vip': 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3',
            'sub': 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/3',
            'prime': 'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a598-423e-86d0-f9fb98ca1933/3',
            'turbo': 'https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/3',
            'verified': 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3'
        };

        // Load official badges
        for (const [type, url] of Object.entries(badgeUrls)) {
            const checkbox = document.getElementById(`badge-${type}`);
            if (checkbox && checkbox.checked) {
                this.imageLoadPromises.push(this.loadImage(url, 'badge', type));
            }
        }

        // Load custom badges
        if (typeof window.customBadges !== 'undefined') {
            window.customBadges.forEach(badge => {
                if (badge.enabled && badge.url) {
                    this.imageLoadPromises.push(this.loadImage(badge.url, 'badge', `custom-${badge.name}`));
                }
            });
        }

        // Load custom emotes - check both url and imageUrl properties and if enabled
        if (typeof window.customEmotes !== 'undefined') {
            console.log('Loading custom emotes:', window.customEmotes);
            window.customEmotes.forEach(emote => {
                // Only load if emote is enabled
                if (emote.enabled !== false) {
                    const emoteUrl = emote.url || emote.imageUrl;
                    if (emoteUrl) {
                        console.log(`Loading emote ${emote.name} from ${emoteUrl}`);
                        this.imageLoadPromises.push(this.loadImage(emoteUrl, 'emote', emote.name));
                    }
                }
            });
        }

        // Wait for all images to load
        await Promise.allSettled(this.imageLoadPromises);
    }

    async loadImage(url, type, key) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                console.log(`Successfully loaded ${type}: ${key}`);
                if (type === 'badge') {
                    this.badgeImages.set(key, img);
                } else if (type === 'emote') {
                    this.emoteImages.set(key, img);
                    console.log(`Emote ${key} added to cache, size: ${img.width}x${img.height}`);
                }
                resolve(img);
            };

            img.onerror = (error) => {
                console.error(`Failed to load ${type} image: ${key}`, error);
                console.error(`URL was: ${url}`);
                resolve(null);
            };

            // For data URLs or blob URLs, set src directly
            if (url.startsWith('data:') || url.startsWith('blob:')) {
                img.src = url;
            } else {
                // For external URLs, try to load with CORS
                // Some URLs might need a proxy to work around CORS
                img.src = url;
            }
        });
    }

    generateAllMessages() {
        // Check if bot messages are enabled
        const botMessagesCheckbox = document.getElementById('bot-messages-checkbox');
        const botEnabled = botMessagesCheckbox ? botMessagesCheckbox.checked : false;
        const botDelaySlider = document.getElementById('bot-delay-slider');
        const botDelay = botDelaySlider ? parseInt(botDelaySlider.value) : 30;
        const botMessageInput = document.getElementById('bot-message-input');
        const botMessage = botMessageInput ? botMessageInput.value : '📢 Don\'t forget to follow the channel!';

        // Check if emote only mode is enabled
        const emoteOnlyCheckbox = document.getElementById('emote-only-checkbox');
        const emoteOnlyMode = emoteOnlyCheckbox ? emoteOnlyCheckbox.checked : false;

        // Generate messages for the entire duration
        const totalMessages = Math.ceil(this.duration * this.messagesPerSecond);

        // Add initial bot message at 0.5 seconds if enabled
        if (botEnabled) {
            const initialBotMsg = this.createBotMessage(botMessage);
            initialBotMsg.timestamp = 0.5; // Show early
            this.messages.push(initialBotMsg);
        }

        let nextBotTime = botEnabled ? botDelay : Infinity; // Next bot message after the delay

        for (let i = 0; i < totalMessages; i++) {
            const timestamp = i / this.messagesPerSecond;

            // Check if it's time for another bot message
            if (botEnabled && timestamp >= nextBotTime) {
                // Bot message REPLACES the regular message at this timestamp
                const botMsg = this.createBotMessage(botMessage);
                botMsg.timestamp = timestamp;
                this.messages.push(botMsg);
                nextBotTime += botDelay;
            } else {
                // Regular message (or emote only)
                const message = emoteOnlyMode ? this.createEmoteOnlyMessage() : this.createRegularMessage();
                message.timestamp = timestamp;
                this.messages.push(message);
            }
        }

        console.log(`Generated ${this.messages.length} messages for ${this.duration}s video`);
    }

    createRegularMessage() {
        // Get username from limited pool
        const username = this.getRandomUsername();

        // Get the PERSISTENT profile for this user (always same color & badges)
        const profile = this.getUserProfile(username);

        // Generate message text
        const text = this.generateMessageText();

        return {
            username: username,
            color: profile.color,
            badges: profile.badges,
            text: text,
            timestamp: 0,
            isBot: false
        };
    }

    createEmoteOnlyMessage() {
        // Get username from limited pool
        const username = this.getRandomUsername();
        // Get the PERSISTENT profile for this user (always same color & badges)
        const profile = this.getUserProfile(username);

        // Generate emotes only
        const emotes = [];
        const numEmotes = Math.floor(Math.random() * 5) + 1;

        for (let i = 0; i < numEmotes; i++) {
            if (Math.random() > 0.7 && typeof window.customEmotes !== 'undefined' && window.customEmotes.length > 0) {
                // Filter only enabled emotes
                const enabledCustomEmotes = window.customEmotes.filter(e => e.enabled !== false);
                if (enabledCustomEmotes.length > 0) {
                    const customEmote = enabledCustomEmotes[Math.floor(Math.random() * enabledCustomEmotes.length)];
                    emotes.push(`:${customEmote.name}:`);
                }
            } else if (typeof window.activeDefaultEmotes !== 'undefined' && window.activeDefaultEmotes.length > 0) {
                emotes.push(window.activeDefaultEmotes[Math.floor(Math.random() * window.activeDefaultEmotes.length)]);
            } else {
                const defaultEmotes = ['😂', '🔥', '💯', '👀', '🎮', '❤️', '💜', '💚', '💙'];
                emotes.push(defaultEmotes[Math.floor(Math.random() * defaultEmotes.length)]);
            }
        }

        return {
            username: username,
            color: profile.color,
            badges: profile.badges,
            text: emotes.join(' '),
            timestamp: 0,
            isBot: false
        };
    }

    createBotMessage(text) {
        return {
            username: 'Nightbot',
            text: text,
            color: '#6441a5',
            badges: [],
            isBot: true,
            isMod: false
        };
    }

    setupActiveUsernames(activeChatters) {
        const usernamesInput = document.getElementById('usernames-input');
        const defaultUsernames = ['xQc', 'Pokimane', 'Ninja', 'Shroud', 'DrDisrespect', 'TimTheTatman', 'Summit1g', 'Tfue', 'Sodapoppin', 'Mizkif', 'HasanAbi', 'Ludwig', 'Valkyrae', 'Sykkuno', 'AdinRoss'];

        const allUsernames = usernamesInput && usernamesInput.value ?
            usernamesInput.value.split(',').map(u => u.trim()).filter(u => u) :
            defaultUsernames;

        // IMPORTANT: Limit active usernames to the number of active chatters
        // If only 1 viewer → use only 1 username throughout the entire video
        // If 5 viewers → use only 5 usernames
        const numActiveUsers = Math.min(activeChatters, allUsernames.length);

        // Shuffle and select active usernames
        const shuffled = [...allUsernames].sort(() => Math.random() - 0.5);
        this.activeUsernames = shuffled.slice(0, numActiveUsers);

        // If no usernames available, create generic ones
        if (this.activeUsernames.length === 0) {
            for (let i = 0; i < Math.min(activeChatters, 1); i++) {
                this.activeUsernames.push(`Viewer${i + 1}`);
            }
        }

        console.log(`Video with ${activeChatters} viewer(s) will use ${this.activeUsernames.length} username(s):`, this.activeUsernames);
    }

    getRandomUsername() {
        // Return a username from the LIMITED active pool only
        if (this.activeUsernames.length === 0) {
            return 'Viewer1';
        }
        return this.activeUsernames[Math.floor(Math.random() * this.activeUsernames.length)];
    }

    generateMessageText() {
        const wordsInput = document.getElementById('words-input');
        const emotesCheckbox = document.getElementById('emotes-checkbox');

        const defaultWords = ['POG', 'KEKW', 'LUL', 'Pog', 'PogChamp', 'monkaS', 'EZ', 'Clap', 'GG', 'W', 'L'];
        const words = wordsInput && wordsInput.value ?
            wordsInput.value.split(',').map(w => w.trim()).filter(w => w) :
            defaultWords;

        const messageWords = [];
        const messageLength = Math.floor(Math.random() * 4) + 1;

        for (let i = 0; i < messageLength; i++) {
            messageWords.push(words[Math.floor(Math.random() * words.length)]);

            // Add emojis/emotes occasionally
            if (emotesCheckbox && emotesCheckbox.checked && Math.random() > 0.7) {
                if (typeof window.customEmotes !== 'undefined' && window.customEmotes.length > 0 && Math.random() > 0.85) {
                    // Filter only enabled emotes
                    const enabledCustomEmotes = window.customEmotes.filter(e => e.enabled !== false);
                    if (enabledCustomEmotes.length > 0) {
                        const customEmote = enabledCustomEmotes[Math.floor(Math.random() * enabledCustomEmotes.length)];
                        messageWords.push(`:${customEmote.name}:`);
                    }
                } else if (typeof window.activeDefaultEmotes !== 'undefined' && window.activeDefaultEmotes.length > 0) {
                    messageWords.push(window.activeDefaultEmotes[Math.floor(Math.random() * window.activeDefaultEmotes.length)]);
                } else {
                    const defaultEmotes = ['😂', '🔥', '💯', '👀', '🎮'];
                    messageWords.push(defaultEmotes[Math.floor(Math.random() * defaultEmotes.length)]);
                }
            }
        }

        // Sometimes repeat words
        if (Math.random() > 0.8) {
            const repetitions = Math.floor(Math.random() * 3) + 2;
            const wordToRepeat = words[Math.floor(Math.random() * words.length)];
            for (let i = 0; i < repetitions; i++) {
                messageWords.push(wordToRepeat.toUpperCase());
            }
        }

        return messageWords.join(' ');
    }

    generateUserProfiles() {
        // Generate a PERSISTENT profile for each active username
        // Each user keeps the same color and badges throughout the entire video
        this.activeUsernames.forEach(username => {
            // Generate color based on username hash for consistency
            let hash = 0;
            for (let i = 0; i < username.length; i++) {
                hash = ((hash << 5) - hash) + username.charCodeAt(i);
                hash = hash & hash;
            }

            const colors = [
                '#ff0000', '#0000ff', '#00ff00', '#b700ff', '#ff7f00',
                '#9acd32', '#00ff7f', '#d2691e', '#ff00ff', '#1e90ff',
                '#ff69b4', '#8a2be2', '#00ced1', '#ff4500', '#da70d6'
            ];

            const colorsCheckbox = document.getElementById('colors-checkbox');
            const color = colorsCheckbox && colorsCheckbox.checked ?
                colors[Math.abs(hash) % colors.length] : '#ffffff';

            // Assign badges ONCE for this username - they will keep these badges forever
            const badges = this.assignUserBadges();

            // Store the profile permanently for this video
            this.userProfiles.set(username, {
                color: color,
                badges: badges
            });
        });

        console.log('Generated persistent profiles:', this.userProfiles);
    }

    getUserProfile(username) {
        // Always return the SAME stored profile for this username
        if (this.userProfiles.has(username)) {
            return this.userProfiles.get(username);
        }

        // Fallback if username not found (shouldn't happen)
        return {
            color: '#ffffff',
            badges: []
        };
    }

    assignUserBadges() {
        const badges = [];

        // Check which badges are enabled
        const badgeTypes = ['broadcaster', 'mod', 'vip', 'sub', 'prime', 'turbo', 'verified'];
        const badgeWeights = {
            broadcaster: 0.002,
            mod: 0.03,
            vip: 0.02,
            sub: 0.20,
            prime: 0.15,
            turbo: 0.01,
            verified: 0.005
        };

        // Random chance for badges
        if (Math.random() > 0.6) return []; // 40% chance of having badges

        badgeTypes.forEach(type => {
            const checkbox = document.getElementById(`badge-${type}`);
            if (checkbox && checkbox.checked && Math.random() < badgeWeights[type]) {
                badges.push({
                    type: type,
                    isOfficial: true
                });
                if (badges.length >= 3) return badges; // Max 3 badges
            }
        });

        // Custom badges
        if (typeof window.customBadges !== 'undefined') {
            window.customBadges.forEach(badge => {
                if (badge.enabled && Math.random() < (badge.weight / 100)) {
                    badges.push({
                        type: 'custom',
                        name: badge.name,
                        url: badge.url,
                        isOfficial: false
                    });
                    if (badges.length >= 3) return badges;
                }
            });
        }

        return badges;
    }

    async createVideo() {
        // Create stream with specified framerate
        const stream = this.canvas.captureStream(this.fps);

        // Check for best supported codec
        let mimeType = 'video/webm';
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            mimeType = 'video/webm;codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
            mimeType = 'video/webm;codecs=vp8';
        }

        const recorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            videoBitsPerSecond: this.bitrate
        });

        const chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        const recordingPromise = new Promise((resolve) => {
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                resolve(blob);
            };
        });

        // Start recording
        recorder.start();

        // Render frames with proper timing
        const startTime = performance.now();
        const frameDelay = 1000 / this.fps; // Time between frames in ms

        for (let frame = 0; frame < this.totalFrames; frame++) {
            if (this.abortController.signal.aborted) {
                recorder.stop();
                throw new Error('Export cancelled');
            }

            // Calculate frame timing
            const frameStartTime = performance.now();

            // Render the current frame
            this.renderFrame(frame);

            // Update progress based on format
            const formatRadio = document.querySelector('input[name="format"]:checked');
            const isMP4 = formatRadio && formatRadio.value === 'mp4';

            // If MP4, rendering is 80%, conversion is 20%
            // If WebM only, rendering is 100%
            const maxRenderProgress = isMP4 ? 80 : 100;
            const progress = (frame / this.totalFrames) * maxRenderProgress;
            this.updateProgress(progress);
            this.exportStatus.textContent = `Rendu: ${Math.round((frame / this.totalFrames) * 100)}%`;

            // Calculate how long to wait for proper frame timing
            const frameEndTime = performance.now();
            const frameRenderTime = frameEndTime - frameStartTime;
            const targetFrameTime = frameDelay;
            const waitTime = Math.max(0, targetFrameTime - frameRenderTime);

            // Wait to maintain correct framerate
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // Allow UI to update periodically
            if (frame % 30 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // Ensure we hold the last frame for a moment
        this.renderFrame(this.totalFrames - 1);

        // Wait to ensure all frames are properly captured
        this.exportStatus.textContent = 'Finalisation de la vidéo...';

        // Update to final rendering progress
        const formatRadio = document.querySelector('input[name="format"]:checked');
        const isMP4 = formatRadio && formatRadio.value === 'mp4';
        if (!isMP4) {
            this.updateProgress(95);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Stop recording
        if (recorder.state === 'recording') {
            recorder.stop();
        }

        // Wait for blob
        const blob = await recordingPromise;

        const endTime = performance.now();
        const actualDuration = ((endTime - startTime) / 1000).toFixed(1);
        console.log(`Vidéo de ${this.duration}s rendue en ${actualDuration}s`);

        await this.downloadVideo(blob);
    }

    renderFrame(frameNumber) {
        const currentTime = frameNumber / this.fps;
        const isLightTheme = document.body.classList.contains('light-theme');

        // Clear canvas with solid background matching the theme
        this.ctx.fillStyle = isLightTheme ? '#ffffff' : '#0e0e10';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.cropToChat) {
            // When cropping to chat, render the chat taking the full canvas
            this.renderChatOnly(currentTime, isLightTheme);
            return;
        }

        // Use EXACT dimensions from UI configuration
        const baseWidth = this.chatBaseWidth || 400;
        const baseHeight = this.chatBaseHeight || 600;
        const responsiveMode = this.responsiveMode || false;

        // For export, we need to fit the configured dimensions into the video canvas
        // while maintaining the exact proportions
        let chatWidth, chatHeight;

        if (responsiveMode) {
            // Responsive mode: scale based on video size
            const videoScale = Math.min(this.width / 1920, this.height / 1080);
            chatWidth = baseWidth * videoScale;
            chatHeight = baseHeight * videoScale;
        } else {
            // Fixed mode: use exact dimensions if they fit, otherwise scale proportionally
            if (baseWidth <= this.width && baseHeight <= this.height) {
                // Dimensions fit - use them exactly
                chatWidth = baseWidth;
                chatHeight = baseHeight;
            } else {
                // Scale down proportionally to fit
                const scaleToFit = Math.min(
                    (this.width - 100) / baseWidth,
                    (this.height - 100) / baseHeight
                );
                chatWidth = baseWidth * scaleToFit;
                chatHeight = baseHeight * scaleToFit;
            }
        }

        // Ensure minimum size and maximum bounds
        chatWidth = Math.max(300, Math.min(chatWidth, this.width - 50));
        chatHeight = Math.max(400, Math.min(chatHeight, this.height - 50));

        // Center the chat
        const chatX = Math.floor((this.width - chatWidth) / 2);
        const chatY = Math.floor((this.height - chatHeight) / 2);

        // Scale for UI elements inside chat
        const scale = chatWidth / baseWidth;

        // Draw chat container with rounded corners and subtle shadow
        const borderRadius = 12;

        // Add subtle shadow for depth
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 4;

        this.drawRoundedRect(
            chatX, chatY, chatWidth, chatHeight,
            borderRadius,
            isLightTheme ? '#ffffff' : '#18181b'
        );
        this.ctx.restore();

        // Calculate header height proportional to chat size
        const headerHeight = Math.min(65, chatHeight * 0.08);

        // Draw header with proper styling
        this.ctx.save();
        this.drawRoundedRect(
            chatX, chatY, chatWidth, headerHeight,
            [borderRadius, borderRadius, 0, 0], // Only top corners rounded
            isLightTheme ? '#f0f0f2' : '#1f1f23'
        );
        this.ctx.restore();

        // Draw header separator line
        this.ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(83, 83, 95, 0.48)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(chatX, chatY + headerHeight);
        this.ctx.lineTo(chatX + chatWidth, chatY + headerHeight);
        this.ctx.stroke();

        // Calculate font sizes based on chat dimensions
        const titleFontSize = Math.max(18, Math.min(26, chatWidth / 40));
        const viewerFontSize = Math.max(14, Math.min(20, chatWidth / 50));

        // Header text
        this.ctx.fillStyle = isLightTheme ? '#0e0e10' : '#efeff1';
        this.ctx.font = `bold ${titleFontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
        this.ctx.fillText('LIVE CHAT', chatX + 20, chatY + headerHeight * 0.65);

        // Viewer count
        this.ctx.fillStyle = isLightTheme ? '#53535f' : '#adadb8';
        this.ctx.font = `${viewerFontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
        const viewers = this.videoViewerCount || 1000;
        const viewerText = `👥 ${viewers.toLocaleString()} viewers`;
        const viewerTextWidth = this.ctx.measureText(viewerText).width;
        this.ctx.fillText(viewerText, chatX + chatWidth - viewerTextWidth - 20, chatY + headerHeight * 0.65);

        // Messages area with proper padding
        const messagesY = chatY + headerHeight + 15;
        const lineHeight = 26 * scale;
        const messagePadding = 15;

        // Get visible messages
        const visibleMessages = this.messages.filter(msg =>
            msg.timestamp <= currentTime &&
            msg.timestamp > currentTime - 30 // Show messages for 30 seconds
        );

        // Draw recent messages from bottom to top (like real Twitch chat)
        const maxMessagesToShow = Math.floor((chatHeight - headerHeight - 30) / (lineHeight + 6 * scale));
        const recentMessages = visibleMessages.slice(-maxMessagesToShow);

        // Set clipping region to prevent messages from overflowing
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(chatX, chatY + headerHeight + 1, chatWidth, chatHeight - headerHeight - 1);
        this.ctx.clip();

        // Calculate bottom position for messages
        const bottomY = chatY + chatHeight - 15; // padding from bottom

        // Calculate total height needed for all messages
        let totalHeight = 0;
        const messageHeights = [];

        for (let i = 0; i < recentMessages.length; i++) {
            const msg = recentMessages[i];
            const lines = this.getMessageLines(msg, chatWidth - (messagePadding * 2), scale);
            const messageHeight = lines.length * lineHeight;
            messageHeights.push({ msg, lines, height: messageHeight });
            totalHeight += messageHeight + (i > 0 ? 6 * scale : 0); // Add gap except for first message
        }

        // Calculate starting Y position
        const availableHeight = chatHeight - headerHeight - 30;
        let startY;

        if (totalHeight < availableHeight) {
            // If all messages fit, start from top of message area
            startY = chatY + headerHeight + 15;
        } else {
            // If messages overflow, align to bottom
            startY = bottomY - totalHeight;
        }

        // Draw messages from top to bottom
        let currentY = startY;
        for (let i = 0; i < messageHeights.length; i++) {
            const { msg, lines, height } = messageHeights[i];

            // Only draw if visible
            if (currentY + height > chatY + headerHeight + 10 && currentY < chatY + chatHeight) {
                this.drawSimpleMessage(msg, chatX + messagePadding, currentY, chatWidth - (messagePadding * 2), scale, lines);
            }

            currentY += height + 6 * scale; // Move down for next message
        }

        this.ctx.restore();
    }

    renderChatOnly(currentTime, isLightTheme) {
        // When cropping to chat, the chat fills the entire canvas
        const chatX = 0;
        const chatY = 0;
        const chatWidth = this.width;
        const chatHeight = this.height;
        const scale = 1;

        // Draw chat container with rounded corners and subtle shadow
        const borderRadius = 12;

        // Add subtle shadow for depth
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 4;

        this.drawRoundedRect(
            chatX, chatY, chatWidth, chatHeight,
            borderRadius,
            isLightTheme ? '#ffffff' : '#18181b'
        );
        this.ctx.restore();

        // Calculate header height proportional to chat size
        const headerHeight = Math.min(65, chatHeight * 0.08);

        // Draw header with proper styling
        this.ctx.save();
        this.drawRoundedRect(
            chatX, chatY, chatWidth, headerHeight,
            [borderRadius, borderRadius, 0, 0], // Only top corners rounded
            isLightTheme ? '#f0f0f2' : '#1f1f23'
        );
        this.ctx.restore();

        // Draw header separator line
        this.ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(83, 83, 95, 0.48)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(chatX, chatY + headerHeight);
        this.ctx.lineTo(chatX + chatWidth, chatY + headerHeight);
        this.ctx.stroke();

        // Calculate font sizes based on chat dimensions
        const titleFontSize = Math.max(18, Math.min(26, chatWidth / 30));
        const viewerFontSize = Math.max(14, Math.min(20, chatWidth / 40));

        // Header text
        this.ctx.fillStyle = isLightTheme ? '#0e0e10' : '#efeff1';
        this.ctx.font = `bold ${titleFontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
        this.ctx.fillText('LIVE CHAT', chatX + 20, chatY + headerHeight * 0.65);

        // Viewer count
        this.ctx.fillStyle = isLightTheme ? '#53535f' : '#adadb8';
        this.ctx.font = `${viewerFontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
        const viewers = this.videoViewerCount || 1000;
        const viewerText = `👥 ${viewers.toLocaleString()} viewers`;
        const viewerTextWidth = this.ctx.measureText(viewerText).width;
        this.ctx.fillText(viewerText, chatX + chatWidth - viewerTextWidth - 20, chatY + headerHeight * 0.65);

        // Messages area
        const messagesY = chatY + headerHeight + 15;
        const lineHeight = 26 * scale;
        const messagePadding = 15;

        // Get visible messages
        const visibleMessages = this.messages.filter(msg =>
            msg.timestamp <= currentTime &&
            msg.timestamp > currentTime - 30
        );

        // Draw recent messages
        const maxMessagesToShow = Math.floor((chatHeight - headerHeight - 30) / (lineHeight + 6 * scale));
        const recentMessages = visibleMessages.slice(-maxMessagesToShow);

        // Set clipping region
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(chatX, chatY + headerHeight + 1, chatWidth, chatHeight - headerHeight - 1);
        this.ctx.clip();

        // Calculate and draw messages
        let totalHeight = 0;
        const messageHeights = [];

        for (let i = 0; i < recentMessages.length; i++) {
            const msg = recentMessages[i];
            const lines = this.getMessageLines(msg, chatWidth - (messagePadding * 2), scale);
            const messageHeight = lines.length * lineHeight;
            messageHeights.push({ msg, lines, height: messageHeight });
            totalHeight += messageHeight + 10 * scale; // More spacing between messages
        }

        const bottomY = chatY + chatHeight - 20;
        const availableHeight = chatHeight - headerHeight - 40;

        // Always show messages from bottom up, like real Twitch chat
        let currentY = bottomY;

        // Draw messages from bottom to top
        for (let i = messageHeights.length - 1; i >= 0; i--) {
            const { msg, lines, height } = messageHeights[i];

            // Move up for this message
            currentY -= height;

            // Only draw if message is in visible area
            if (currentY >= chatY + headerHeight + 5) {
                this.drawSimpleMessage(msg, chatX + messagePadding, currentY, chatWidth - (messagePadding * 2), scale, lines);
            }

            // Move up for spacing
            currentY -= 10 * scale;

            // Stop if we've gone above the header
            if (currentY < chatY + headerHeight) {
                break;
            }
        }

        this.ctx.restore();
    }

    getMessageLines(message, maxWidth, scale) {
        // Split message into lines that will fit
        const lines = [];
        const parts = this.parseText(message.text);
        const fontSize = 16 * scale;
        const badgeSize = 18 * scale;

        // Calculate header width (username, badges, etc)
        this.ctx.font = `bold ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
        let headerWidth = this.ctx.measureText(message.username + ': ').width;

        if (message.badges && message.badges.length > 0) {
            headerWidth += message.badges.length * (badgeSize + 4 * scale);
        }

        if (message.isBot) {
            headerWidth += 22 * scale; // Bot emoji width
        }

        // Build lines
        let currentLine = { header: true, parts: [] };
        let currentWidth = headerWidth;

        this.ctx.font = `${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;

        parts.forEach(part => {
            if (part.type === 'text') {
                const words = part.content.split(' ');
                words.forEach((word, index) => {
                    if (index > 0) word = ' ' + word;
                    const wordWidth = this.ctx.measureText(word).width;

                    if (currentWidth + wordWidth > maxWidth && currentLine.parts.length > 0) {
                        lines.push(currentLine);
                        currentLine = { header: false, parts: [] };
                        currentWidth = 25 * scale; // Indent for continuation lines

                        // Don't add leading space on new line
                        if (word.startsWith(' ')) word = word.substring(1);
                    }

                    currentLine.parts.push({ type: 'text', content: word });
                    currentWidth += wordWidth;
                });
            } else {
                const itemWidth = part.type === 'emoji' ? 22 * scale : 24 * scale;
                if (currentWidth + itemWidth > maxWidth && currentLine.parts.length > 0) {
                    lines.push(currentLine);
                    currentLine = { header: false, parts: [] };
                    currentWidth = 0; // NO indent for continuation lines
                }

                currentLine.parts.push(part);
                currentWidth += itemWidth;
            }
        });

        if (currentLine.parts.length > 0) {
            lines.push(currentLine);
        }

        return lines; // No artificial limit - let messages display naturally
    }

    drawRoundedRect(x, y, width, height, radius, fillColor) {
        const corners = Array.isArray(radius) ? radius : [radius, radius, radius, radius];

        this.ctx.fillStyle = fillColor;
        this.ctx.beginPath();
        this.ctx.moveTo(x + corners[0], y);
        this.ctx.lineTo(x + width - corners[1], y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + corners[1]);
        this.ctx.lineTo(x + width, y + height - corners[2]);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - corners[2], y + height);
        this.ctx.lineTo(x + corners[3], y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - corners[3]);
        this.ctx.lineTo(x, y + corners[0]);
        this.ctx.quadraticCurveTo(x, y, x + corners[0], y);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawSimpleMessage(message, x, y, maxWidth, scale, lines) {
        const isLightTheme = document.body.classList.contains('light-theme');
        const lineHeight = 26 * scale;
        const fontSize = 16 * scale;
        const badgeSize = 18 * scale;

        // Draw bot background if needed
        if (message.isBot) {
            const totalHeight = lines.length * lineHeight + 8 * scale;
            const gradient = this.ctx.createLinearGradient(x - 15, y - 4 * scale, x + maxWidth, y);
            gradient.addColorStop(0, 'rgba(100, 65, 165, 0.15)');
            gradient.addColorStop(0.7, 'rgba(100, 65, 165, 0.08)');
            gradient.addColorStop(1, 'transparent');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x - 15, y - 4 * scale, maxWidth + 30, totalHeight);

            // Left border
            this.ctx.fillStyle = '#6441a5';
            this.ctx.fillRect(x - 15, y - 4 * scale, 3, totalHeight);
        }

        // Draw each line
        lines.forEach((line, lineIndex) => {
            let currentX = x;
            const currentY = y + (lineIndex * lineHeight) + fontSize;

            // First line ALWAYS includes header for each message
            if (lineIndex === 0) {
                // Draw badges
                if (message.badges && message.badges.length > 0) {
                    message.badges.forEach(badge => {
                        if (badge.isOfficial) {
                            const badgeImg = this.badgeImages.get(badge.type);
                            if (badgeImg) {
                                this.ctx.drawImage(badgeImg, currentX, currentY - badgeSize + 2 * scale, badgeSize, badgeSize);
                            }
                        }
                        currentX += badgeSize + 4 * scale;
                    });
                }

                // Bot emoji
                if (message.isBot) {
                    this.ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
                    this.ctx.fillText('🤖', currentX, currentY);
                    currentX += 22 * scale;

                    // Username with highlight
                    this.ctx.font = `bold ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
                    const userWidth = this.ctx.measureText(message.username).width;
                    this.ctx.fillStyle = 'rgba(180, 180, 190, 0.3)';
                    const highlightPadding = 6 * scale;
                    this.ctx.fillRect(currentX - highlightPadding/2, currentY - fontSize - 2 * scale, userWidth + highlightPadding, fontSize + 6 * scale);
                }

                // Username
                this.ctx.fillStyle = message.isBot ? (isLightTheme ? '#18181b' : '#ffffff') : (message.color || '#ffffff');
                this.ctx.font = `bold ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
                this.ctx.fillText(message.username, currentX, currentY);
                currentX += this.ctx.measureText(message.username).width;

                // Colon
                this.ctx.fillStyle = isLightTheme ? '#0e0e10' : '#dedee3';
                this.ctx.fillText(': ', currentX, currentY);
                currentX += this.ctx.measureText(': ').width;
            } else if (lineIndex > 0) {
                // Only indent for actual continuation lines (2nd line and beyond)
                currentX = x + 25 * scale;
            }

            // Draw message parts
            line.parts.forEach(part => {
                if (part.type === 'text') {
                    // Bot messages should be dark in light theme, light in dark theme
                    // Regular messages follow the theme
                    if (message.isBot) {
                        this.ctx.fillStyle = isLightTheme ? '#0e0e10' : '#dedee3';
                        this.ctx.font = `500 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
                    } else {
                        this.ctx.fillStyle = isLightTheme ? '#0e0e10' : '#dedee3';
                        this.ctx.font = `${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
                    }
                    this.ctx.fillText(part.content, currentX, currentY);
                    currentX += this.ctx.measureText(part.content).width;
                } else if (part.type === 'emoji') {
                    this.ctx.font = `${fontSize + 2 * scale}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
                    this.ctx.fillText(part.content, currentX, currentY);
                    currentX += 20 * scale;
                } else if (part.type === 'emote') {
                    const emoteImg = this.emoteImages.get(part.content);
                    if (emoteImg && emoteImg.complete) {
                        this.ctx.drawImage(emoteImg, currentX, currentY - fontSize - 2 * scale, 24 * scale, 24 * scale);
                    }
                    currentX += 24 * scale;
                }
            });
        });
    }

    drawMessage(message, x, y, maxWidth, scale) {
        const isLightTheme = document.body.classList.contains('light-theme');

        // Adjust baseline for better vertical alignment
        const baselineY = y;

        // Calculate actual message height for proper background
        const actualHeight = this.calculateMessageHeight(message, maxWidth, scale);

        // Bot message special style
        if (message.isBot) {
            // Background gradient - more subtle
            const gradient = this.ctx.createLinearGradient(x - 25 * scale, baselineY, x + maxWidth, baselineY);
            gradient.addColorStop(0, 'rgba(100, 65, 165, 0.12)');
            gradient.addColorStop(0.5, 'rgba(100, 65, 165, 0.06)');
            gradient.addColorStop(1, 'transparent');
            this.ctx.fillStyle = gradient;
            // Use actual height for background
            this.ctx.fillRect(x - 25 * scale, baselineY - actualHeight * 0.3, maxWidth + 25 * scale, actualHeight + 10 * scale);

            // Left border
            this.ctx.fillStyle = '#6441a5';
            this.ctx.fillRect(x - 25 * scale, baselineY - actualHeight * 0.3, 3 * scale, actualHeight + 10 * scale);
        }

        let currentX = x;

        // Draw badges
        if (message.badges && message.badges.length > 0) {
            message.badges.forEach(badge => {
                const badgeSize = 16 * scale;
                const badgeY = baselineY - badgeSize * 0.85; // Align badges with text baseline

                if (badge.isOfficial) {
                    const badgeImg = this.badgeImages.get(badge.type);
                    if (badgeImg) {
                        this.ctx.drawImage(badgeImg, currentX, badgeY, badgeSize, badgeSize);
                    } else {
                        // Fallback colored badge
                        this.ctx.fillStyle = this.getBadgeColor(badge.type);
                        this.ctx.fillRect(currentX, badgeY, badgeSize, badgeSize);
                    }
                } else {
                    // Custom badge
                    const customBadgeImg = this.badgeImages.get(`custom-${badge.name}`);
                    if (customBadgeImg) {
                        this.ctx.drawImage(customBadgeImg, currentX, badgeY, badgeSize, badgeSize);
                    }
                }
                currentX += badgeSize + 4 * scale;
            });
        }

        // Bot emoji with proper emoji font
        if (message.isBot) {
            this.ctx.save();
            this.ctx.font = `${18 * scale}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
            this.ctx.textBaseline = 'alphabetic';
            this.ctx.fillText('🤖', currentX, baselineY);
            const botEmojiWidth = this.ctx.measureText('🤖').width;
            this.ctx.restore();
            currentX += botEmojiWidth + 4 * scale;
        }

        // Username with highlight for bot
        if (message.isBot) {
            // Measure username
            this.ctx.font = `600 ${18 * scale}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
            const usernameMeasure = this.ctx.measureText(message.username);

            // Draw highlight with rounded corners
            this.ctx.fillStyle = 'rgba(100, 65, 165, 0.25)';
            const highlightHeight = 22 * scale;
            const highlightY = baselineY - highlightHeight * 0.75;

            // Simple rounded rectangle for highlight
            this.ctx.beginPath();
            this.ctx.roundRect(currentX - 2 * scale, highlightY, usernameMeasure.width + 4 * scale, highlightHeight, 2 * scale);
            this.ctx.fill();

            // Draw username
            this.ctx.fillStyle = '#ffffff';
        } else {
            this.ctx.fillStyle = message.color || (isLightTheme ? '#0e0e10' : '#ffffff');
        }

        this.ctx.font = `600 ${18 * scale}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
        this.ctx.textBaseline = 'alphabetic';
        this.ctx.fillText(message.username, currentX, baselineY);
        currentX += this.ctx.measureText(message.username).width;

        // Colon
        this.ctx.fillStyle = isLightTheme ? '#0e0e10' : '#dedee3';
        this.ctx.font = `${18 * scale}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
        this.ctx.textBaseline = 'alphabetic';
        this.ctx.fillText(': ', currentX, baselineY);
        currentX += 12 * scale;

        // Message text with wrapping
        this.drawMessageText(message.text, currentX, baselineY, maxWidth - (currentX - x), scale, isLightTheme, message.isBot);
    }

    drawMessageText(text, x, y, maxWidth, scale, isLightTheme, isBot) {
        // Parse text for emotes
        const parts = this.parseText(text);
        let currentX = x;
        let currentY = y;
        const lineHeight = 24 * scale;
        let lineCount = 1;
        const maxLines = 3; // Maximum 3 lines per message for better readability

        // Set up text style
        const textFont = isBot ? `500 ${18 * scale}px Inter, -apple-system, BlinkMacSystemFont, sans-serif` :
                                `${18 * scale}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;

        parts.forEach((part, partIndex) => {
            if (lineCount > maxLines) return; // Stop if we've reached max lines

            if (part.type === 'text') {
                this.ctx.fillStyle = isLightTheme ? '#0e0e10' : '#dedee3';
                this.ctx.font = textFont;
                this.ctx.textBaseline = 'alphabetic';

                // Split text by spaces for word wrapping
                const words = part.content.split(' ');

                words.forEach((word, index) => {
                    if (lineCount > maxLines) return;

                    if (index > 0) word = ' ' + word; // Add space back except for first word

                    const wordWidth = this.ctx.measureText(word).width;

                    // Check if we need to wrap
                    if (currentX + wordWidth > x + maxWidth && currentX !== x) {
                        if (lineCount >= maxLines) {
                            // Add ellipsis if this is the last allowed line
                            const ellipsis = '...';
                            const ellipsisWidth = this.ctx.measureText(ellipsis).width;

                            // Backtrack to add ellipsis at the end of previous word
                            if (currentX > x) {
                                currentX -= 5 * scale;
                                this.ctx.fillStyle = isLightTheme ? '#53535f' : '#adadb8';
                                this.ctx.fillText(ellipsis, currentX, currentY);
                            }
                            return;
                        }
                        currentX = x;
                        currentY += lineHeight;
                        lineCount++;
                    }

                    this.ctx.fillText(word, currentX, currentY);
                    currentX += wordWidth;
                });
            } else if (part.type === 'emoji') {
                if (lineCount > maxLines) return;

                // Better emoji rendering with proper font stack
                this.ctx.save();
                this.ctx.font = `${20 * scale}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
                this.ctx.textBaseline = 'alphabetic';

                const emojiWidth = this.ctx.measureText(part.content).width;

                // Check if emoji needs to wrap
                if (currentX + emojiWidth > x + maxWidth && currentX !== x) {
                    if (lineCount >= maxLines) {
                        this.ctx.restore();
                        return;
                    }
                    currentX = x;
                    currentY += lineHeight;
                    lineCount++;
                }

                this.ctx.fillText(part.content, currentX, currentY);
                this.ctx.restore();
                currentX += emojiWidth + (2 * scale);
            } else if (part.type === 'emote') {
                if (lineCount > maxLines) return;

                const emoteImg = this.emoteImages.get(part.content);
                const emoteSize = 24 * scale;

                // Check if emote needs to wrap
                if (currentX + emoteSize > x + maxWidth && currentX !== x) {
                    if (lineCount >= maxLines) return;
                    currentX = x;
                    currentY += lineHeight;
                    lineCount++;
                }

                if (emoteImg && emoteImg.complete && emoteImg.naturalHeight !== 0) {
                    // Draw custom emote image
                    try {
                        this.ctx.drawImage(emoteImg, currentX, currentY - emoteSize + 4 * scale, emoteSize, emoteSize);
                    } catch (e) {
                        console.error(`Error drawing emote ${part.content}:`, e);
                    }
                    currentX += emoteSize + 2 * scale;
                } else {
                    // Fallback: show emote name in brackets
                    this.ctx.fillStyle = '#9147ff';
                    this.ctx.font = `${14 * scale}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
                    const emoteText = `[${part.content}]`;

                    const emoteTextWidth = this.ctx.measureText(emoteText).width;

                    // Check if text needs to wrap
                    if (currentX + emoteTextWidth > x + maxWidth && currentX !== x) {
                        currentX = x;
                        currentY += lineHeight;
                    }

                    this.ctx.fillText(emoteText, currentX, currentY);
                    currentX += emoteTextWidth + 2 * scale;
                }
            }
        });
    }

    parseText(text) {
        const parts = [];
        const emotePattern = /:([^:\s]+):/g;
        let lastIndex = 0;
        let match;

        while ((match = emotePattern.exec(text)) !== null) {
            // Add text before emote
            if (match.index > lastIndex) {
                const textPart = text.substring(lastIndex, match.index);
                parts.push(...this.parseEmojis(textPart));
            }

            // Check if it's a custom emote
            const emoteName = match[1];
            if (this.emoteImages.has(emoteName) ||
                (typeof window.customEmotes !== 'undefined' &&
                 window.customEmotes.some(e => e.name === emoteName))) {
                parts.push({ type: 'emote', content: emoteName });
            } else {
                parts.push({ type: 'text', content: match[0] });
            }

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(...this.parseEmojis(text.substring(lastIndex)));
        }

        return parts;
    }

    parseEmojis(text) {
        const parts = [];
        const emojiRegex = /(\p{Emoji}+)/gu;
        let lastIndex = 0;
        let match;

        while ((match = emojiRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
            }
            parts.push({ type: 'emoji', content: match[1] });
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            parts.push({ type: 'text', content: text.substring(lastIndex) });
        }

        return parts.length > 0 ? parts : [{ type: 'text', content: text }];
    }

    getBadgeColor(type) {
        const colors = {
            'broadcaster': '#e91916',
            'mod': '#00ad03',
            'vip': '#e005b9',
            'sub': '#9147ff',
            'prime': '#0099fa',
            'turbo': '#9650a0',
            'verified': '#00c7ff'
        };
        return colors[type] || '#5c5c5c';
    }

    updateProgress(percent) {
        this.exportProgress.style.width = percent + '%';
        this.exportProgress.setAttribute('data-progress', Math.round(percent) + '%');
    }

    cancelExport() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    async downloadVideo(blob) {
        // Get selected format
        const formatRadio = document.querySelector('input[name="format"]:checked');
        const format = formatRadio ? formatRadio.value : 'webm';

        let finalBlob = blob;
        let extension = 'webm';

        // Convert to MP4 if selected
        if (format === 'mp4' && window.MP4Converter) {
            try {
                this.updateProgress(80);
                this.exportStatus.textContent = 'Conversion en MP4...';
                const converter = new window.MP4Converter();
                finalBlob = await converter.convertWebMToMP4(blob, (progress) => {
                    // MP4 conversion progress from 80% to 100%
                    this.updateProgress(80 + progress * 20);
                    this.exportStatus.textContent = `Conversion MP4: ${Math.round(progress * 100)}%`;
                });
                extension = 'mp4';
            } catch (error) {
                console.error('MP4 conversion failed:', error);
                extension = 'webm';
                // Still mark as complete even if conversion fails
                this.updateProgress(100);
            }
        } else {
            // WebM export - go directly to 100%
            this.updateProgress(100);
        }

        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;

        const timestamp = new Date().toISOString().split('T')[0];
        a.download = `twitch-chat-${this.duration}s-${timestamp}.${extension}`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const sizeMB = (finalBlob.size / (1024 * 1024)).toFixed(2);
        this.exportStatus.textContent = `Export terminé ! (${sizeMB} MB)`;

        // Ensure we're at 100%
        this.updateProgress(100);

        setTimeout(() => {
            this.exportModal.style.display = 'none';
        }, 2000);
    }

    async initMP4Converter() {
        if (this.mp4converter) return true;

        try {
            if (!window.MP4Converter) {
                console.warn('MP4Converter not available');
                return false;
            }

            this.mp4converter = new window.MP4Converter();
            return true;
        } catch (error) {
            console.error('Failed to initialize MP4 converter:', error);
            return false;
        }
    }
}

// Initialize exporter when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatVideoExporter = new TwitchChatVideoExporter();
});