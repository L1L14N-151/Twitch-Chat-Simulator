// Simplified script for OBS window that reuses main functions

// Global variables needed
let intervalId = null;
let isRunning = false;
let lastBotMessageTime = Date.now();
let userProfiles = new Map();
let customEmotes = [];
let customBadges = [];

// Load saved data from localStorage
function loadOBSSettings() {
    // Load custom emotes
    const savedEmotes = localStorage.getItem('twitchSimCustomEmotes');
    if (savedEmotes) {
        try {
            customEmotes = JSON.parse(savedEmotes);
        } catch (e) {
            customEmotes = [];
        }
    }

    // Load custom badges
    const savedBadges = localStorage.getItem('twitchSimCustomBadges');
    if (savedBadges) {
        try {
            customBadges = JSON.parse(savedBadges);
        } catch (e) {
            customBadges = [];
        }
    }

    // Update viewer count
    updateViewerCount();
}

// Get DOM elements
const chatMessages = document.getElementById('chat-messages');

// Badge types
const badgeTypes = {
    broadcaster: { name: 'BROADCASTER', weight: 0.02 },
    mod: { name: 'MOD', weight: 0.03 },
    vip: { name: 'VIP', weight: 0.02 },
    sub: { name: 'SUB', weight: 0.20 },
    prime: { name: 'PRIME', weight: 0.15 },
    turbo: { name: 'TURBO', weight: 0.01 },
    verified: { name: 'VERIFIED', weight: 0.005 }
};

// User colors
const userColors = [
    '#ff0000', '#0000ff', '#00ff00', '#b700ff', '#ff7f00',
    '#9acd32', '#00ff7f', '#d2691e', '#ff00ff', '#1e90ff',
    '#ff69b4', '#8a2be2', '#00ced1', '#ff4500', '#da70d6',
    '#ffd700', '#00fa9a', '#1e90ff', '#ff1493', '#00bfff'
];

// Default emotes
const allDefaultEmotes = ['😂', '🔥', '💯', '👀', '🎮', '❤️', '💜', '💚', '💙', '🤣', '😎', '🤔', '😭', '🙏', '👏', '🎉', '⚡', '🚀', '💪', '✨'];

function getActiveBadges() {
    const active = [];

    // Check which badges are enabled from localStorage
    const badgeStates = {
        broadcaster: localStorage.getItem('twitchSimBadgeBroadcaster') !== 'false',
        mod: localStorage.getItem('twitchSimBadgeMod') !== 'false',
        vip: localStorage.getItem('twitchSimBadgeVip') !== 'false',
        sub: localStorage.getItem('twitchSimBadgeSub') !== 'false',
        prime: localStorage.getItem('twitchSimBadgePrime') !== 'false',
        turbo: localStorage.getItem('twitchSimBadgeTurbo') !== 'false',
        verified: localStorage.getItem('twitchSimBadgeVerified') !== 'false'
    };

    Object.keys(badgeTypes).forEach(type => {
        if (badgeStates[type]) {
            active.push(badgeTypes[type]);
        }
    });

    // Add custom badges
    customBadges.forEach(badge => {
        if (badge.enabled) {
            active.push({
                name: badge.name.toUpperCase(),
                weight: badge.weight / 100,
                isCustom: true,
                url: badge.url
            });
        }
    });

    return active;
}

function assignUserBadges() {
    const activeBadges = getActiveBadges();
    if (activeBadges.length === 0) return [];

    // 40% of users have no badges
    if (Math.random() > 0.6) {
        return [];
    }

    const userBadges = [];

    activeBadges.forEach(badge => {
        if (Math.random() < badge.weight) {
            userBadges.push(badge);
        }
    });

    return userBadges;
}

function getUserColor(username) {
    const useColors = localStorage.getItem('twitchSimColors') !== 'false';
    if (!useColors) return '#ffffff';

    if (!userProfiles.has(username)) {
        userProfiles.set(username, {
            color: userColors[Math.floor(Math.random() * userColors.length)],
            badges: assignUserBadges()
        });
    }
    return userProfiles.get(username).color;
}

function getUserBadges(username) {
    if (!userProfiles.has(username)) {
        userProfiles.set(username, {
            color: userColors[Math.floor(Math.random() * userColors.length)],
            badges: assignUserBadges()
        });
    }
    return userProfiles.get(username).badges;
}

function getRandomUsername() {
    const savedUsernames = localStorage.getItem('twitchSimUsernames');
    let usernames = ['User1', 'User2', 'User3'];

    if (savedUsernames) {
        usernames = savedUsernames.split(',').map(u => u.trim()).filter(u => u);
    }

    return usernames[Math.floor(Math.random() * usernames.length)];
}

function getRandomMessage() {
    const isEmoteOnly = localStorage.getItem('twitchSimEmoteOnly') === 'true';

    if (isEmoteOnly) {
        const emoteCount = Math.floor(Math.random() * 3) + 1;
        const emotes = [];
        for (let i = 0; i < emoteCount; i++) {
            emotes.push(allDefaultEmotes[Math.floor(Math.random() * allDefaultEmotes.length)]);
        }
        return emotes.join(' ');
    }

    const savedMessages = localStorage.getItem('twitchSimMessages');
    let messages = ['hey', 'gg', 'wow', 'lol'];

    if (savedMessages) {
        messages = savedMessages.split(',').map(m => m.trim()).filter(m => m);
    }

    let message = messages[Math.floor(Math.random() * messages.length)];

    // Add variations
    if (Math.random() < 0.3) {
        const repeats = Math.floor(Math.random() * 3) + 2;
        message = message.repeat(repeats);
    }

    if (Math.random() < 0.2) {
        message = message.toUpperCase();
    }

    // Add emotes
    const showEmotes = localStorage.getItem('twitchSimEmotes') !== 'false';
    if (showEmotes && Math.random() < 0.3) {
        const emote = allDefaultEmotes[Math.floor(Math.random() * allDefaultEmotes.length)];
        message = Math.random() < 0.5 ? `${message} ${emote}` : `${emote} ${message}`;
    }

    return message;
}

function createMessage(username, message, badges = null) {
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message';

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'chat-badges';

    const userBadges = badges || getUserBadges(username);
    userBadges.forEach(badge => {
        if (badge.isCustom && badge.url) {
            const img = document.createElement('img');
            img.src = badge.url;
            img.className = 'chat-badge custom-badge';
            img.alt = badge.name;
            badgeSpan.appendChild(img);
        } else {
            const img = document.createElement('img');
            const badgeUrls = {
                'BROADCASTER': 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3',
                'MOD': 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3',
                'VIP': 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3',
                'SUB': 'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/3',
                'PRIME': 'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a598-423e-86d0-f9fb98ca1933/3',
                'TURBO': 'https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/3',
                'VERIFIED': 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3'
            };
            img.src = badgeUrls[badge.name] || '';
            img.className = 'chat-badge';
            img.alt = badge.name;
            badgeSpan.appendChild(img);
        }
    });

    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'chat-username';
    usernameSpan.style.color = getUserColor(username);
    usernameSpan.textContent = username;

    const messageSpan = document.createElement('span');
    messageSpan.className = 'chat-text';
    messageSpan.textContent = ': ' + message;

    if (badgeSpan.children.length > 0) {
        messageEl.appendChild(badgeSpan);
    }
    messageEl.appendChild(usernameSpan);
    messageEl.appendChild(messageSpan);

    return messageEl;
}

function addMessage() {
    const username = getRandomUsername();
    const message = getRandomMessage();
    const messageEl = createMessage(username, message);

    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Limit messages
    while (chatMessages.children.length > 150) {
        chatMessages.removeChild(chatMessages.firstChild);
    }
}

function updateViewerCount() {
    const multiplier = parseInt(localStorage.getItem('twitchSimViewerMultiplier')) || 25;
    const baseCount = multiplier * 40;
    const variance = Math.floor(Math.random() * (multiplier * 20)) - (multiplier * 10);
    const viewerCount = Math.max(1, baseCount + variance);

    const viewerElement = document.getElementById('viewer-count');
    if (viewerElement) {
        viewerElement.textContent = viewerCount.toLocaleString();
    }
}

function startSimulation() {
    if (isRunning) return;

    isRunning = true;
    window.isRunning = true;

    addMessage();

    function scheduleNextMessage() {
        if (!isRunning) return;

        const baseSpeed = parseInt(localStorage.getItem('twitchSimMessageSpeed')) || 1000;
        const variation = (Math.random() - 0.5) * 0.4;
        const nextDelay = baseSpeed * (1 + variation);

        intervalId = setTimeout(() => {
            addMessage();
            scheduleNextMessage();
        }, nextDelay);
    }

    scheduleNextMessage();
}

function stopSimulation() {
    if (!isRunning) return;

    isRunning = false;
    window.isRunning = false;
    clearTimeout(intervalId);
    intervalId = null;
}

function clearChat() {
    chatMessages.innerHTML = '';
    userProfiles.clear();
}

// Make functions globally available
window.startSimulation = startSimulation;
window.stopSimulation = stopSimulation;
window.clearChat = clearChat;
window.isRunning = false;

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    loadOBSSettings();

    // Update viewer count periodically
    setInterval(updateViewerCount, 30000);
});

// Listen for messages from main window
window.addEventListener('message', function(event) {
    if (event.data.action === 'start') {
        if (!isRunning) {
            console.log('Starting OBS chat from main window...');
            startSimulation();
        }
    } else if (event.data.action === 'stop') {
        if (isRunning) {
            console.log('Stopping OBS chat from main window...');
            stopSimulation();
        }
    } else if (event.data.action === 'clear') {
        console.log('Clearing OBS chat from main window...');
        clearChat();
    }
});