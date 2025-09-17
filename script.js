let intervalId = null;
let isRunning = false;

const chatMessages = document.getElementById('chat-messages');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const wordsInput = document.getElementById('words-input');
const usernamesInput = document.getElementById('usernames-input');
const emotesCheckbox = document.getElementById('emotes-checkbox');
const colorsCheckbox = document.getElementById('colors-checkbox');
const emoteOnlyCheckbox = document.getElementById('emote-only-checkbox');
const botMessagesCheckbox = document.getElementById('bot-messages-checkbox');
const botMessageInput = document.getElementById('bot-message-input');
const botDelaySlider = document.getElementById('bot-delay-slider');
const botDelayValue = document.getElementById('bot-delay-value');
const botConfigSection = document.getElementById('bot-config-section');

// Show/hide bot config based on checkbox
if (botMessagesCheckbox) {
    botMessagesCheckbox.addEventListener('change', () => {
        if (botConfigSection) {
            botConfigSection.style.display = botMessagesCheckbox.checked ? 'block' : 'none';
        }
        if (botMessagesCheckbox.checked) {
            lastBotMessageTime = Date.now();
        }
    });
}
const widthSlider = document.getElementById('width-slider');
const widthValue = document.getElementById('width-value');
const heightSlider = document.getElementById('height-slider');
const heightValue = document.getElementById('height-value');
const responsiveCheckbox = document.getElementById('responsive-checkbox');

let customEmotes = [];
let customBadges = [];
const allDefaultEmotes = ['😂', '🔥', '💯', '👀', '🎮', '❤️', '💜', '💚', '💙', '🤣', '😎', '🤔', '😭', '🙏', '👏', '🎉', '⚡', '🚀', '💪', '✨'];
let activeDefaultEmotes = [...allDefaultEmotes];

// Make emotes and badges accessible globally for video exporter
window.activeDefaultEmotes = activeDefaultEmotes;
window.customEmotes = customEmotes;
window.customBadges = customBadges;

const userColors = [
    '#ff0000', '#0000ff', '#00ff00', '#b700ff', '#ff7f00', 
    '#9acd32', '#00ff7f', '#d2691e', '#ff00ff', '#1e90ff',
    '#ff69b4', '#8a2be2', '#00ced1', '#ff4500', '#da70d6',
    '#ffd700', '#00fa9a', '#1e90ff', '#ff1493', '#00bfff'
];

const badgeTypes = {
    broadcaster: { name: 'BROADCASTER', weight: 0.02 },
    mod: { name: 'MOD', weight: 0.03 },
    vip: { name: 'VIP', weight: 0.02 },
    sub: { name: 'SUB', weight: 0.20 },
    prime: { name: 'PRIME', weight: 0.15 },
    turbo: { name: 'TURBO', weight: 0.01 },
    verified: { name: 'VERIFIED', weight: 0.005 }
};

// Store user profiles (color, badges) per username
const userProfiles = new Map();

function getActiveBadges() {
    const active = [];
    
    // Add default badges
    Object.keys(badgeTypes).forEach(type => {
        const checkbox = document.getElementById(`badge-${type}`);
        if (checkbox && checkbox.checked) {
            active.push(badgeTypes[type]);
        }
    });
    
    // Add custom badges that are enabled
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
    
    // 40% of users have no badges at all
    if (Math.random() > 0.6) {
        return [];
    }
    
    const userBadges = [];
    
    // Shuffle badges for random order
    const shuffledBadges = [...activeBadges].sort(() => Math.random() - 0.5);
    
    // Try to assign badges based on probability, max 3
    for (const badge of shuffledBadges) {
        if (userBadges.length >= 3) break; // Maximum 3 badges
        
        if (Math.random() < badge.weight) {
            userBadges.push(badge);
        }
    }
    
    // If no badges yet, maybe give one common badge
    if (userBadges.length === 0 && Math.random() < 0.3) {
        const commonBadges = activeBadges.filter(b => b.weight >= 0.1);
        if (commonBadges.length > 0) {
            userBadges.push(commonBadges[Math.floor(Math.random() * commonBadges.length)]);
        }
    }
    
    return userBadges;
}

function getUserProfile(username) {
    // If user already has a profile, return it
    if (userProfiles.has(username)) {
        return userProfiles.get(username);
    }
    
    // Create new profile for this user
    const profile = {
        color: colorsCheckbox.checked ? getRandomElement(userColors) : null,
        badges: assignUserBadges()
    };
    
    userProfiles.set(username, profile);
    return profile;
}

// Function to update slider progress bar
function updateSliderProgress(slider) {
    const min = slider.min || 0;
    const max = slider.max || 100;
    const value = slider.value;
    const percentage = ((value - min) / (max - min)) * 100;
    slider.style.setProperty('--value', percentage + '%');
}

speedSlider.addEventListener('input', () => {
    speedValue.textContent = `${speedSlider.value}ms`;
    updateSliderProgress(speedSlider);
    // No need to restart, the new speed will be used on next schedule
});

// Initialize slider progress
updateSliderProgress(speedSlider);

// Bot delay slider
if (botDelaySlider) {
    botDelaySlider.addEventListener('input', () => {
        botDelayValue.textContent = `${botDelaySlider.value} seconds`;
        updateSliderProgress(botDelaySlider);
    });
    updateSliderProgress(botDelaySlider);
}

// Width slider
if (widthSlider) {
    widthSlider.addEventListener('input', () => {
        const width = widthSlider.value;
        widthValue.textContent = `${width}px`;
        updateSliderProgress(widthSlider);

        // Appliquer la largeur au conteneur de chat
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            chatContainer.style.width = `${width}px`;
        }
    });

    // Appliquer la largeur initiale
    const initialWidth = widthSlider.value;
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        chatContainer.style.width = `${initialWidth}px`;
    }
    updateSliderProgress(widthSlider);
}

// Height slider
if (heightSlider) {
    heightSlider.addEventListener('input', () => {
        const height = heightSlider.value;
        heightValue.textContent = `${height}px`;
        updateSliderProgress(heightSlider);

        // Appliquer la hauteur au conteneur de chat
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            chatContainer.style.height = `${height}px`;
        }
    });

    // Appliquer la hauteur initiale
    const initialHeight = heightSlider.value;
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        chatContainer.style.height = `${initialHeight}px`;
    }
    updateSliderProgress(heightSlider);
}

startBtn.addEventListener('click', startSimulation);
stopBtn.addEventListener('click', stopSimulation);
clearBtn.addEventListener('click', clearChat);

// Variables pour stocker les tailles maximales disponibles
let maxAvailableWidth = 2000;
let maxAvailableHeight = 1200;

// Fonction pour calculer les dimensions maximales disponibles
function calculateMaxDimensions() {
    const controlsSection = document.querySelector('.controls-section');
    if (controlsSection) {
        const controlsWidth = controlsSection.offsetWidth;
        const headerHeight = 80;
        const padding = 60;

        // Calculer les maximums basés sur la fenêtre actuelle
        maxAvailableWidth = Math.min(window.innerWidth - controlsWidth - padding, 2000);
        maxAvailableHeight = Math.min(window.innerHeight - headerHeight - padding, 1200);

        // Mettre à jour les maximums des sliders
        if (widthSlider) {
            widthSlider.max = maxAvailableWidth;
            // Si la valeur actuelle dépasse le nouveau max, l'ajuster
            if (parseInt(widthSlider.value) > maxAvailableWidth) {
                widthSlider.value = maxAvailableWidth;
                widthValue.textContent = `${maxAvailableWidth}px`;
            }
        }
        if (heightSlider) {
            heightSlider.max = maxAvailableHeight;
            // Si la valeur actuelle dépasse le nouveau max, l'ajuster
            if (parseInt(heightSlider.value) > maxAvailableHeight) {
                heightSlider.value = maxAvailableHeight;
                heightValue.textContent = `${maxAvailableHeight}px`;
            }
        }
    }
}

// Fonction pour adapter la taille du chat
function adaptChatSize() {
    if (!responsiveCheckbox || !responsiveCheckbox.checked) return;

    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        // Recalculer les dimensions maximales
        calculateMaxDimensions();

        // Appliquer les dimensions maximales par défaut
        chatContainer.style.width = `${maxAvailableWidth}px`;
        chatContainer.style.height = `${maxAvailableHeight}px`;

        // Mettre à jour les sliders
        if (widthSlider) {
            widthSlider.value = maxAvailableWidth;
            widthValue.textContent = `${maxAvailableWidth}px`;
            updateSliderProgress(widthSlider);
        }
        if (heightSlider) {
            heightSlider.value = maxAvailableHeight;
            heightValue.textContent = `${maxAvailableHeight}px`;
            updateSliderProgress(heightSlider);
        }
    }
}

// Responsive checkbox toggle
if (responsiveCheckbox) {
    responsiveCheckbox.addEventListener('change', () => {
        if (responsiveCheckbox.checked) {
            calculateMaxDimensions();
            adaptChatSize();
        } else {
            // Rétablir les valeurs des sliders quand on désactive le mode responsive
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer && widthSlider && heightSlider) {
                const width = widthSlider.value;
                const height = heightSlider.value;
                chatContainer.style.width = `${width}px`;
                chatContainer.style.height = `${height}px`;
                updateSliderProgress(widthSlider);
                updateSliderProgress(heightSlider);
            }
        }
    });

    // Appliquer au chargement si responsive est activé
    if (responsiveCheckbox.checked) {
        calculateMaxDimensions();
    }
}

// Écouter les changements de taille de fenêtre
let resizeTimeout;
window.addEventListener('resize', () => {
    // Toujours recalculer les maximums quand la fenêtre change
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        calculateMaxDimensions();

        // Si responsive est activé, adapter automatiquement au maximum
        if (responsiveCheckbox && responsiveCheckbox.checked) {
            adaptChatSize();
        } else {
            // Sinon, juste s'assurer que les valeurs actuelles ne dépassent pas les nouveaux maximums
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer && widthSlider && heightSlider) {
                const currentWidth = parseInt(widthSlider.value);
                const currentHeight = parseInt(heightSlider.value);

                // Ajuster si nécessaire
                if (currentWidth > maxAvailableWidth) {
                    widthSlider.value = maxAvailableWidth;
                    widthValue.textContent = `${maxAvailableWidth}px`;
                    chatContainer.style.width = `${maxAvailableWidth}px`;
                    updateSliderProgress(widthSlider);
                }
                if (currentHeight > maxAvailableHeight) {
                    heightSlider.value = maxAvailableHeight;
                    heightValue.textContent = `${maxAvailableHeight}px`;
                    chatContainer.style.height = `${maxAvailableHeight}px`;
                    updateSliderProgress(heightSlider);
                }
            }
        }
    }, 100);
});

// Adapter la taille au chargement
window.addEventListener('load', () => {
    calculateMaxDimensions();
    if (responsiveCheckbox && responsiveCheckbox.checked) {
        setTimeout(adaptChatSize, 100);
    }
});

// Theme toggle
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    // Check saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeToggle.textContent = '☀️';
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        themeToggle.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

// Variable pour le prochain message de bot
let lastBotMessageTime = Date.now();
let botMessageIndex = 0;

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomWords() {
    // Si le mode Emote Only est activé
    if (emoteOnlyCheckbox && emoteOnlyCheckbox.checked) {
        const emoteCount = Math.floor(Math.random() * 5) + 1; // 1 à 5 emotes
        let message = [];

        for (let i = 0; i < emoteCount; i++) {
            // Mélanger entre emotes custom et emojis (40% custom, 60% emojis)
            if (customEmotes.length > 0 && Math.random() < 0.4) {
                const customEmote = getRandomElement(customEmotes);
                message.push(`:${customEmote.name}:`);
            } else if (activeDefaultEmotes.length > 0) {
                message.push(getRandomElement(activeDefaultEmotes));
            }
        }

        // Parfois répéter la même emote (spam d'emotes)
        if (Math.random() > 0.7 && message.length > 0) {
            const emoteToSpam = message[0];
            const spamCount = Math.floor(Math.random() * 4) + 2;
            message = [];
            for (let i = 0; i < spamCount; i++) {
                message.push(emoteToSpam);
            }
        }

        return message.join(' ');
    }

    // Mode normal
    const words = wordsInput.value.split(',').map(w => w.trim()).filter(w => w);
    if (words.length === 0) {
        return 'Message par défaut';
    }

    const messageLength = Math.floor(Math.random() * 4) + 1;
    let message = [];

    for (let i = 0; i < messageLength; i++) {
        message.push(getRandomElement(words));

        if (emotesCheckbox.checked && Math.random() > 0.7) {
            // Use custom emotes or default emotes
            // Custom emotes should be rarer (15% chance when emotes are triggered)
            if (customEmotes.length > 0 && Math.random() > 0.85) {
                const customEmote = getRandomElement(customEmotes);
                message.push(`:${customEmote.name}:`);
            } else if (activeDefaultEmotes.length > 0) {
                message.push(getRandomElement(activeDefaultEmotes));
            }
        }
    }
    
    if (Math.random() > 0.8) {
        const repetitions = Math.floor(Math.random() * 3) + 2;
        const wordToRepeat = getRandomElement(words);
        for (let i = 0; i < repetitions; i++) {
            message.push(wordToRepeat.toUpperCase());
        }
    }
    
    if (Math.random() > 0.9) {
        message = message.map(w => w.toUpperCase());
    }
    
    return message.join(' ');
}

function getRandomUsername() {
    if (activeUsernames.length === 0) {
        return `User${Math.floor(Math.random() * 10000)}`;
    }
    return getRandomElement(activeUsernames);
}

function createMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.setAttribute('role', 'listitem');
    
    const messageContent = document.createElement('span');
    
    // Get username and their persistent profile
    const username = getRandomUsername();
    const profile = getUserProfile(username);
    
    // Add badges from user profile
    if (profile.badges && profile.badges.length > 0) {
        profile.badges.forEach(badgeData => {
            const badgeSpan = document.createElement('span');
            
            if (badgeData.isCustom) {
                // Custom badge
                badgeSpan.className = 'badge';
                const badgeImg = document.createElement('img');
                badgeImg.src = badgeData.url;
                badgeImg.alt = badgeData.name;
                badgeSpan.appendChild(badgeImg);
            } else {
                // Default badge
                badgeSpan.className = `badge badge-${badgeData.name.toLowerCase()}`;
                const badgeImg = document.createElement('img');
                badgeImg.alt = badgeData.name;
                badgeSpan.appendChild(badgeImg);
            }
            
            messageContent.appendChild(badgeSpan);
        });
    }
    
    // Add username with their persistent color
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.textContent = username;
    
    if (profile.color) {
        usernameSpan.style.color = profile.color;
    }
    
    messageContent.appendChild(usernameSpan);
    
    const colonSpan = document.createElement('span');
    colonSpan.textContent = ': ';
    colonSpan.style.color = 'var(--color-text-base)';
    messageContent.appendChild(colonSpan);
    
    const messageText = document.createElement('span');
    const words = getRandomWords();
    
    // Parse custom emotes in the message
    const parsedMessage = parseCustomEmotes(words);
    messageText.innerHTML = parsedMessage;
    messageText.style.color = 'var(--color-text-base)';
    messageContent.appendChild(messageText);
    
    messageDiv.appendChild(messageContent);
    
    return messageDiv;
}

function createBotMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message bot-message';
    messageDiv.setAttribute('role', 'listitem');

    // Style spécial pour les messages de bot
    messageDiv.style.background = 'linear-gradient(90deg, rgba(100, 65, 165, 0.15), rgba(100, 65, 165, 0.08) 70%, transparent)';
    messageDiv.style.borderLeft = '3px solid #6441a5';
    messageDiv.style.paddingLeft = '10px';
    messageDiv.style.marginLeft = '-3px';

    const messageContent = document.createElement('span');

    // Emoji bot au lieu du badge
    const botEmoji = document.createElement('span');
    botEmoji.textContent = '🤖'; // Robot emoji
    botEmoji.style.fontSize = '16px';
    botEmoji.style.marginRight = '6px';
    botEmoji.style.verticalAlign = 'middle'; // Center vertically
    botEmoji.style.position = 'relative';
    botEmoji.style.top = '-1px'; // Fine-tune vertical position
    messageContent.appendChild(botEmoji);

    // Nom du bot avec surlignement violet
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.textContent = 'Nightbot';
    usernameSpan.style.color = '#ffffff'; // Blanc sur fond violet
    usernameSpan.style.fontWeight = 'bold';
    usernameSpan.style.backgroundColor = 'rgba(100, 65, 165, 0.25)'; // Surlignement violet
    usernameSpan.style.padding = '2px 6px';
    usernameSpan.style.borderRadius = '3px';
    usernameSpan.style.verticalAlign = 'baseline'; // Align with text baseline
    messageContent.appendChild(usernameSpan);

    const colonSpan = document.createElement('span');
    colonSpan.textContent = ': ';
    colonSpan.style.color = 'var(--color-text-base)';
    messageContent.appendChild(colonSpan);

    // Le message unique du bot
    const botMessage = botMessageInput ? botMessageInput.value.trim() : '';
    if (botMessage) {
        const messageText = document.createElement('span');
        messageText.textContent = botMessage;
        messageText.style.color = 'var(--color-text-base)';
        messageText.style.fontWeight = '500';
        messageContent.appendChild(messageText);
    }

    messageDiv.appendChild(messageContent);
    return messageDiv;
}

function addMessage() {
    // Vérifier si on doit ajouter un message de bot
    const currentTime = Date.now();
    const timeSinceLastBot = currentTime - lastBotMessageTime;
    const botDelay = botDelaySlider ? parseInt(botDelaySlider.value) * 1000 : 30000;

    // Message de bot selon le délai configuré
    if (botMessagesCheckbox && botMessagesCheckbox.checked && timeSinceLastBot > botDelay) {
        const botMessage = createBotMessage();
        chatMessages.appendChild(botMessage);
        lastBotMessageTime = currentTime;
    } else {
        // Message normal
        const message = createMessage();
        chatMessages.appendChild(message);
    }

    const shouldScroll = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 150;
    if (shouldScroll) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    if (chatMessages.children.length > 150) {
        while (chatMessages.children.length > 100) {
            chatMessages.removeChild(chatMessages.children[0]);
        }
    }
}

function startSimulation() {
    if (isRunning) return;

    isRunning = true;

    addMessage();

    function scheduleNextMessage() {
        if (!isRunning) return;

        // Get current speed value (allows real-time updates)
        const baseSpeed = parseInt(speedSlider.value);

        // Variation subtile : ±20% de la vitesse de base
        const variation = (Math.random() - 0.5) * 0.4;
        const nextDelay = baseSpeed * (1 + variation);

        intervalId = setTimeout(() => {
            addMessage();
            scheduleNextMessage();
        }, nextDelay);
    }

    scheduleNextMessage();

    startBtn.disabled = true;
    stopBtn.disabled = false;
}

function stopSimulation() {
    if (!isRunning) return;

    isRunning = false;
    clearTimeout(intervalId);
    intervalId = null;

    startBtn.disabled = false;
    stopBtn.disabled = true;
}

function clearChat() {
    chatMessages.innerHTML = '';
    // Clear user profiles to reassign badges and colors
    userProfiles.clear();
}

// Custom emotes management
const emoteNameInput = document.getElementById('emote-name-input');
const addEmoteBtn = document.getElementById('add-emote-btn');
const customEmotesList = document.getElementById('custom-emotes-list');
const imageDropZone = document.getElementById('image-drop-zone');
const emoteFileInput = document.getElementById('emote-file-input');
const emotePreview = document.getElementById('emote-preview');
const dropZoneContent = document.querySelector('#image-drop-zone .upload-placeholder');

let currentImageData = null;

function renderCustomEmotes() {
    // Update window reference for video exporter
    window.customEmotes = customEmotes;

    customEmotesList.innerHTML = '';
    customEmotes.forEach((emote, index) => {
        const emoteItem = document.createElement('div');
        emoteItem.className = 'emote-item';

        // Add checkbox for enabling/disabling
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'emote-checkbox-input';
        checkbox.checked = emote.enabled !== false; // Default to enabled if not specified
        checkbox.onchange = () => {
            customEmotes[index].enabled = checkbox.checked;
            saveCustomEmotes();
            window.customEmotes = customEmotes; // Update global reference
        };

        const emoteImg = document.createElement('img');
        emoteImg.src = emote.url;
        emoteImg.alt = emote.name;
        if (!checkbox.checked) {
            emoteImg.style.opacity = '0.5';
        }

        const emoteName = document.createElement('span');
        emoteName.className = 'emote-name';
        emoteName.textContent = emote.name;
        if (!checkbox.checked) {
            emoteName.style.opacity = '0.5';
        }

        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'emote-delete';
        deleteBtn.textContent = '✖';
        deleteBtn.onclick = () => {
            customEmotes.splice(index, 1);
            renderCustomEmotes();
            saveCustomEmotes();
        };

        // Update opacity on checkbox change
        checkbox.addEventListener('change', () => {
            emoteImg.style.opacity = checkbox.checked ? '1' : '0.5';
            emoteName.style.opacity = checkbox.checked ? '1' : '0.5';
        });

        emoteItem.appendChild(checkbox);
        emoteItem.appendChild(emoteImg);
        emoteItem.appendChild(emoteName);
        emoteItem.appendChild(deleteBtn);
        customEmotesList.appendChild(emoteItem);
    });
}

function addCustomEmote() {
    const name = emoteNameInput.value.trim();

    if (name && currentImageData) {
        const existingEmote = customEmotes.find(e => e.name === name);
        if (!existingEmote) {
            customEmotes.push({ name, url: currentImageData, enabled: true });
            emoteNameInput.value = '';
            currentImageData = null;
            emotePreview.style.display = 'none';
            if (dropZoneContent) dropZoneContent.style.display = 'flex';
            renderCustomEmotes();
            saveCustomEmotes();
        }
    }
}

function handleImageFile(file) {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentImageData = e.target.result;
            emotePreview.src = currentImageData;
            emotePreview.style.display = 'block';
            if (dropZoneContent) dropZoneContent.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

function saveCustomEmotes() {
    localStorage.setItem('twitchSimCustomEmotes', JSON.stringify(customEmotes));
}

function loadCustomEmotes() {
    const saved = localStorage.getItem('twitchSimCustomEmotes');
    if (saved) {
        customEmotes = JSON.parse(saved);
        window.customEmotes = customEmotes; // Update global reference
        renderCustomEmotes();
    }
}

// Event listeners for custom emotes
addEmoteBtn.addEventListener('click', addCustomEmote);
emoteNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addCustomEmote();
    }
});

// Click to upload
imageDropZone.addEventListener('click', () => {
    emoteFileInput.click();
});

emoteFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleImageFile(file);
    }
});

// Drag and drop
imageDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageDropZone.classList.add('dragover');
});

imageDropZone.addEventListener('dragleave', () => {
    imageDropZone.classList.remove('dragover');
});

imageDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    imageDropZone.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file) {
        handleImageFile(file);
    }
});

// Paste from clipboard
document.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let item of items) {
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            handleImageFile(file);
            emoteNameInput.focus();
        }
    }
});

function parseCustomEmotes(text) {
    let parsedText = text;
    customEmotes.forEach(emote => {
        // Only parse emote if it's enabled
        if (emote.enabled !== false) {
            const emotePattern = new RegExp(`:${emote.name}:`, 'g');
            parsedText = parsedText.replace(emotePattern,
                `<img src="${emote.url}" alt="${emote.name}" class="custom-emote">`
            );
        }
    });
    return parsedText;
}

// Custom badges management
const badgeNameInput = document.getElementById('badge-name-input');
const badgeWeightInput = document.getElementById('badge-weight-input');
const addBadgeBtn = document.getElementById('add-badge-btn');
const customBadgesList = document.getElementById('custom-badges-list');
const badgeDropZone = document.getElementById('badge-drop-zone');
const badgeFileInput = document.getElementById('badge-file-input');
const badgePreview = document.getElementById('badge-preview');
const badgeDropContent = document.querySelector('#badge-drop-zone .upload-placeholder-small');

let currentBadgeData = null;

function renderCustomBadges() {
    // Update window reference for video exporter
    window.customBadges = customBadges;

    customBadgesList.innerHTML = '';
    customBadges.forEach((badge, index) => {
        const badgeItem = document.createElement('div');
        badgeItem.className = 'custom-badge-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = badge.enabled;
        checkbox.onchange = () => {
            customBadges[index].enabled = checkbox.checked;
            saveCustomBadges();
        };
        
        const badgeImg = document.createElement('img');
        badgeImg.src = badge.url;
        badgeImg.alt = badge.name;
        
        const badgeInfo = document.createElement('div');
        badgeInfo.className = 'badge-info';
        
        const badgeName = document.createElement('span');
        badgeName.textContent = badge.name;
        
        const badgeWeight = document.createElement('span');
        badgeWeight.className = 'badge-weight';
        badgeWeight.textContent = `${badge.weight}%`;
        
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'emote-delete';
        deleteBtn.textContent = '✖';
        deleteBtn.onclick = () => {
            customBadges.splice(index, 1);
            renderCustomBadges();
            saveCustomBadges();
        };
        
        badgeInfo.appendChild(badgeName);
        badgeInfo.appendChild(badgeWeight);
        
        badgeItem.appendChild(checkbox);
        badgeItem.appendChild(badgeImg);
        badgeItem.appendChild(badgeInfo);
        badgeItem.appendChild(deleteBtn);
        customBadgesList.appendChild(badgeItem);
    });
}

function addCustomBadge() {
    const name = badgeNameInput.value.trim();
    const weight = parseInt(badgeWeightInput.value) || 10;
    
    if (name && currentBadgeData) {
        const existingBadge = customBadges.find(b => b.name === name);
        if (!existingBadge) {
            customBadges.push({ 
                name, 
                url: currentBadgeData,
                weight: Math.min(100, Math.max(1, weight)),
                enabled: true
            });
            badgeNameInput.value = '';
            badgeWeightInput.value = '10';
            currentBadgeData = null;
            badgePreview.style.display = 'none';
            if (badgeDropContent) badgeDropContent.style.display = 'flex';
            renderCustomBadges();
            saveCustomBadges();
        }
    }
}

function handleBadgeFile(file) {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentBadgeData = e.target.result;
            badgePreview.src = currentBadgeData;
            badgePreview.style.display = 'block';
            if (badgeDropContent) badgeDropContent.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

function saveCustomBadges() {
    localStorage.setItem('twitchSimCustomBadges', JSON.stringify(customBadges));
}

function loadCustomBadges() {
    const saved = localStorage.getItem('twitchSimCustomBadges');
    if (saved) {
        customBadges = JSON.parse(saved);
        window.customBadges = customBadges; // Update global reference
        renderCustomBadges();
    }
}

// Badge event listeners
addBadgeBtn.addEventListener('click', addCustomBadge);
badgeNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addCustomBadge();
    }
});

badgeDropZone.addEventListener('click', () => {
    badgeFileInput.click();
});

badgeFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleBadgeFile(file);
    }
});

badgeDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    badgeDropZone.classList.add('dragover');
});

badgeDropZone.addEventListener('dragleave', () => {
    badgeDropZone.classList.remove('dragover');
});

badgeDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    badgeDropZone.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file) {
        handleBadgeFile(file);
    }
});

// Load saved emotes and badges on start
loadCustomEmotes();
loadCustomBadges();

// Tab navigation
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;
        
        // Update active tab button
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Show corresponding tab content
        tabContents.forEach(content => {
            if (content.id === `${targetTab}-tab`) {
                content.style.display = 'block';
            } else {
                content.style.display = 'none';
            }
        });
    });
});

// Viewer count controls active usernames
const viewerCount = document.getElementById('viewer-count');
const viewerMultiplier = document.getElementById('viewer-multiplier');
const multiplierValue = document.getElementById('multiplier-value');
let currentViewers = 0;
let activeUsernames = [];

function updateActiveUsernames() {
    const allUsernames = usernamesInput.value
        .split(',')
        .map(u => u.trim())
        .filter(u => u.length > 0);
    
    if (allUsernames.length === 0) {
        activeUsernames = [];
        return;
    }
    
    const activeChatters = parseInt(viewerMultiplier.value) || 10;
    
    // Select active chatters (limited to available usernames and max 100)
    const usernameCount = Math.min(activeChatters, Math.min(100, allUsernames.length));
    
    // Randomly select usernames for active chatters
    const shuffled = [...allUsernames].sort(() => Math.random() - 0.5);
    activeUsernames = shuffled.slice(0, usernameCount);
    
    // Calculate viewers: 1 active chatter + 2 silent viewers = 3x multiplier
    // Add small variation for realism
    currentViewers = (usernameCount * 3) + Math.floor(Math.random() * 7) - 3;
    currentViewers = Math.max(1, currentViewers);
    
    // Update viewer count display
    if (viewerCount) {
        viewerCount.textContent = currentViewers.toLocaleString();
    }
}

// These listeners will be added later with localStorage support

// Update viewer count with small variations every 5 seconds
setInterval(() => {
    if (currentViewers > 0) {
        // Small variation (±3 viewers)
        const variation = Math.floor(Math.random() * 7) - 3;
        currentViewers = Math.max(1, currentViewers + variation);
        
        if (viewerCount) {
            viewerCount.textContent = currentViewers.toLocaleString();
        }
    }
}, 5000);

// Initialize only after DOM is ready
if (viewerMultiplier && usernamesInput) {
    updateActiveUsernames();
}

// Initialize default emojis grid
function initDefaultEmojis() {
    const grid = document.getElementById('default-emojis-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Add select all / deselect all buttons if not exists
    let controlBar = document.querySelector('.emoji-control-bar');
    if (!controlBar) {
        controlBar = document.createElement('div');
        controlBar.className = 'emoji-control-bar';
        controlBar.innerHTML = `
            <button class="btn btn-small" id="select-all-emojis">✅ Select All</button>
            <button class="btn btn-small" id="deselect-all-emojis">❌ Deselect All</button>
            <span class="emoji-count">${activeDefaultEmotes.length}/${allDefaultEmotes.length} active</span>
        `;
        grid.parentElement.insertBefore(controlBar, grid);
    } else {
        // Just update the count
        const countSpan = controlBar.querySelector('.emoji-count');
        if (countSpan) {
            countSpan.textContent = `${activeDefaultEmotes.length}/${allDefaultEmotes.length} active`;
        }
    }

    // Add emoji items
    allDefaultEmotes.forEach((emoji, index) => {
        const emojiDiv = document.createElement('div');
        emojiDiv.className = 'emoji-checkbox';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = activeDefaultEmotes.includes(emoji);
        checkbox.id = `emoji-${index}`;
        checkbox.onchange = () => {
            if (checkbox.checked) {
                if (!activeDefaultEmotes.includes(emoji)) {
                    activeDefaultEmotes.push(emoji);
                }
            } else {
                const idx = activeDefaultEmotes.indexOf(emoji);
                if (idx > -1) {
                    activeDefaultEmotes.splice(idx, 1);
                }
            }
            saveDefaultEmojisState();
            updateEmojiCount();
            window.activeDefaultEmotes = activeDefaultEmotes; // Update global reference
        };
        
        const emojiDisplay = document.createElement('span');
        emojiDisplay.className = 'emoji-display';
        emojiDisplay.textContent = emoji;
        
        emojiDiv.appendChild(checkbox);
        emojiDiv.appendChild(emojiDisplay);
        
        // Click on emoji to toggle checkbox
        emojiDiv.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.onchange();
            }
        });
        
        grid.appendChild(emojiDiv);
    });

    // Setup control buttons
    setupEmojiControls();
}

function updateEmojiCount() {
    const countSpan = document.querySelector('.emoji-count');
    if (countSpan) {
        countSpan.textContent = `${activeDefaultEmotes.length}/${allDefaultEmotes.length} active`;
    }
}

function setupEmojiControls() {
    const selectAllBtn = document.getElementById('select-all-emojis');
    const deselectAllBtn = document.getElementById('deselect-all-emojis');

    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            activeDefaultEmotes = [...allDefaultEmotes];
            window.activeDefaultEmotes = activeDefaultEmotes;
            saveDefaultEmojisState();
            initDefaultEmojis();
        };
    }

    if (deselectAllBtn) {
        deselectAllBtn.onclick = () => {
            activeDefaultEmotes = [];
            window.activeDefaultEmotes = activeDefaultEmotes;
            saveDefaultEmojisState();
            initDefaultEmojis();
        };
    }
}

function saveDefaultEmojisState() {
    localStorage.setItem('twitchSimActiveEmojis', JSON.stringify(activeDefaultEmotes));
}

function loadDefaultEmojisState() {
    const saved = localStorage.getItem('twitchSimActiveEmojis');
    if (saved) {
        activeDefaultEmotes = JSON.parse(saved);
    }
}

// Badge state management
function saveBadgeStates() {
    const badgeStates = {};
    Object.keys(badgeTypes).forEach(type => {
        const checkbox = document.getElementById(`badge-${type}`);
        if (checkbox) {
            badgeStates[type] = checkbox.checked;
        }
    });
    localStorage.setItem('twitchSimBadgeStates', JSON.stringify(badgeStates));
}

function loadBadgeStates() {
    const saved = localStorage.getItem('twitchSimBadgeStates');
    if (saved) {
        const badgeStates = JSON.parse(saved);
        Object.keys(badgeStates).forEach(type => {
            const checkbox = document.getElementById(`badge-${type}`);
            if (checkbox) {
                checkbox.checked = badgeStates[type];
            }
        });
    }
}

// Add event listeners to badge checkboxes
Object.keys(badgeTypes).forEach(type => {
    const checkbox = document.getElementById(`badge-${type}`);
    if (checkbox) {
        checkbox.addEventListener('change', saveBadgeStates);
    }
});

// Save and load all settings
function saveAllSettings() {
    const settings = {
        speed: speedSlider.value,
        viewerMultiplier: viewerMultiplier.value,
        words: wordsInput.value,
        usernames: usernamesInput.value,
        emotesEnabled: emotesCheckbox ? emotesCheckbox.checked : true,
        colorsEnabled: colorsCheckbox ? colorsCheckbox.checked : true,
        emoteOnlyEnabled: emoteOnlyCheckbox ? emoteOnlyCheckbox.checked : false,
        botMessagesEnabled: botMessagesCheckbox ? botMessagesCheckbox.checked : false,
        botMessage: botMessageInput ? botMessageInput.value : '',
        botDelay: botDelaySlider ? botDelaySlider.value : 30,
        width: widthSlider ? widthSlider.value : 600,
        height: heightSlider ? heightSlider.value : 700,
        responsiveEnabled: responsiveCheckbox ? responsiveCheckbox.checked : true
    };
    localStorage.setItem('twitchSimSettings', JSON.stringify(settings));
}

function loadAllSettings() {
    const saved = localStorage.getItem('twitchSimSettings');
    if (saved) {
        const settings = JSON.parse(saved);

        // Apply saved settings
        if (settings.speed !== undefined) {
            speedSlider.value = settings.speed;
            speedValue.textContent = settings.speed + 'ms';
        }

        if (settings.viewerMultiplier !== undefined) {
            viewerMultiplier.value = settings.viewerMultiplier;
            multiplierValue.textContent = settings.viewerMultiplier;
        }

        if (settings.words !== undefined) {
            wordsInput.value = settings.words;
        }

        if (settings.usernames !== undefined) {
            usernamesInput.value = settings.usernames;
        }

        if (settings.emotesEnabled !== undefined && emotesCheckbox) {
            emotesCheckbox.checked = settings.emotesEnabled;
        }

        if (settings.colorsEnabled !== undefined && colorsCheckbox) {
            colorsCheckbox.checked = settings.colorsEnabled;
        }

        if (settings.emoteOnlyEnabled !== undefined && emoteOnlyCheckbox) {
            emoteOnlyCheckbox.checked = settings.emoteOnlyEnabled;
        }

        if (settings.botMessagesEnabled !== undefined && botMessagesCheckbox) {
            botMessagesCheckbox.checked = settings.botMessagesEnabled;
            // Show/hide bot config based on saved state
            if (botConfigSection) {
                botConfigSection.style.display = settings.botMessagesEnabled ? 'block' : 'none';
            }
        }

        if (settings.botMessage !== undefined && botMessageInput) {
            botMessageInput.value = settings.botMessage;
        }

        if (settings.botDelay !== undefined && botDelaySlider) {
            botDelaySlider.value = settings.botDelay;
            botDelayValue.textContent = settings.botDelay + ' seconds';
        }

        if (settings.width !== undefined && widthSlider) {
            widthSlider.value = settings.width;
            widthValue.textContent = settings.width + 'px';
            updateSliderProgress(widthSlider);
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer && !settings.responsiveEnabled) {
                chatContainer.style.width = settings.width + 'px';
            }
        }

        if (settings.height !== undefined && heightSlider) {
            heightSlider.value = settings.height;
            heightValue.textContent = settings.height + 'px';
            updateSliderProgress(heightSlider);
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer && !settings.responsiveEnabled) {
                chatContainer.style.height = settings.height + 'px';
            }
        }

        if (settings.responsiveEnabled !== undefined && responsiveCheckbox) {
            responsiveCheckbox.checked = settings.responsiveEnabled;
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                if (settings.responsiveEnabled) {
                    chatContainer.style.width = '';
                    chatContainer.style.height = '';
                    chatContainer.classList.add('responsive');
                } else {
                    chatContainer.classList.remove('responsive');
                    if (settings.width) chatContainer.style.width = settings.width + 'px';
                    if (settings.height) chatContainer.style.height = settings.height + 'px';
                }
            }
            // Update slider states
            if (widthSlider) widthSlider.disabled = settings.responsiveEnabled;
            if (heightSlider) heightSlider.disabled = settings.responsiveEnabled;
        }

        // Update all slider progress bars
        updateSliderProgress(speedSlider);
        updateSliderProgress(viewerMultiplier);
        if (botDelaySlider) updateSliderProgress(botDelaySlider);
    }
}

// Helper function to save both regular and custom settings
function saveWithCustom() {
    saveAllSettings();
    if (!localStorage.getItem('selectedScenario')) {
        saveCustomSettings();
    }
}

// Add event listeners to save settings on change
speedSlider.addEventListener('change', saveWithCustom);
wordsInput.addEventListener('input', saveWithCustom);
usernamesInput.addEventListener('input', () => {
    saveWithCustom();
    updateActiveUsernames();
});

if (emotesCheckbox) emotesCheckbox.addEventListener('change', saveWithCustom);
if (colorsCheckbox) colorsCheckbox.addEventListener('change', saveWithCustom);
if (emoteOnlyCheckbox) emoteOnlyCheckbox.addEventListener('change', saveWithCustom);
if (botMessageInput) botMessageInput.addEventListener('input', saveWithCustom);
if (botDelaySlider) botDelaySlider.addEventListener('change', saveWithCustom);
if (widthSlider) widthSlider.addEventListener('change', saveWithCustom);
if (heightSlider) heightSlider.addEventListener('change', saveWithCustom);
if (responsiveCheckbox) responsiveCheckbox.addEventListener('change', saveWithCustom);

// Bot messages checkbox already has listener, just add save
if (botMessagesCheckbox) {
    const originalListener = botMessagesCheckbox.onchange;
    botMessagesCheckbox.addEventListener('change', () => {
        saveWithCustom();
    });
}

// Add viewer multiplier listener with localStorage
viewerMultiplier.addEventListener('input', (e) => {
    multiplierValue.textContent = e.target.value;
    updateSliderProgress(viewerMultiplier);
    updateActiveUsernames();
    saveWithCustom();
});

// Initialize viewer multiplier progress
updateSliderProgress(viewerMultiplier);



// Tab navigation
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Update active button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Show corresponding content
            tabContents.forEach(content => {
                if (content.id === `${targetTab}-tab`) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });
        });
    });
}


// Scenarios definitions
const scenarios = {
    gaming: {
        name: "Gaming Stream",
        speed: 800,
        viewerMultiplier: 35,
        words: 'gg, nice, lets go, clutch, no way, insane, ez, noob, carried, throw, ace, clean, diff, cracked, ratio, W, L, cope, skill issue, touch grass, get good, one tap, flick, 360, noscope, wallbang, prefire, peek, rotate, push, hold, save, eco, force buy',
        emotesEnabled: true,
        colorsEnabled: true,
        emoteOnlyEnabled: false,
        botMessagesEnabled: true,
        botMessage: '🎮 Follow for more epic gaming moments! Use code GAMER for 10% off! Join Discord!',
        botDelay: 45
    },
    'just-chatting': {
        name: "Just Chatting",
        speed: 1200,
        viewerMultiplier: 50,
        words: 'hey, hi, hello, how are you, whats up, lol, lmao, true, facts, real, based, cap, no cap, fr fr, on god, literally, actually, honestly, exactly, same, mood, vibe, tea, spill, drama, story time, wild, crazy, insane, thoughts?, opinion?, hot take',
        emotesEnabled: true,
        colorsEnabled: true,
        emoteOnlyEnabled: false,
        botMessagesEnabled: true,
        botMessage: '💬 Welcome to the stream! Be respectful and have fun! Check out my socials!',
        botDelay: 60
    },
    esports: {
        name: "Esports Tournament",
        speed: 400,
        viewerMultiplier: 80,
        words: 'LETS GO, GG, THROW, CHOKE, CLUTCH, ACE, INSANE, GOAT, WASHED, DIFF, EZ, DOMINATING, COMEBACK, REVERSE SWEEP, TILTED, MENTAL, PEEK, FLANK, ROTATE, EXECUTE, DEFAULT, ECO, FORCE, TIMEOUT, PAUSE, VAC, AIMBOT, CRACKED, SHEESH',
        emotesEnabled: true,
        colorsEnabled: true,
        emoteOnlyEnabled: false,
        botMessagesEnabled: false,
        botMessage: '',
        botDelay: 30
    },
    raid: {
        name: "Raid Incoming",
        speed: 200,
        viewerMultiplier: 100,
        words: 'RAID, RAID HYPE, WELCOME RAIDERS, LOVE, HEARTS, POG, LETS GO, W RAID, MASSIVE, HUGE RAID, OMG, INSANE, SO MANY PEOPLE, HI EVERYONE, WELCOME, HYPE, LOVE THE ENERGY, APPRECIATE YOU, THANKS FOR RAID, YOU\'RE AMAZING',
        emotesEnabled: true,
        colorsEnabled: true,
        emoteOnlyEnabled: false,
        botMessagesEnabled: false,
        botMessage: '',
        botDelay: 30
    },
    'sub-train': {
        name: "Sub Train",
        speed: 300,
        viewerMultiplier: 60,
        words: 'SUB HYPE, GIFT SUB, THANK YOU, LETS GO, SUB TRAIN, KEEP IT GOING, POG, W, TIER 3, PRIME, GIFTED, GENEROUS, LEGEND, GOAT, APPRECIATE YOU, LOVE, HYPE TRAIN, CHOO CHOO, ALL ABOARD, 50 SUBS, 100 SUBS, INSANE',
        emotesEnabled: true,
        colorsEnabled: true,
        emoteOnlyEnabled: false,
        botMessagesEnabled: true,
        botMessage: '🚂 SUB TRAIN ACTIVE! Thank you for all the support! Every sub counts!',
        botDelay: 20
    },
    drama: {
        name: "Drama/Controversy",
        speed: 600,
        viewerMultiplier: 90,
        words: 'drama, spicy, tea, exposed, cancelled, L take, ratio, defend, explain, yikes, oof, bruh, not a good look, receipts, proof, cap, no way, delete this, touch grass, chronically online, parasocial, weird, cringe, based, unbased, cope, seethe, mald',
        emotesEnabled: true,
        colorsEnabled: true,
        emoteOnlyEnabled: false,
        botMessagesEnabled: true,
        botMessage: '⚠️ Please keep chat respectful. No harassment or hate speech. Mods are watching.',
        botDelay: 15
    },
    chill: {
        name: "Chill Vibes",
        speed: 2000,
        viewerMultiplier: 15,
        words: 'cozy, vibes, chill, relaxing, peaceful, love this, so calm, needed this, perfect, aesthetic, mood, comfy, wholesome, thanks, appreciate, good vibes, zen, mindful, breathe, relax, unwind, destress, selfcare',
        emotesEnabled: true,
        colorsEnabled: true,
        emoteOnlyEnabled: false,
        botMessagesEnabled: true,
        botMessage: '🌙 Welcome to our chill space. Grab some tea and relax. You\'re appreciated here.',
        botDelay: 90
    },
    hype: {
        name: "Hype Release",
        speed: 250,
        viewerMultiplier: 95,
        words: 'HYPE, LETS GOOOOO, POG, INSANE, FINALLY, IVE BEEN WAITING, CANT WAIT, PREORDER, DAY ONE, INSTANT BUY, TAKE MY MONEY, GOTY, MASTERPIECE, CINEMA, PEAK, GOATED, W, HUGE W, BEST EVER, LEGENDARY, HISTORIC MOMENT',
        emotesEnabled: true,
        colorsEnabled: true,
        emoteOnlyEnabled: false,
        botMessagesEnabled: true,
        botMessage: '🚀 GET HYPED! Links in description! Use code HYPE for exclusive content!',
        botDelay: 30
    }
};

// Default settings
const defaultSettings = {
    speed: 1000,
    viewerMultiplier: 25,
    words: 'hey, gg, wow, lol, poggers, ez, noob, kappa, omg, lets go, nice, amazing, ratio, sheesh, help, lmao, rofl, cool, insane, hot, go go go, clutch, too good, legend, idk, chill, smooth, rep, hype',
    usernames: 'DarkGamer42, xXProPlayerXx, StreamViewer123, NinjaFan2000, TwitchUser, EliteSniper, CasualGamer, ProGamerUSA, ViewerRandom, ChatMaster, KappaKing, PogChampion, NoScope360, GameLover, StreamFan99, EpicPlayer, LolMaster, GGWinner, ToxicBoi, FriendlyGuy, ShadowHunter, PixelWarrior, NightOwl23, ThunderBolt, IceQueen, FireStorm, DragonSlayer, PhoenixRise, CosmicRay, QuantumLeap, NeonLight, CyberPunk, RetroGamer, AlphaWolf, BetaTest, GammaRay, DeltaForce, EchoBase, FoxtrotGaming, GolfClub, HotelCalifornia, IndigoChild, JulietRose, KiloBytes, LimaPeru, MikeCheck, NovemberRain, OscarWild, PapaJohn, QuebecCity, RomeoGaming, SierraLeone, TangoDown, UniformCode, VictorHugo, WhiskeyTango, XrayVision, YankeeFootball, ZuluTime, AceVentura, BlazeRunner, ChaosMaster, DreamCatcher, EdgeLord, FrostBite, GhostRecon, HyperDrive, IronFist, JadeWarrior, KryptonGamer, LaserFocus, MysticForce, NitroBoost, OmegaPoint, PulseRider, QuasarGaming, RazorEdge, SonicBoom, TitanFall, UltraViolet, VenomStrike, WarpSpeed, XenonPulse, YinYang, ZeroGravity, BinaryCode, CryptoMiner, DataStream, EtherealGamer, FluxCapacitor, GridLocked, HexEditor, IconicPlayer, JavaBeans, KernelPanic, LogicGate, MatrixRunner, NodeMaster, OverClock, PixelPerfect, QuantumBit, RouterKing, SyntaxError, TerminalVelocity, UserSpace, VectorGraphics, WebCrawler, XMLParser, YottaByte, ZettaFlops',
    emotesEnabled: true,
    colorsEnabled: true,
    emoteOnlyEnabled: false,
    botMessagesEnabled: false,
    botMessage: '📢 Don\'t forget to follow the channel! Join our Discord. Thanks for your support! 💜',
    botDelay: 30,
    width: 600,
    height: 700,
    responsiveEnabled: true
};

// Store custom settings before applying presets
let customSettings = null;

function saveCustomSettings() {
    customSettings = {
        speed: speedSlider.value,
        viewerMultiplier: viewerMultiplier.value,
        words: wordsInput.value,
        usernames: usernamesInput.value,
        emotesEnabled: emotesCheckbox?.checked,
        colorsEnabled: colorsCheckbox?.checked,
        emoteOnlyEnabled: emoteOnlyCheckbox?.checked,
        botMessagesEnabled: botMessagesCheckbox?.checked,
        botMessage: botMessageInput?.value,
        botDelay: botDelaySlider?.value,
        width: widthSlider?.value,
        height: heightSlider?.value,
        responsiveEnabled: responsiveCheckbox?.checked
    };

    // Save to localStorage as well for persistence
    localStorage.setItem('customChatSettings', JSON.stringify(customSettings));
}

function restoreCustomSettings() {
    if (!customSettings) {
        // Try to load from localStorage if not in memory
        const saved = localStorage.getItem('customChatSettings');
        if (saved) {
            customSettings = JSON.parse(saved);
        } else {
            return; // No custom settings to restore
        }
    }

    // Restore all settings
    speedSlider.value = customSettings.speed;
    speedValue.textContent = customSettings.speed + 'ms';
    updateSliderProgress(speedSlider);

    viewerMultiplier.value = customSettings.viewerMultiplier;
    multiplierValue.textContent = customSettings.viewerMultiplier;
    updateSliderProgress(viewerMultiplier);

    wordsInput.value = customSettings.words;
    usernamesInput.value = customSettings.usernames;

    if (emotesCheckbox) emotesCheckbox.checked = customSettings.emotesEnabled;
    if (colorsCheckbox) colorsCheckbox.checked = customSettings.colorsEnabled;
    if (emoteOnlyCheckbox) emoteOnlyCheckbox.checked = customSettings.emoteOnlyEnabled;

    if (botMessagesCheckbox) {
        botMessagesCheckbox.checked = customSettings.botMessagesEnabled;
        if (botConfigSection) {
            botConfigSection.style.display = customSettings.botMessagesEnabled ? 'block' : 'none';
        }
    }

    if (botMessageInput) botMessageInput.value = customSettings.botMessage;
    if (botDelaySlider) {
        botDelaySlider.value = customSettings.botDelay;
        botDelayValue.textContent = customSettings.botDelay + ' seconds';
        updateSliderProgress(botDelaySlider);
    }

    if (widthSlider) {
        widthSlider.value = customSettings.width;
        widthValue.textContent = customSettings.width + 'px';
        updateSliderProgress(widthSlider);
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer && !responsiveCheckbox?.checked) {
            chatContainer.style.width = customSettings.width + 'px';
        }
    }

    if (heightSlider) {
        heightSlider.value = customSettings.height;
        heightValue.textContent = customSettings.height + 'px';
        updateSliderProgress(heightSlider);
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer && !responsiveCheckbox?.checked) {
            chatContainer.style.height = customSettings.height + 'px';
        }
    }

    if (responsiveCheckbox) responsiveCheckbox.checked = customSettings.responsiveEnabled;

    // Update active usernames and save
    updateActiveUsernames();
    saveAllSettings();
}

// Reset settings function
function resetSettings() {
    if (confirm('⚠️ Are you sure you want to reset ALL settings?\n\nThis will delete:\n• All your custom settings\n• All custom emojis\n• All custom badges\n• Default emoji states\n• Badge states\n\nThis action is IRREVERSIBLE!')) {
        // Clear ALL localStorage
        localStorage.clear();

        // Reset scenario selector
        const scenarioSelect = document.getElementById('scenario-select');
        if (scenarioSelect) {
            scenarioSelect.value = '';
        }

        // Apply default settings
        speedSlider.value = defaultSettings.speed;
        speedValue.textContent = defaultSettings.speed + 'ms';
        updateSliderProgress(speedSlider);

        viewerMultiplier.value = defaultSettings.viewerMultiplier;
        multiplierValue.textContent = defaultSettings.viewerMultiplier;
        updateSliderProgress(viewerMultiplier);

        wordsInput.value = defaultSettings.words;
        usernamesInput.value = defaultSettings.usernames;

        if (emotesCheckbox) emotesCheckbox.checked = defaultSettings.emotesEnabled;
        if (colorsCheckbox) colorsCheckbox.checked = defaultSettings.colorsEnabled;
        if (emoteOnlyCheckbox) emoteOnlyCheckbox.checked = defaultSettings.emoteOnlyEnabled;
        if (botMessagesCheckbox) {
            botMessagesCheckbox.checked = defaultSettings.botMessagesEnabled;
            if (botConfigSection) {
                botConfigSection.style.display = defaultSettings.botMessagesEnabled ? 'block' : 'none';
            }
        }
        if (botMessageInput) botMessageInput.value = defaultSettings.botMessage;
        if (botDelaySlider) {
            botDelaySlider.value = defaultSettings.botDelay;
            botDelayValue.textContent = defaultSettings.botDelay + ' seconds';
            updateSliderProgress(botDelaySlider);
        }
        if (widthSlider) {
            widthSlider.value = defaultSettings.width;
            widthValue.textContent = defaultSettings.width + 'px';
            updateSliderProgress(widthSlider);
        }
        if (heightSlider) {
            heightSlider.value = defaultSettings.height;
            heightValue.textContent = defaultSettings.height + 'px';
            updateSliderProgress(heightSlider);
        }
        if (responsiveCheckbox) responsiveCheckbox.checked = defaultSettings.responsiveEnabled;

        // Reset chat container size
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer && !defaultSettings.responsiveEnabled) {
            chatContainer.style.width = defaultSettings.width + 'px';
            chatContainer.style.height = defaultSettings.height + 'px';
        }

        // Reset ALL custom emotes and badges
        customEmotes = [];
        customBadges = [];

        // Clear the custom emotes display
        const customEmotesList = document.getElementById('custom-emotes-list');
        if (customEmotesList) {
            customEmotesList.innerHTML = '';
        }

        // Clear the custom badges display
        const customBadgesList = document.getElementById('custom-badges-list');
        if (customBadgesList) {
            customBadgesList.innerHTML = '';
        }

        // Reset ALL default emojis to enabled
        defaultEmojis.forEach(emoji => {
            emoji.enabled = true;
            const checkbox = document.getElementById(`emoji-${emoji.name}`);
            if (checkbox) checkbox.checked = true;
        });

        // Reset ALL badges to enabled
        const allBadgeCheckboxes = document.querySelectorAll('#badges-container input[type="checkbox"]');
        allBadgeCheckboxes.forEach(checkbox => {
            checkbox.checked = true;
        });

        // Reset theme to default (dark)
        document.body.classList.remove('light-theme');
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) themeToggle.checked = false;

        // Reset default emojis
        activeDefaultEmotes = [...allDefaultEmotes];
        initDefaultEmojis();

        // Reset badge states
        Object.keys(badgeTypes).forEach(type => {
            const checkbox = document.getElementById(`badge-${type}`);
            if (checkbox) checkbox.checked = true;
        });

        // Update active usernames
        updateActiveUsernames();

        // Save the reset state
        saveAllSettings();

        // Show confirmation
        alert('✅ All settings have been reset!');
    }
}

// Apply scenario
function applyScenario(scenarioKey) {
    if (!scenarioKey || !scenarios[scenarioKey]) return;

    const scenario = scenarios[scenarioKey];

    // Apply settings
    speedSlider.value = scenario.speed;
    speedValue.textContent = scenario.speed + 'ms';
    updateSliderProgress(speedSlider);

    viewerMultiplier.value = scenario.viewerMultiplier;
    multiplierValue.textContent = scenario.viewerMultiplier;
    updateSliderProgress(viewerMultiplier);

    wordsInput.value = scenario.words;

    if (emotesCheckbox) emotesCheckbox.checked = scenario.emotesEnabled;
    if (colorsCheckbox) colorsCheckbox.checked = scenario.colorsEnabled;
    if (emoteOnlyCheckbox) emoteOnlyCheckbox.checked = scenario.emoteOnlyEnabled;

    if (botMessagesCheckbox) {
        botMessagesCheckbox.checked = scenario.botMessagesEnabled;
        if (botConfigSection) {
            botConfigSection.style.display = scenario.botMessagesEnabled ? 'block' : 'none';
        }
    }

    if (botMessageInput) botMessageInput.value = scenario.botMessage;
    if (botDelaySlider) {
        botDelaySlider.value = scenario.botDelay;
        botDelayValue.textContent = scenario.botDelay + ' seconds';
        updateSliderProgress(botDelaySlider);
    }

    // Save selected scenario
    localStorage.setItem('selectedScenario', scenarioKey);

    // Save settings
    saveAllSettings();

    // Show notification
    const notification = document.createElement('div');
    notification.className = 'scenario-notification';
    notification.textContent = `🎭 ${scenario.name} scenario applied!`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Browser compatibility system
window.closeBrowserBanner = function() {
    const banner = document.getElementById('browser-banner');
    if (banner) {
        banner.style.animation = 'slideDownBanner 0.3s ease-out forwards';
        setTimeout(() => {
            banner.style.display = 'none';
        }, 300);
        sessionStorage.setItem('browserWarningAcknowledged', 'true');
    }
}

// Test function to show banner manually
window.testBrowserBanner = function() {
    sessionStorage.removeItem('browserWarningAcknowledged');
    const banner = document.getElementById('browser-banner');
    const bannerText = document.getElementById('browser-banner-text');

    if (banner && bannerText) {
        bannerText.textContent = 'Test: Certaines fonctionnalités peuvent ne pas fonctionner correctement.';
        banner.style.display = 'block';
        console.log('Test banner shown');
    }
}

// Function to check which browser is detected
window.checkBrowser = function() {
    const userAgent = navigator.userAgent;
    console.log('Full User Agent:', userAgent);

    if (userAgent.indexOf("Edg") > -1) {
        console.log('✅ Microsoft Edge detected');
        return 'Edge';
    }
    else if (userAgent.indexOf("Chrome") > -1 && userAgent.indexOf("Safari") > -1) {
        console.log('✅ Chrome detected');
        return 'Chrome';
    }
    else if (userAgent.indexOf("Firefox") > -1) {
        console.log('⚠️ Firefox detected');
        return 'Firefox';
    }
    else if (userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") === -1) {
        console.log('🚫 Safari detected');
        return 'Safari';
    }
    else {
        console.log('❓ Unknown browser');
        return 'Unknown';
    }
}

function initBrowserCompatibility() {
    // Better browser detection
    const getBrowser = () => {
        const userAgent = navigator.userAgent;

        // Check for Edge first (it contains "Chrome" in UA)
        if (userAgent.indexOf("Edg") > -1) {
            return 'edge';
        }
        // Check for Chrome
        else if (userAgent.indexOf("Chrome") > -1 && userAgent.indexOf("Safari") > -1) {
            return 'chrome';
        }
        // Check for Firefox
        else if (userAgent.indexOf("Firefox") > -1) {
            return 'firefox';
        }
        // Check for Safari
        else if (userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") === -1) {
            return 'safari';
        }
        // Other
        else {
            return 'other';
        }
    };

    const browser = getBrowser();
    console.log('Detected browser:', browser);

    // Skip if already acknowledged this session
    if (sessionStorage.getItem('browserWarningAcknowledged')) {
        return;
    }

    // Only show for Firefox and Safari
    if (browser !== 'firefox' && browser !== 'safari') {
        return;
    }

    const banner = document.getElementById('browser-banner');
    const bannerText = document.getElementById('browser-banner-text');

    if (!banner || !bannerText) {
        return;
    }

    if (browser === 'firefox') {
        bannerText.textContent = 'Firefox détecté: L\'export vidéo MP4 ne fonctionnera pas. Seul le format WebM est supporté.';
        banner.classList.add('firefox');
    } else if (browser === 'safari') {
        bannerText.textContent = 'Safari détecté: Support très limité. L\'export vidéo peut ne pas fonctionner.';
        banner.classList.add('safari');
    }

    // Show the banner
    banner.style.display = 'block';
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize browser compatibility check
    initBrowserCompatibility();

    loadAllSettings();
    loadDefaultEmojisState();
    initDefaultEmojis();
    loadBadgeStates();
    updateActiveUsernames();
    setupTabs();


    // Update all slider progress bars after settings are loaded
    updateSliderProgress(speedSlider);
    updateSliderProgress(viewerMultiplier);
    if (widthSlider) updateSliderProgress(widthSlider);
    if (heightSlider) updateSliderProgress(heightSlider);
    if (botDelaySlider) updateSliderProgress(botDelaySlider);

    if (stopBtn) {
        stopBtn.disabled = true;
    }

    // Connect reset button
    const resetBtn = document.getElementById('reset-settings-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSettings);
    }

    // Connect scenario selector
    const scenarioSelect = document.getElementById('scenario-select');
    if (scenarioSelect) {
        // Restore last selected scenario
        const savedScenario = localStorage.getItem('selectedScenario');
        if (savedScenario && scenarios[savedScenario]) {
            scenarioSelect.value = savedScenario;
        }

        scenarioSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                // Save current settings before applying preset
                if (!localStorage.getItem('selectedScenario')) {
                    // Only save custom settings if we're not already on a preset
                    saveCustomSettings();
                }
                applyScenario(e.target.value);
                // Keep the selected option visible
            } else {
                // If "Choose a Preset" is selected, restore custom settings
                localStorage.removeItem('selectedScenario');
                restoreCustomSettings();

                // Show notification
                const notification = document.createElement('div');
                notification.className = 'scenario-notification';
                notification.textContent = '🎨 Custom settings restored!';
                document.body.appendChild(notification);

                setTimeout(() => {
                    notification.classList.add('fade-out');
                    setTimeout(() => notification.remove(), 300);
                }, 2000);
            }
        });
    }
});

