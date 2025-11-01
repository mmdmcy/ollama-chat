// --- GLOBAL STATE ---
let currentChatId = null;
let chatHistory = [];
let currentModel = 'qwen3:1.7b';
let isGenerating = false;
let currentController = null; // AbortController for canceling requests
let availableModels = [];
let pendingAttachments = []; // processed attachments ready to send
let timelineEntries = []; // {el, target}
const modelCapabilitiesCache = new Map(); // name -> {vision, tools, thinking}

// Get a random dark theme as default
function getRandomDarkTheme() {
    const darkThemes = ['nebula-dark', 'odysseus-dark', 'aurora-dark', 'coral-dark', 'cosmic-dark', 'ember-dark', 'contrast-dark'];
    return darkThemes[Math.floor(Math.random() * darkThemes.length)];
}

// Initialize default user preferences
function getDefaultPreferences() {
    return {
        theme: 'odysseus-dark', // Default to Odysseus Dark (matches screenshot)
        model: '', // No default model - let user select after detection
        readingDirection: 'ltr', // 'ltr' or 'rtl'
        fontSize: 'medium', // 'small', 'medium', 'large'
        showTimestamps: true,
        autoSave: true,
        compactMode: false,
        showThinking: true,
        useConversationContext: true, // New preference for conversation context
        enableOCR: true,
        ocrLang: 'eng',
        collapseThinkingDefault: false,
        enableWebSearch: false,
        searchEngine: 'duckduckgo',
        braveApiKey: '',
        searchProxy: ''
    };
}

// User preferences with defaults
let userPreferences = getDefaultPreferences();

// --- DOM ELEMENTS ---
const DOMElements = {
    app: document.getElementById('app'),
    chatList: document.getElementById('chatList'),
    modelSelect: document.getElementById('modelSelect'),
    themeSelect: document.getElementById('themeSelect'),
    currentModelHeader: document.getElementById('currentModelHeader'), // May not exist
    currentModelHeaderMobile: document.getElementById('currentModelHeaderMobile'),
    chatContainer: document.getElementById('chatContainer'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    fileInput: document.getElementById('fileInput'),
    attachmentsPreview: document.getElementById('attachmentsPreview'),
    timelineNav: document.getElementById('timelineNav'),
    sidebar: document.querySelector('.sidebar'),
    settingsModal: null,
    settingsThemeSelect: null,
    settingsModelSelect: null,
    fontSizeSelect: null,
    readingDirectionSelect: null,
    showTimestamps: null,
    showThinking: null,
    compactMode: null,
    autoSave: null,
    useConversationContext: null
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements that are created later
    DOMElements.settingsModal = document.getElementById('settingsModal');
    DOMElements.settingsThemeSelect = document.getElementById('settingsThemeSelect');
    DOMElements.settingsModelSelect = document.getElementById('settingsModelSelect');
    DOMElements.fontSizeSelect = document.getElementById('fontSizeSelect');
    DOMElements.readingDirectionSelect = document.getElementById('readingDirectionSelect');
    DOMElements.showTimestamps = document.getElementById('showTimestamps');
    DOMElements.showThinking = document.getElementById('showThinking');
    DOMElements.compactMode = document.getElementById('compactMode');
    DOMElements.autoSave = document.getElementById('autoSave');
    DOMElements.useConversationContext = document.getElementById('useConversationContext');
    DOMElements.enableOCR = document.getElementById('enableOCR');
    DOMElements.ocrLangSelect = document.getElementById('ocrLangSelect');
    DOMElements.collapseThinkingDefault = document.getElementById('collapseThinkingDefault');
    DOMElements.enableWebSearch = document.getElementById('enableWebSearch');
    DOMElements.searchEngineSelect = document.getElementById('searchEngineSelect');
    DOMElements.braveApiKey = document.getElementById('braveApiKey');
    DOMElements.searchProxy = document.getElementById('searchProxy');
    DOMElements.fileInput = document.getElementById('fileInput');
    DOMElements.attachmentsPreview = document.getElementById('attachmentsPreview');
    
    // Add event listeners to settings modal elements
    if (DOMElements.settingsThemeSelect) {
        DOMElements.settingsThemeSelect.addEventListener('change', (e) => updatePreference('theme', e.target.value));
    }
    if (DOMElements.fontSizeSelect) {
        DOMElements.fontSizeSelect.addEventListener('change', (e) => updatePreference('fontSize', e.target.value));
    }
    if (DOMElements.readingDirectionSelect) {
        DOMElements.readingDirectionSelect.addEventListener('change', (e) => updatePreference('readingDirection', e.target.value));
    }
    if (DOMElements.settingsModelSelect) {
        DOMElements.settingsModelSelect.addEventListener('change', (e) => updatePreference('model', e.target.value));
    }
    if (DOMElements.showTimestamps) {
        DOMElements.showTimestamps.addEventListener('change', (e) => updatePreference('showTimestamps', e.target.checked));
    }
    if (DOMElements.showThinking) {
        DOMElements.showThinking.addEventListener('change', (e) => updatePreference('showThinking', e.target.checked));
    }
    if (DOMElements.enableOCR) {
        DOMElements.enableOCR.addEventListener('change', (e) => updatePreference('enableOCR', e.target.checked));
    }
    if (DOMElements.ocrLangSelect) {
        DOMElements.ocrLangSelect.addEventListener('change', (e) => updatePreference('ocrLang', e.target.value));
    }
    if (DOMElements.collapseThinkingDefault) {
        DOMElements.collapseThinkingDefault.addEventListener('change', (e) => updatePreference('collapseThinkingDefault', e.target.checked));
    }
    if (DOMElements.enableWebSearch) {
        DOMElements.enableWebSearch.addEventListener('change', (e) => updatePreference('enableWebSearch', e.target.checked));
    }
    if (DOMElements.searchEngineSelect) {
        DOMElements.searchEngineSelect.addEventListener('change', (e) => updatePreference('searchEngine', e.target.value));
    }
    if (DOMElements.braveApiKey) {
        DOMElements.braveApiKey.addEventListener('change', (e) => updatePreference('braveApiKey', e.target.value));
    }
    if (DOMElements.searchProxy) {
        DOMElements.searchProxy.addEventListener('change', (e) => updatePreference('searchProxy', e.target.value));
    }
    if (DOMElements.compactMode) {
        DOMElements.compactMode.addEventListener('change', (e) => updatePreference('compactMode', e.target.checked));
    }
    if (DOMElements.autoSave) {
        DOMElements.autoSave.addEventListener('change', (e) => updatePreference('autoSave', e.target.checked));
    }
    if (DOMElements.useConversationContext) {
        DOMElements.useConversationContext.addEventListener('change', (e) => updatePreference('useConversationContext', e.target.checked));
    }
    
    loadPreferences();
    loadChatHistory();
    initializeUI();
    
    // Fetch models after UI is initialized
    fetchAvailableModels();
    
    DOMElements.messageInput.focus();
});

function initializeUI() {
    console.log('Initializing UI...');
    
    // Only update model display if we have a model set
    if (userPreferences.model && currentModel) {
        updateModelDisplay(currentModel);
    }
    
    applyUserPreferences();
    
    console.log('Chat history length:', chatHistory.length);
    if (chatHistory.length === 0) {
        console.log('No chat history found, starting with welcome screen...');
        // Don't create a chat until the user actually sends a message
        renderWelcomeScreen();
        currentChatId = null; // No active chat yet
    } else {
        console.log('Loading existing chat history...');
        const lastChatId = chatHistory[0].id;
        loadChat(lastChatId);
    }
    console.log('UI initialization complete');
}

// --- THEME & PREFERENCES ---
async function loadPreferences() {
    try {
        // Load preferences from localStorage
        const localData = localStorage.getItem('ollamaPreferences');
        if (localData) {
            const data = JSON.parse(localData);
            Object.assign(userPreferences, data);
            console.log('Preferences loaded from localStorage');
        } else {
            console.log('No existing preferences found, using defaults');
            await savePreferences();
        }
    } catch (error) {
        // Use default preferences and save them
        console.log('Error loading preferences, using defaults:', error);
        await savePreferences();
    }
    
    // Apply the loaded preferences
    applyUserPreferences();
}

async function savePreferences() {
    const preferences = {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        ...userPreferences
    };
    
    try {
        // Save to localStorage for persistence
        localStorage.setItem('ollamaPreferences', JSON.stringify(preferences));
        console.log('Preferences saved to localStorage');
    } catch (error) {
        console.error('Failed to save preferences:', error);
    }
}

function applyUserPreferences() {
    // Apply theme
    setTheme(userPreferences.theme);
    if (DOMElements.themeSelect) {
        DOMElements.themeSelect.value = userPreferences.theme;
    }
    
    // Apply reading direction
    DOMElements.app.classList.toggle('rtl-mode', userPreferences.readingDirection === 'rtl');
    
    // Apply font size
    DOMElements.app.className = DOMElements.app.className.replace(/font-(small|medium|large)/, '');
    DOMElements.app.classList.add(`font-${userPreferences.fontSize}`);
    
    // Apply compact mode
    DOMElements.app.classList.toggle('compact-mode', userPreferences.compactMode);
    
    // Update settings modal if it exists
    if (DOMElements.settingsThemeSelect) {
        DOMElements.settingsThemeSelect.value = userPreferences.theme;
    }
    if (DOMElements.fontSizeSelect) {
        DOMElements.fontSizeSelect.value = userPreferences.fontSize;
    }
    if (DOMElements.readingDirectionSelect) {
        DOMElements.readingDirectionSelect.value = userPreferences.readingDirection;
    }
    if (DOMElements.showTimestamps) {
        DOMElements.showTimestamps.checked = userPreferences.showTimestamps;
    }
    if (DOMElements.showThinking) {
        DOMElements.showThinking.checked = userPreferences.showThinking;
    }
    if (DOMElements.compactMode) {
        DOMElements.compactMode.checked = userPreferences.compactMode;
    }
    if (DOMElements.autoSave) {
        DOMElements.autoSave.checked = userPreferences.autoSave;
    }
    if (DOMElements.useConversationContext) {
        DOMElements.useConversationContext.checked = userPreferences.useConversationContext;
    }
    if (DOMElements.enableOCR) {
        DOMElements.enableOCR.checked = userPreferences.enableOCR;
    }
    if (DOMElements.ocrLangSelect) {
        DOMElements.ocrLangSelect.value = userPreferences.ocrLang;
    }
    if (DOMElements.collapseThinkingDefault) {
        DOMElements.collapseThinkingDefault.checked = userPreferences.collapseThinkingDefault;
    }
    if (DOMElements.enableWebSearch) {
        DOMElements.enableWebSearch.checked = userPreferences.enableWebSearch;
    }
    if (DOMElements.searchEngineSelect) {
        DOMElements.searchEngineSelect.value = userPreferences.searchEngine;
    }
    if (DOMElements.braveApiKey) {
        DOMElements.braveApiKey.value = userPreferences.braveApiKey;
    }
    if (DOMElements.searchProxy) {
        DOMElements.searchProxy.value = userPreferences.searchProxy;
    }
}

// Fetch available models from Ollama
async function fetchAvailableModels() {
    try {
        console.log('🔍 Fetching available models from Ollama...');
        const response = await fetch('http://localhost:11434/api/tags');
        if (response.ok) {
            const data = await response.json();
            availableModels = data.models || [];
            console.log(`✅ Successfully loaded ${availableModels.length} models:`, availableModels.map(m => m.name));
            populateModelSelect();
            showModelStatus('success', `Found ${availableModels.length} models`);
        } else {
            console.error('❌ Failed to fetch models:', response.status, response.statusText);
            showModelStatus('error', `Failed to connect to Ollama (${response.status})`);
            // No fallback models - user must have Ollama running with models
            availableModels = [];
            populateModelSelect();
        }
    } catch (error) {
        console.error('❌ Error fetching models:', error);
        
        // Check if this is a CORS issue (common when opening HTML file directly)
        if (error.message.includes('fetch') || error.message.includes('CORS')) {
            showModelStatus('error', 'CORS Error - Use local server (see README)');
        } else {
            showModelStatus('error', 'Cannot connect to Ollama - is it running?');
        }
        
        // No fallback models - user must have Ollama running with models
        availableModels = [];
        populateModelSelect();
    }
}

// Show model loading status
function showModelStatus(type, message) {
    // Create or update status message in model select areas
    const statusClass = type === 'success' ? 'model-status-success' : 'model-status-error';
    const statusMessage = `<small class="${statusClass}"><i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i> ${message}</small>`;
    
    // Update sidebar model status
    const sidebarModelArea = DOMElements.modelSelect.parentElement;
    let sidebarStatus = sidebarModelArea.querySelector('.model-status');
    if (!sidebarStatus) {
        sidebarStatus = document.createElement('div');
        sidebarStatus.className = 'model-status';
        sidebarModelArea.appendChild(sidebarStatus);
    }
    sidebarStatus.innerHTML = statusMessage;
    
    // Update settings model status if exists
    if (DOMElements.settingsModelSelect) {
        const settingsModelArea = DOMElements.settingsModelSelect.parentElement;
        let settingsStatus = settingsModelArea.querySelector('.model-status');
        if (!settingsStatus) {
            settingsStatus = document.createElement('div');
            settingsStatus.className = 'model-status';
            settingsModelArea.appendChild(settingsStatus);
        }
        settingsStatus.innerHTML = statusMessage;
        
        // Clean up settings status after delay
        setTimeout(() => {
            if (settingsStatus && settingsStatus.parentElement) {
                settingsStatus.remove();
            }
        }, 5000);
    }
    
    // Clean up sidebar status after delay
    setTimeout(() => {
        if (sidebarStatus && sidebarStatus.parentElement) {
            sidebarStatus.remove();
        }
    }, 5000);
}

// Populate the model select dropdown
function populateModelSelect() {
    const modelSelect = DOMElements.modelSelect;
    modelSelect.innerHTML = '';
    
    // Also populate settings model select if it exists
    if (DOMElements.settingsModelSelect) {
        DOMElements.settingsModelSelect.innerHTML = '';
    }
    
    if (availableModels.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No models detected - Check Ollama';
        option.disabled = true;
        option.selected = true;
        modelSelect.appendChild(option);
        
        if (DOMElements.settingsModelSelect) {
            const settingsOption = document.createElement('option');
            settingsOption.value = '';
            settingsOption.textContent = 'No models detected - Check Ollama';
            settingsOption.disabled = true;
            settingsOption.selected = true;
            DOMElements.settingsModelSelect.appendChild(settingsOption);
        }
        
        currentModel = '';
        userPreferences.model = '';
    } else {
        // Add actual models first
        availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = withCapabilityIcons(model.name, null);
            modelSelect.appendChild(option);
            
            if (DOMElements.settingsModelSelect) {
                const settingsOption = document.createElement('option');
                settingsOption.value = model.name;
                settingsOption.textContent = withCapabilityIcons(model.name, null);
                DOMElements.settingsModelSelect.appendChild(settingsOption);
            }
            // Fetch capabilities async and update labels when they arrive
            fetchModelCapabilities(model.name).then(caps => {
                updateOptionLabel(modelSelect, model.name, caps);
                if (DOMElements.settingsModelSelect) {
                    updateOptionLabel(DOMElements.settingsModelSelect, model.name, caps);
                }
            }).catch(() => {});
        });
        
        // Simple selection logic
        if (userPreferences.model && availableModels.some(model => model.name === userPreferences.model)) {
            // Use saved preference if it exists
            currentModel = userPreferences.model;
        } else {
            // Just use the first available model
            currentModel = availableModels[0].name;
            userPreferences.model = currentModel;
        }
        
        modelSelect.value = currentModel;
        if (DOMElements.settingsModelSelect) {
            DOMElements.settingsModelSelect.value = currentModel;
        }
        
        console.log(`✅ Selected model: ${currentModel}`);
    }
    
    // Add refresh option at the end
    const refreshOption = document.createElement('option');
    refreshOption.value = 'refresh';
    refreshOption.textContent = '🔄 Refresh Models';
    modelSelect.appendChild(refreshOption);
    
    if (DOMElements.settingsModelSelect) {
        const settingsRefreshOption = document.createElement('option');
        settingsRefreshOption.value = 'refresh';
        settingsRefreshOption.textContent = '🔄 Refresh Models';
        DOMElements.settingsModelSelect.appendChild(settingsRefreshOption);
    }
    
    // Update the header display
    updateModelDisplay(currentModel);
}

function updateOptionLabel(selectEl, modelName, caps) {
    const opt = Array.from(selectEl.options).find(o => o.value === modelName);
    if (opt) opt.textContent = withCapabilityIcons(modelName, caps);
}

function withCapabilityIcons(modelName, caps) {
    const c = caps || modelCapabilitiesCache.get(modelName) || {};
    const icons = [
        c.vision ? '👁️' : '',
        c.tools ? '🛠️' : '',
        c.thinking ? '🤔' : ''
    ].filter(Boolean).join(' ');
    return icons ? `${modelName}  ${icons}` : modelName;
}

async function fetchModelCapabilities(modelName) {
    if (modelCapabilitiesCache.has(modelName)) return modelCapabilitiesCache.get(modelName);
    // Only trust explicit capabilities from Ollama's show endpoint.
    let vision = false;
    let thinking = false;
    let tools = false;
    try {
        const resp = await fetch('http://localhost:11434/api/show', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName })
        });
        if (resp.ok) {
            const data = await resp.json();
            // recursive search for a string array named "capabilities"
            const found = [];
            (function walk(obj) {
                if (!obj || typeof obj !== 'object') return;
                for (const [k, v] of Object.entries(obj)) {
                    if (k.toLowerCase() === 'capabilities' && Array.isArray(v)) {
                        found.push(...v.map(x => String(x).toLowerCase()));
                    } else if (v && typeof v === 'object') {
                        walk(v);
                    }
                }
            })(data);
            if (found.length > 0) {
                vision = found.includes('vision');
                tools = found.includes('tools') || found.includes('tool');
                thinking = found.includes('thinking') || found.includes('think');
            }
        }
    } catch (_) {}
    const caps = { vision, tools, thinking };
    modelCapabilitiesCache.set(modelName, caps);
    return caps;
}

function changeTheme() {
    const theme = DOMElements.themeSelect.value;
    userPreferences.theme = theme;
    setTheme(theme);
    savePreferences();
}

function setTheme(themeName) {
    DOMElements.app.dataset.theme = themeName;
}

// --- MODEL MANAGEMENT ---
// --- GLOBAL FUNCTIONS (needed for HTML onclick/onchange) ---
window.changeTheme = function() {
    const theme = DOMElements.themeSelect.value;
    userPreferences.theme = theme;
    setTheme(theme);
    savePreferences();
};

window.changeModel = function() {
    const selectedValue = DOMElements.modelSelect.value;
    
    // Handle refresh models option
    if (selectedValue === 'refresh') {
        console.log('🔄 Refreshing models...');
        fetchAvailableModels();
        return;
    }
    
    currentModel = selectedValue;
    userPreferences.model = currentModel;
    updateModelDisplay(currentModel);
    savePreferences();
    DOMElements.messageInput.focus();
};

window.openUserSettings = function() {
    const modal = DOMElements.settingsModal;
    if (modal) {
        modal.style.display = 'block';
        syncSettingsWithPreferences();
    }
};

window.closeUserSettings = function() {
    const modal = DOMElements.settingsModal;
    if (modal) {
        modal.style.display = 'none';
    }
};

window.toggleSidebar = function() {
    DOMElements.sidebar.classList.toggle('hidden');
};

function syncSettingsWithPreferences() {
    // Update settings modal with current preferences
    if (DOMElements.settingsThemeSelect) {
        DOMElements.settingsThemeSelect.value = userPreferences.theme;
    }
    if (DOMElements.settingsModelSelect) {
        DOMElements.settingsModelSelect.value = userPreferences.model;
    }
    if (DOMElements.fontSizeSelect) {
        DOMElements.fontSizeSelect.value = userPreferences.fontSize;
    }
    if (DOMElements.readingDirectionSelect) {
        DOMElements.readingDirectionSelect.value = userPreferences.readingDirection;
    }
    if (DOMElements.showTimestamps) {
        DOMElements.showTimestamps.checked = userPreferences.showTimestamps;
    }
    if (DOMElements.showThinking) {
        DOMElements.showThinking.checked = userPreferences.showThinking;
    }
    if (DOMElements.compactMode) {
        DOMElements.compactMode.checked = userPreferences.compactMode;
    }
    if (DOMElements.autoSave) {
        DOMElements.autoSave.checked = userPreferences.autoSave;
    }
    if (DOMElements.useConversationContext) {
        DOMElements.useConversationContext.checked = userPreferences.useConversationContext;
    }
}

function updateModelDisplay(modelName) {
    if (!modelName) return;
    
    const friendlyName = modelName.split(':')[0];
    
    // Safely update header elements if they exist
    if (DOMElements.currentModelHeader) {
        DOMElements.currentModelHeader.textContent = friendlyName;
    }
    if (DOMElements.currentModelHeaderMobile) {
        DOMElements.currentModelHeaderMobile.textContent = friendlyName;
    }
}

function toggleModelSelector() {
    // In a real app, this would open a model selection modal.
    // For now, we can just log it.
    console.log("Model selector toggled");
}

// --- CHAT MANAGEMENT ---
function startNewChat(save = true) {
    currentChatId = generateChatId();
    console.log('Starting new chat with ID:', currentChatId);
    renderWelcomeScreen(); // Show welcome screen for new chat
    
    if (save) {
        const newChat = {
            id: currentChatId,
            title: 'New Chat',
            timestamp: new Date().toISOString(),
            messages: []
        };
        chatHistory.unshift(newChat);
        console.log('New chat added to history. Total chats:', chatHistory.length);
        saveChatHistory();
        renderChatHistory();
    }
    
    updateActiveChatItem();
    DOMElements.messageInput.focus();
}

function loadChat(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) return;

    currentChatId = chatId;
    clearChatContainer();

    if (chat.messages.length === 0) {
        renderWelcomeScreen();
    } else {
        chat.messages.forEach(msg => displayMessage(msg));
    }
    
    updateActiveChatItem();
    scrollToBottom();
}

function generateChatId() {
    return `chat_${Date.now()}`;
}

// --- HISTORY & STORAGE ---
async function loadChatHistory() {
    try {
        // Load from localStorage only
        const localData = localStorage.getItem('ollamaChatHistory');
        if (localData) {
            const data = JSON.parse(localData);
            chatHistory = data.chats || [];
            console.log('Chat history loaded from localStorage');
        } else {
            console.log('No existing chat history found, starting fresh');
            chatHistory = [];
        }
    } catch (error) {
        console.log('Error loading chat history, starting fresh:', error);
        chatHistory = [];
    }
    renderChatHistory();
}

async function saveChatHistory() {
    const historyData = {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        chats: chatHistory
    };
    
    try {
        // Save to localStorage for persistence
        localStorage.setItem('ollamaChatHistory', JSON.stringify(historyData));
        console.log('Chat history saved to localStorage');
    } catch (error) {
        console.error('Failed to save chat history:', error);
    }
}

// --- DATA MANAGEMENT ---
function exportChatHistory() {
    // Get current chat history from localStorage or memory
    const historyData = {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        chats: chatHistory
    };
    
    const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ollama-chat-history.json';
    a.click();
    URL.revokeObjectURL(url);
}

function exportPreferences() {
    // Export current preferences
    const preferences = {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
        ...userPreferences
    };
    
    const blob = new Blob([JSON.stringify(preferences, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ollama-preferences.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Clear all stored data (for testing/reset purposes)
function clearAllData() {
    if (confirm('Clear all chat history and preferences? This cannot be undone.')) {
        // Clear localStorage
        localStorage.removeItem('ollamaChatHistory');
        localStorage.removeItem('ollamaPreferences');
        
        // Reset to defaults
        chatHistory = [];
        userPreferences = getDefaultPreferences();
        currentModel = userPreferences.model;
        currentChatId = null; // Reset current chat
        
        // Apply and save new defaults
        applyUserPreferences();
        saveChatHistory();
        savePreferences();
        
        // Update UI
        renderChatHistory();
        renderWelcomeScreen(); // Show welcome screen instead of creating empty chat
        
        alert('All data cleared successfully!');
    }
}

function importChatHistory(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate the data structure
            if (data.chats && Array.isArray(data.chats)) {
                // Ask for confirmation
                const shouldReplace = confirm(
                    `Import ${data.chats.length} chat(s)? This will replace your current chat history.`
                );
                
                if (shouldReplace) {
                    chatHistory = data.chats;
                    saveChatHistory(); // This will now save to localStorage
                    renderChatHistory();
                    
                    // Load the first chat if available
                    if (chatHistory.length > 0) {
                        loadChat(chatHistory[0].id);
                    } else {
                        startNewChat(true);
                    }
                    
                    alert('Chat history imported successfully!');
                }
            } else {
                alert('Invalid chat history file format.');
            }
        } catch (error) {
            alert('Error reading chat history file: ' + error.message);
        }
    };
    
    reader.readAsText(file);
    
    // Reset the file input
    event.target.value = '';
}

function renderChatHistory() {
    DOMElements.chatList.innerHTML = '';
    chatHistory.forEach((chat, index) => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        
        const chatTitle = document.createElement('span');
        chatTitle.className = 'chat-title';
        chatTitle.textContent = chat.title;
        chatTitle.onclick = () => loadChat(chat.id);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'chat-delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteChat(chat.id, index);
        };
        deleteBtn.title = 'Delete chat';
        
        chatItem.appendChild(chatTitle);
        chatItem.appendChild(deleteBtn);
        DOMElements.chatList.appendChild(chatItem);
    });
}

// Delete a specific chat
function deleteChat(chatId, index) {
    if (confirm('Delete this conversation? This cannot be undone.')) {
        // Remove from chat history
        chatHistory.splice(index, 1);
        
        // Save updated history
        saveChatHistory();
        
        // If we deleted the current chat, load another one or show welcome
        if (currentChatId === chatId) {
            if (chatHistory.length > 0) {
                loadChat(chatHistory[0].id);
            } else {
                currentChatId = null;
                renderWelcomeScreen();
            }
        }
        
        // Re-render chat history
        renderChatHistory();
        updateActiveChatItem();
    }
}

function updateActiveChatItem() {
    const items = DOMElements.chatList.querySelectorAll('.chat-item');
    items.forEach((item, index) => {
        if (chatHistory[index] && chatHistory[index].id === currentChatId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function addMessageToHistory(message) {
    const chat = chatHistory.find(c => c.id === currentChatId);
    if (!chat) {
        console.error('Current chat not found in history!', currentChatId);
        return;
    }

    chat.messages.push(message);
    console.log('Message added to chat:', chat.id, 'Total messages:', chat.messages.length);

    if (chat.messages.length === 1 && message.role === 'user') {
        chat.title = message.content.substring(0, 40) + (message.content.length > 40 ? '...' : '');
        console.log('Chat title updated:', chat.title);
    }
    
    saveChatHistory();
    renderChatHistory();
    updateActiveChatItem();
}

// --- MESSAGE HANDLING ---
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const content = DOMElements.messageInput.value.trim();
    if (!content && pendingAttachments.length === 0) return;
    if (isGenerating) return;

    // Check if a model is selected
    if (!currentModel) {
        alert('Please select a model first from the dropdown menu.');
        return;
    }

    // Create a new chat if none exists (first message)
    if (!currentChatId) {
        console.log('Creating first chat because none exists...');
        startNewChat(true);
    }

    // Always jump to latest when sending a message
    forceScrollBottom();

    isGenerating = true;
    currentController = new AbortController(); // Create abort controller for this request
    setLoadingState(true);

    // Build images array for Ollama + embed text attachments
    const imageAttachments = pendingAttachments
        .filter(a => a.type === 'image')
        .map(a => a.base64);

    const textBlocks = pendingAttachments
        .filter(a => a.type === 'text')
        .map(a => `Attached file: ${a.name}\n\n\n\`\`\`\n${a.text}\n\`\`\``);

    const combinedContent = [content, ...textBlocks].filter(Boolean).join('\n\n');

    const userMessage = { role: 'user', content: combinedContent };
    displayMessage(userMessage);
    addMessageToHistory(userMessage);

    DOMElements.messageInput.value = '';
    autoResize(DOMElements.messageInput);
    scrollToBottom();

    try {
        const response = await callOllamaAPI(combinedContent, imageAttachments);
        // The response is now handled within callOllamaAPI for streaming
        // We just need to add it to history
        const assistantMessage = { role: 'assistant', ...response };
        addMessageToHistory(assistantMessage);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Request was cancelled');
            return; // Don't show error message for cancelled requests
        }
        
        console.error('Ollama API error:', error);
        const errorMessage = {
            role: 'assistant',
            content: `Error: ${error.message}. Please ensure Ollama is running.`
        };
        displayMessage(errorMessage);
        addMessageToHistory(errorMessage);
    } finally {
        isGenerating = false;
        currentController = null;
        setLoadingState(false);
        // clear attachments after send attempt
        clearAttachments();
        DOMElements.messageInput.focus();
        scrollToBottom();
    }
}

async function callOllamaAPI(message, images = []) {
    const chat = chatHistory.find(c => c.id === currentChatId);
    let messages = [];
    
    // Build message array without duplicating the latest user message
    if (userPreferences.useConversationContext && chat) {
        messages = chat.messages.map(m => ({ role: m.role, content: m.content }));
    } else {
        messages = [{ role: 'user', content: message }];
    }
    // Attach images to the last user message if present
    if (images && images.length > 0) {
        let idx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') { idx = i; break; }
        }
        if (idx >= 0) {
            messages[idx] = { ...messages[idx], images };
        } else {
            messages.push({ role: 'user', content: message, images });
        }
    }

    // Create a placeholder message element for immediate feedback
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper';
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<i class="fas fa-robot"></i>';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Status pill (live)
    const statusPill = document.createElement('div');
    statusPill.className = 'status-pill';
    const attachInfo = images.length > 0 ? ` • ${images.length} image(s)` : '';
    statusPill.innerHTML = `<i class="fas fa-cog fa-spin"></i> Preparing prompt${attachInfo}...`;
    contentDiv.appendChild(statusPill);

    // Create thinking section (hidden unless we detect reasoning)
    const thinkingSection = document.createElement('div');
    thinkingSection.className = 'thinking-section';
    thinkingSection.style.display = userPreferences.showThinking ? 'block' : 'none';
    thinkingSection.innerHTML = `
        <div class="thinking-header">
            <i class="fas fa-brain"></i> 
            <span>🤔 Thinking...</span>
            <div class="thinking-dots">
                <span>.</span><span>.</span><span>.</span>
            </div>
            <i class="fas fa-chevron-up caret"></i>
        </div>
        <div class="thinking-content"></div>
    `;
    // Collapsible toggle
    thinkingSection.querySelector('.thinking-header').addEventListener('click', () => {
        thinkingSection.classList.toggle('collapsed');
    });
    if (userPreferences.collapseThinkingDefault) {
        thinkingSection.classList.add('collapsed');
    }
    
    // Create web search section (hidden until used)
    const webSearchSection = document.createElement('div');
    webSearchSection.className = 'web-search-section';
    webSearchSection.style.display = 'none';
    webSearchSection.innerHTML = `
        <div class="web-search-header"><i class="fas fa-search"></i> Web search results</div>
        <ul class="web-results"></ul>
    `;

    // Create main response section
    const responseSection = document.createElement('div');
    responseSection.className = 'response-section';
    responseSection.style.display = 'none';
    
    // Dev stats footer
    const statsFooter = document.createElement('div');
    statsFooter.className = 'dev-stats';
    statsFooter.style.display = 'none';
    statsFooter.innerHTML = '<div class="stat-row">\
        <span class="stat"><i class="fas fa-clock"></i> <span id="statElapsed">0.0s</span></span>\
        <span class="stat"><i class="fas fa-bolt"></i> <span id="statTokens">0</span> tok</span>\
        <span class="stat"><i class="fas fa-tachometer-alt"></i> <span id="statTps">0</span> tok/s</span>\
        <span class="stat"><i class="fas fa-calendar"></i> <span id="statTime"></span></span>\
        <span class="stat"><i class="fas fa-robot"></i> <span id="statModel"></span></span>\
    </div>';

    contentDiv.appendChild(thinkingSection);
    contentDiv.appendChild(webSearchSection);
    contentDiv.appendChild(responseSection);
    contentDiv.appendChild(statsFooter);
    messageDiv.append(avatar, contentDiv);
    
    // Add copy button that will be updated as content changes
    const copyBtn = document.createElement('button');
    copyBtn.className = 'message-copy-btn';
    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
    copyBtn.title = 'Copy message';
    
    messageWrapper.append(messageDiv, copyBtn);
    
    clearWelcomeScreen();
    DOMElements.chatContainer.appendChild(messageWrapper);
    scrollToBottom();

    // Register assistant placeholder in timeline immediately
    registerTimelineItem('assistant', messageWrapper);

    // Now send the request
    const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: currentController ? currentController.signal : undefined,
        body: JSON.stringify({ model: currentModel, messages, stream: true })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorBody}`);
    }

    statusPill.innerHTML = '<i class="fas fa-server"></i> Waiting for model...';

    let fullContent = '';
    let thinking = '';
    let actualResponse = '';
    let isInThinking = false;
    let hasStartedResponse = false;
    const startTime = Date.now();
    let firstTokenTime = null;
    let evalCount = 0; // tokens generated
    let evalDurationNs = 0; // ns
    let promptEvalCount = 0;
    let receivedChars = 0;

    const timeLabel = statsFooter.querySelector('#statTime');
    if (timeLabel) timeLabel.textContent = new Date().toLocaleString();

    const elapsedLabel = statsFooter.querySelector('#statElapsed');
    const tokensLabel = statsFooter.querySelector('#statTokens');
    const tpsLabel = statsFooter.querySelector('#statTps');
    const modelLabel = statsFooter.querySelector('#statModel');
    if (modelLabel) modelLabel.textContent = currentModel;

    // periodic timer to update elapsed
    const timer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsedLabel) elapsedLabel.textContent = `${elapsed.toFixed(1)}s`;
        if (tpsLabel && evalCount > 0 && evalDurationNs > 0) {
            const tps = evalCount / (evalDurationNs / 1e9);
            tpsLabel.textContent = tps.toFixed(2);
        } else if (tpsLabel && firstTokenTime && receivedChars > 0) {
            const sec = (Date.now() - firstTokenTime) / 1000;
            if (sec > 0) tpsLabel.textContent = (receivedChars / 4 / sec).toFixed(2); // rough char->token
        }
    }, 200);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.trim() === '') continue;
                
                try {
                    const data = JSON.parse(line);

                    // Some models may send reasoning/thinking separately
                    const reasoningChunk = data.thinking || data.reasoning || (data.message && (data.message.thinking || data.message.reasoning));
                    if (reasoningChunk && userPreferences.showThinking) {
                        thinking += reasoningChunk;
                        thinkingSection.style.display = 'block';
                        thinkingSection.querySelector('.thinking-content').innerHTML = formatMessage(thinking);
                    }

                    // Detect web search requests in the stream, e.g. <search>query</search>
                    if (userPreferences.enableWebSearch) {
                        const searches = [];
                        const regex = /<search>(.*?)<\/search>/g;
                        let match;
                        while ((match = regex.exec((reasoningChunk || '') + (data.message && data.message.content ? data.message.content : ''))) !== null) {
                            const q = match[1].trim();
                            if (q) searches.push(q);
                        }
                        for (const q of searches) {
                            // Run search (debounced per final unique query)
                            scheduleWebSearch(q, webSearchSection);
                        }
                    }

                    if (data.message && data.message.content) {
                        const newContent = data.message.content;
                        fullContent += newContent;
                        receivedChars += newContent.length;
                        if (!firstTokenTime) firstTokenTime = Date.now();

                        // Check for thinking tags
                        if (userPreferences.showThinking && (newContent.includes('<think>') || newContent.includes('<thinking>'))) {
                            isInThinking = true;
                            thinkingSection.style.display = 'block';
                        }

                        if (isInThinking) {
                            thinking += newContent;
                            
                            // Extract and display thinking content (remove tags)
                            let displayThinking = thinking
                                .replace(/<think>/g, '')
                                .replace(/<thinking>/g, '')
                                .replace(/<\/think>/g, '')
                                .replace(/<\/thinking>/g, '');
                            
                            thinkingSection.querySelector('.thinking-content').innerHTML = formatMessage(displayThinking);
                            
                            // Check if thinking is complete
                            if (newContent.includes('</think>') || newContent.includes('</thinking>')) {
                                isInThinking = false;
                                thinkingSection.querySelector('.thinking-header span').textContent = 'Thought process:';
                                thinkingSection.querySelector('.thinking-dots').style.display = 'none';
                            }
                        } else {
                            // This is the actual response
                            if (!hasStartedResponse) {
                                hasStartedResponse = true;
                                responseSection.style.display = 'block';
                                statusPill.innerHTML = '<i class="fas fa-stream"></i> Streaming...';
                            }
                            actualResponse += newContent;
                            responseSection.innerHTML = formatMessage(actualResponse);
                        }

                        scrollToBottom();
                    }
                } catch (e) {
                    // Skip invalid JSON lines
                    continue;
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    // Clean up the final content
    let finalThinking = null;
    let finalContent = actualResponse;

    // If no actual response was captured outside thinking tags, extract from fullContent
    if (!finalContent && fullContent) {
        const thinkRegex = /<(?:think|thinking)>.*?<\/(?:think|thinking)>/gs;
        finalContent = fullContent.replace(thinkRegex, '').trim();
        
        const thinkMatch = fullContent.match(/<(?:think|thinking)>(.*?)<\/(?:think|thinking)>/s);
        if (thinkMatch) {
            finalThinking = thinkMatch[1].trim();
        }
    } else if (thinking) {
        finalThinking = thinking
            .replace(/<think>/g, '')
            .replace(/<thinking>/g, '')
            .replace(/<\/think>/g, '')
            .replace(/<\/thinking>/g, '')
            .trim();
    }

    // Update copy button with final content
    copyBtn.onclick = () => copyMessage(finalContent);

    // Parse final stats if provided by Ollama
    // These are available on the final JSON with done=true
    try {
        const finalObj = JSON.parse(fullContent); // unlikely; keep try-catch guard
        if (finalObj && finalObj.done) {
            evalCount = finalObj.eval_count || evalCount;
            evalDurationNs = finalObj.eval_duration || evalDurationNs;
            promptEvalCount = finalObj.prompt_eval_count || promptEvalCount;
        }
    } catch (_) {
        // ignore
    }

    // Some implementations emit a separate final line; we attempt to find it in the stream too
    // Fallback: when streaming ends, status becomes Completed
    statusPill.innerHTML = '<i class="fas fa-check"></i> Completed';
    clearInterval(timer);

    // Ensure thinking animation is finalized
    try {
        const dots = thinkingSection.querySelector('.thinking-dots');
        if (dots) dots.style.display = 'none';
        const label = thinkingSection.querySelector('.thinking-header span');
        if (label) label.textContent = 'Thought process:';
    } catch (_) {}

    // Show stats
    statsFooter.style.display = 'block';
    const finalTokens = (evalCount || Math.round(receivedChars / 4));
    if (tokensLabel) tokensLabel.textContent = finalTokens.toString();
    if (tpsLabel) {
        if (evalCount > 0 && evalDurationNs > 0) {
            const tps = evalCount / (evalDurationNs / 1e9);
            tpsLabel.textContent = tps.toFixed(2);
        } else if (firstTokenTime) {
            const sec = (Date.now() - firstTokenTime) / 1000;
            tpsLabel.textContent = sec > 0 ? (receivedChars / 4 / sec).toFixed(2) : '0';
        }
    }

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const tokensPerSecond = parseFloat(tpsLabel ? tpsLabel.textContent : '0') || 0;
    const stats = {
        evalCount: finalTokens,
        evalDurationNs,
        promptEvalCount,
        tokensPerSecond,
        elapsedSeconds,
        timestamp: new Date().toISOString(),
        model: currentModel
    };

    return { content: finalContent, thinking: finalThinking, stats, model: currentModel };
}

// --- UI RENDERING ---
function displayMessage(message) {
    clearWelcomeScreen();
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper';

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = message.role === 'user' ? 'U' : '<i class="fas fa-robot"></i>';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (message.thinking && userPreferences.showThinking) {
        contentDiv.innerHTML += `
            <div class="thinking-section">
                <div class="thinking-header"><i class="fas fa-brain"></i> Thinking...</div>
                <div>${formatMessage(message.thinking)}</div>
            </div>`;
    }
    contentDiv.innerHTML += formatMessage(message.content);

    // If persisted stats/model exist (from history), show a compact footer
    if (message.stats || message.model) {
        const stats = message.stats || {};
        const footer = document.createElement('div');
        footer.className = 'dev-stats';
        const tokens = stats.evalCount != null ? stats.evalCount : '';
        const tps = stats.tokensPerSecond != null ? stats.tokensPerSecond.toFixed ? stats.tokensPerSecond.toFixed(2) : stats.tokensPerSecond : '';
        const elapsed = stats.elapsedSeconds != null ? `${Number(stats.elapsedSeconds).toFixed(1)}s` : '';
        const time = stats.timestamp ? new Date(stats.timestamp).toLocaleString() : '';
        const model = message.model || stats.model || '';
        footer.innerHTML = `<div class="stat-row">
            ${elapsed ? `<span class="stat"><i class="fas fa-clock"></i> ${elapsed}</span>` : ''}
            ${tokens !== '' ? `<span class="stat"><i class="fas fa-bolt"></i> ${tokens} tok</span>` : ''}
            ${tps !== '' ? `<span class="stat"><i class="fas fa-tachometer-alt"></i> ${tps} tok/s</span>` : ''}
            ${time ? `<span class="stat"><i class="fas fa-calendar"></i> ${time}</span>` : ''}
            ${model ? `<span class="stat"><i class="fas fa-robot"></i> ${model}</span>` : ''}
        </div>`;
        contentDiv.appendChild(footer);
    }

    messageDiv.append(avatar, contentDiv);

    // Add copy button below the message content
    const copyBtn = document.createElement('button');
    copyBtn.className = 'message-copy-btn';
    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
    copyBtn.onclick = () => copyMessage(message.content);
    copyBtn.title = 'Copy message';

    messageWrapper.append(messageDiv, copyBtn);
    DOMElements.chatContainer.appendChild(messageWrapper);

    // Register in timeline
    registerTimelineItem(message.role, messageWrapper);
}

// Copy message content to clipboard
function copyMessage(content) {
    navigator.clipboard.writeText(content).then(() => {
        // Show feedback - could add a toast notification here
        console.log('Message copied to clipboard');
    }).catch(err => {
        console.error('Failed to copy message:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    });
}

function formatMessage(content) {
    // First escape HTML to prevent XSS
    let formattedContent = escapeHtml(content);
    
    // Handle code blocks with language detection (triple backticks)
    formattedContent = formattedContent.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
        const lang = language || 'text';
        const codeId = 'code_' + Math.random().toString(36).substr(2, 9);
        return `
            <div class="code-block">
                <div class="code-header">
                    <span class="code-language">${lang}</span>
                    <button class="copy-code-btn" onclick="copyCode('${codeId}')" title="Copy code">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <pre><code id="${codeId}" class="language-${lang}">${code.trim()}</code></pre>
            </div>
        `;
    });
    
    // Handle single backtick code blocks (common with AI responses)
    // Look for patterns like `python\ncode\n` or `\ncode\n`
    formattedContent = formattedContent.replace(/`(\w+)?\n([\s\S]*?)\n`/g, (match, language, code) => {
        const lang = language || 'text';
        const codeId = 'code_' + Math.random().toString(36).substr(2, 9);
        return `
            <div class="code-block">
                <div class="code-header">
                    <span class="code-language">${lang}</span>
                    <button class="copy-code-btn" onclick="copyCode('${codeId}')" title="Copy code">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <pre><code id="${codeId}" class="language-${lang}">${code.trim()}</code></pre>
            </div>
        `;
    });
    
    // Handle single backtick multi-line code without language
    formattedContent = formattedContent.replace(/`\n([\s\S]*?)\n`/g, (match, code) => {
        const codeId = 'code_' + Math.random().toString(36).substr(2, 9);
        return `
            <div class="code-block">
                <div class="code-header">
                    <span class="code-language">text</span>
                    <button class="copy-code-btn" onclick="copyCode('${codeId}')" title="Copy code">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <pre><code id="${codeId}" class="language-text">${code.trim()}</code></pre>
            </div>
        `;
    });
    
    // Handle inline code (single backticks with no newlines)
    formattedContent = formattedContent.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
    
    // Handle other markdown-like formatting
    formattedContent = formattedContent
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    
    return formattedContent;
}

function clearChatContainer() {
    DOMElements.chatContainer.innerHTML = '';
    clearTimeline();
}

function renderWelcomeScreen() {
    clearChatContainer();
    DOMElements.chatContainer.innerHTML = `
        <div class="welcome-screen">
            <div class="logo-container">
                <h1 class="main-logo">Ollama</h1>
            </div>
        </div>`;
}

function clearWelcomeScreen() {
    const welcomeScreen = DOMElements.chatContainer.querySelector('.welcome-screen');
    if (welcomeScreen) welcomeScreen.remove();
}

// --- UI UTILITIES ---
function toggleSidebar() {
    DOMElements.sidebar.classList.toggle('hidden');
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function scrollToBottom() {
    if (shouldAutoScroll()) {
        DOMElements.chatContainer.scrollTop = DOMElements.chatContainer.scrollHeight;
    }
}

function shouldAutoScroll() {
    const el = DOMElements.chatContainer;
    const threshold = 80; // px from bottom considered "at bottom"
    return (el.scrollHeight - (el.scrollTop + el.clientHeight)) < threshold;
}

// Update auto-scroll detection as user scrolls
DOMElements.chatContainer.addEventListener('scroll', () => {
    // No-op: shouldAutoScroll() reads from DOM live; this listener exists to ensure we react to user intent
    updateActiveTimeline();
});

function forceScrollBottom() {
    DOMElements.chatContainer.scrollTop = DOMElements.chatContainer.scrollHeight;
}

function registerTimelineItem(role, targetEl) {
    if (!DOMElements.timelineNav) return;
    const btn = document.createElement('button');
    btn.className = `timeline-item ${role}`;
    btn.title = role === 'user' ? 'Your message' : 'AI response';
    btn.onclick = () => scrollToMessage(targetEl);
    DOMElements.timelineNav.appendChild(btn);
    timelineEntries.push({ el: btn, target: targetEl });
}

function clearTimeline() {
    timelineEntries = [];
    if (DOMElements.timelineNav) DOMElements.timelineNav.innerHTML = '';
}

function scrollToMessage(targetEl) {
    const offset = targetEl.offsetTop - 60; // account for header
    DOMElements.chatContainer.scrollTo({ top: offset, behavior: 'smooth' });
}

function updateActiveTimeline() {
    if (!timelineEntries.length) return;
    const scrollTop = DOMElements.chatContainer.scrollTop;
    let active = 0;
    for (let i = 0; i < timelineEntries.length; i++) {
        const y = timelineEntries[i].target.offsetTop;
        if (y <= scrollTop + 80) active = i; else break;
    }
    timelineEntries.forEach((e, i) => e.el.classList.toggle('active', i === active));
}

// --- Web Search Tool ---
const executedSearches = new Set();

function scheduleWebSearch(query, section) {
    const key = query.toLowerCase();
    if (executedSearches.has(key)) return;
    executedSearches.add(key);
    performWebSearch(query).then(results => {
        if (!results || results.length === 0) return;
        section.style.display = 'block';
        const list = section.querySelector('.web-results');
        results.slice(0, 5).forEach(r => {
            const li = document.createElement('li');
            li.className = 'web-result-item';
            li.innerHTML = `<a href="${r.url}" target="_blank" rel="noopener">${escapeHtml(r.title || r.url)}</a><br><small>${escapeHtml(r.snippet || '')}</small>`;
            list.appendChild(li);
        });
    }).catch(err => {
        console.warn('Web search failed:', err);
    });
}

async function performWebSearch(query) {
    const engine = userPreferences.searchEngine || 'duckduckgo';
    const proxy = userPreferences.searchProxy || '';
    if (engine === 'brave') {
        if (!userPreferences.braveApiKey) throw new Error('Brave API key missing');
        const base = 'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(query);
        const url = proxy ? proxy + encodeURIComponent(base) : base;
        const headers = proxy ? {} : { 'X-Subscription-Token': userPreferences.braveApiKey };
        const resp = await fetch(url, { headers });
        const data = await resp.json();
        const items = (data && data.web && data.web.results) ? data.web.results : [];
        return items.map(i => ({ title: i.title, url: i.url, snippet: i.description }));
    } else {
        // DuckDuckGo Instant Answer API (no key, CORS ok)
        const base = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
        const url = proxy ? proxy + encodeURIComponent(base) : base;
        const resp = await fetch(url);
        const data = await resp.json();
        const results = [];
        if (data.AbstractURL) results.push({ title: data.Heading || data.Abstract, url: data.AbstractURL, snippet: data.AbstractText || '' });
        if (Array.isArray(data.RelatedTopics)) {
            for (const t of data.RelatedTopics) {
                if (t.FirstURL && t.Text) results.push({ title: t.Text, url: t.FirstURL, snippet: '' });
            }
        }
        return results;
    }
}

function setLoadingState(isLoading) {
    DOMElements.sendBtn.disabled = isLoading;
    if (isLoading) {
        DOMElements.sendBtn.style.display = 'none';
        DOMElements.cancelBtn.style.display = 'flex';
    } else {
        DOMElements.sendBtn.style.display = 'flex';
        DOMElements.cancelBtn.style.display = 'none';
    }
}

// Cancel the current generation
function cancelGeneration() {
    if (currentController) {
        currentController.abort();
        currentController = null;
    }
    isGenerating = false;
    setLoadingState(false);
    
    // Add a cancellation message
    const cancelMessage = {
        role: 'assistant',
        content: '*Generation cancelled by user*'
    };
    displayMessage(cancelMessage);
    addMessageToHistory(cancelMessage);
    
    DOMElements.messageInput.focus();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Copy code to clipboard
function copyCode(codeId) {
    const codeElement = document.getElementById(codeId);
    if (codeElement) {
        const text = codeElement.textContent;
        navigator.clipboard.writeText(text).then(() => {
            // Show feedback
            const button = codeElement.parentElement.parentElement.querySelector('.copy-code-btn');
            const originalHtml = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.style.color = 'var(--accent-primary)';
            
            setTimeout(() => {
                button.innerHTML = originalHtml;
                button.style.color = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy code:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        });
    }
}

// --- SETTINGS MODAL FUNCTIONS ---
// (Global functions defined above for HTML compatibility)

function saveUserSettings() {
    // Update preferences from settings modal
    if (DOMElements.settingsThemeSelect) {
        userPreferences.theme = DOMElements.settingsThemeSelect.value;
    }
    if (DOMElements.settingsModelSelect) {
        userPreferences.model = DOMElements.settingsModelSelect.value;
        currentModel = userPreferences.model;
    }
    if (DOMElements.fontSizeSelect) {
        userPreferences.fontSize = DOMElements.fontSizeSelect.value;
    }
    if (DOMElements.readingDirectionSelect) {
        userPreferences.readingDirection = DOMElements.readingDirectionSelect.value;
    }
    if (DOMElements.showTimestamps) {
        userPreferences.showTimestamps = DOMElements.showTimestamps.checked;
    }
    if (DOMElements.showThinking) {
        userPreferences.showThinking = DOMElements.showThinking.checked;
    }
    if (DOMElements.compactMode) {
        userPreferences.compactMode = DOMElements.compactMode.checked;
    }
    if (DOMElements.autoSave) {
        userPreferences.autoSave = DOMElements.autoSave.checked;
    }

    // Apply the new preferences
    applyUserPreferences();
    
    // Update the main UI elements
    if (DOMElements.themeSelect) {
        DOMElements.themeSelect.value = userPreferences.theme;
    }
    if (DOMElements.modelSelect) {
        DOMElements.modelSelect.value = userPreferences.model;
        updateModelDisplay(userPreferences.model);
    }
    
    // Save preferences
    savePreferences();
    
    // Close modal
    closeUserSettings();
}

// --- ATTACHMENTS ---
window.triggerFilePicker = function() {
    if (DOMElements.fileInput) DOMElements.fileInput.click();
};

window.handleFileSelection = function(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const readers = files.map(file => new Promise(resolve => {
        if (file.type.startsWith('image/')) {
            const r = new FileReader();
            r.onload = () => {
                const dataUrl = (r.result || '').toString();
                const base64 = dataUrl.replace(/^data:[^,]+,/, '');
                pendingAttachments.push({ type: 'image', name: file.name, mime: file.type, base64 });
                if (userPreferences.enableOCR) {
                    ocrImageDataUrl(dataUrl).then(text => {
                        if (text && text.trim().length > 0) {
                            pendingAttachments.push({ type: 'text', name: file.name + ' (OCR)', mime: 'text/plain', text });
                            renderAttachmentsPreview();
                        }
                    }).catch(() => {});
                }
                resolve();
            };
            r.readAsDataURL(file);
        } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            const r = new FileReader();
            r.onload = async () => {
                try {
                    let text = await extractPdfText(r.result);
                    if (userPreferences.enableOCR && (!text || text.trim().length < 50)) {
                        text = await extractPdfTextWithOcr(r.result);
                    }
                    pendingAttachments.push({ type: 'text', name: file.name, mime: file.type, text });
                } catch (e) {
                    pendingAttachments.push({ type: 'text', name: file.name, mime: file.type, text: '[Failed to extract PDF text]' });
                }
                resolve();
            };
            r.readAsArrayBuffer(file);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx')) {
            const r = new FileReader();
            r.onload = async () => {
                try {
                    const text = await extractDocxText(r.result);
                    pendingAttachments.push({ type: 'text', name: file.name, mime: file.type, text });
                } catch (e) {
                    pendingAttachments.push({ type: 'text', name: file.name, mime: file.type, text: '[Failed to extract DOCX text]' });
                }
                resolve();
            };
            r.readAsArrayBuffer(file);
        } else if (file.type === 'application/msword' || file.name.toLowerCase().endsWith('.doc')) {
            pendingAttachments.push({ type: 'text', name: file.name, mime: file.type, text: '[Legacy .doc not supported. Please convert to .docx]' });
            resolve();
        } else if (file.type === 'application/vnd.ms-powerpoint' || file.name.toLowerCase().endsWith('.ppt')) {
            pendingAttachments.push({ type: 'text', name: file.name, mime: file.type, text: '[Legacy .ppt not supported. Please convert to .pptx]' });
            resolve();
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || file.name.toLowerCase().endsWith('.pptx')) {
            const r = new FileReader();
            r.onload = async () => {
                try {
                    const text = await extractPptxText(r.result);
                    pendingAttachments.push({ type: 'text', name: file.name, mime: file.type, text });
                } catch (e) {
                    pendingAttachments.push({ type: 'text', name: file.name, mime: file.type, text: '[Failed to extract PPTX text]' });
                }
                resolve();
            };
            r.readAsArrayBuffer(file);
        } else if (
            file.type === 'application/vnd.ms-excel' || file.name.toLowerCase().endsWith('.xls') ||
            file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.toLowerCase().endsWith('.xlsx') ||
            file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
        ) {
            const r = new FileReader();
            if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
                r.onload = () => {
                    const text = (r.result || '').toString();
                    pendingAttachments.push({ type: 'text', name: file.name, mime: 'text/csv', text });
                    resolve();
                };
                r.readAsText(file);
            } else {
                r.onload = async () => {
                    try {
                        const text = await extractXlsxText(r.result, file.name);
                        pendingAttachments.push({ type: 'text', name: file.name, mime: file.type, text });
                    } catch (e) {
                        pendingAttachments.push({ type: 'text', name: file.name, mime: file.type, text: '[Failed to extract spreadsheet text]' });
                    }
                    resolve();
                };
                r.readAsArrayBuffer(file);
            }
        } else {
            // Read as text; cap very large files to avoid UI freezes
            const maxBytes = 512 * 1024; // 512KB
            const slice = file.slice(0, maxBytes);
            const r = new FileReader();
            r.onload = () => {
                const text = (r.result || '').toString();
                const truncated = file.size > maxBytes ? `${text}\n\n... [truncated ${file.size - maxBytes} bytes]` : text;
                pendingAttachments.push({ type: 'text', name: file.name, mime: file.type || 'text/plain', text: truncated });
                resolve();
            };
            r.readAsText(slice);
        }
    }));

    Promise.all(readers).then(renderAttachmentsPreview);
};

function renderAttachmentsPreview() {
    if (!DOMElements.attachmentsPreview) return;
    DOMElements.attachmentsPreview.innerHTML = '';
    pendingAttachments.forEach((att, idx) => {
        const chip = document.createElement('div');
        chip.className = 'attachment-chip';
        const icon = att.type === 'image' ? '<i class="fas fa-image"></i>' : '<i class="fas fa-file-alt"></i>';
        chip.innerHTML = `${icon} <span>${att.name}</span>`;

        const remove = document.createElement('button');
        remove.className = 'attachment-remove';
        remove.innerHTML = '<i class="fas fa-times"></i>';
        remove.title = 'Remove';
        remove.onclick = () => removeAttachment(idx);
        chip.appendChild(remove);
        DOMElements.attachmentsPreview.appendChild(chip);
    });
}

function removeAttachment(index) {
    pendingAttachments.splice(index, 1);
    renderAttachmentsPreview();
}

function clearAttachments() {
    pendingAttachments = [];
    if (DOMElements.fileInput) DOMElements.fileInput.value = '';
    renderAttachmentsPreview();
}

// --- Document extraction helpers ---
async function extractPdfText(arrayBuffer) {
    if (!window.pdfjsLib) throw new Error('pdfjsLib not loaded');
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const strings = content.items.map(i => i.str);
        text += strings.join(' ') + '\n\n';
    }
    const maxChars = 800000; // ~0.8MB of text
    if (text.length > maxChars) {
        return text.slice(0, maxChars) + `\n\n... [truncated ${text.length - maxChars} chars]`;
    }
    return text;
}

async function extractDocxText(arrayBuffer) {
    if (!window.mammoth) throw new Error('mammoth not loaded');
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    const text = result.value || '';
    const maxChars = 800000;
    if (text.length > maxChars) {
        return text.slice(0, maxChars) + `\n\n... [truncated ${text.length - maxChars} chars]`;
    }
    return text;
}

async function extractPptxText(arrayBuffer) {
    if (!window.JSZip) throw new Error('JSZip not loaded');
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slideFiles = Object.keys(zip.files).filter(n => n.match(/^ppt\/slides\/slide\d+\.xml$/));
    slideFiles.sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
        const nb = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
        return na - nb;
    });
    let text = '';
    for (const name of slideFiles) {
        const xmlString = await zip.files[name].async('string');
        const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
        const nodes = Array.from(doc.getElementsByTagName('a:t'));
        const slideText = nodes.map(n => n.textContent).join(' ');
        text += `Slide ${text ? (slideFiles.indexOf(name) + 1) : 1}:\n${slideText}\n\n`;
    }
    return text || '[No extractable text found in PPTX]';
}

async function extractXlsxText(arrayBuffer, filename) {
    if (!window.XLSX) throw new Error('XLSX not loaded');
    const data = new Uint8Array(arrayBuffer);
    const wb = XLSX.read(data, { type: 'array' });
    let out = '';
    wb.SheetNames.forEach((name) => {
        const ws = wb.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(ws);
        out += `# Sheet: ${name}\n${csv}\n`;
    });
    return out || `[Empty spreadsheet: ${filename}]`;
}

async function ocrImageDataUrl(dataUrl) {
    if (!window.Tesseract) throw new Error('Tesseract not loaded');
    const { data } = await Tesseract.recognize(dataUrl, 'eng');
    return (data && data.text) ? data.text.trim() : '';
}

async function extractPdfTextWithOcr(arrayBuffer) {
    if (!window.pdfjsLib) throw new Error('pdfjsLib not loaded');
    if (!window.Tesseract) throw new Error('Tesseract not loaded');
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        const { data } = await Tesseract.recognize(dataUrl, 'eng');
        text += (data && data.text ? data.text : '') + '\n\n';
    }
    return text.trim();
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    if (event.target === DOMElements.settingsModal) {
        closeUserSettings();
    }
}

// Update individual preference (called from settings modal)
function updatePreference(key, value) {
    userPreferences[key] = value;
    
    // Special handling for model change
    if (key === 'model') {
        currentModel = value;
        updateModelDisplay(value);
        if (DOMElements.modelSelect) {
            DOMElements.modelSelect.value = value;
        }
    }
    
    // Apply the preference immediately
    applyUserPreferences();
    
    // Save preferences
    savePreferences();
}

// Reset to default preferences
function resetToDefaults() {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
        // Reset to defaults
        userPreferences = getDefaultPreferences();
        
        // Update current model
        currentModel = userPreferences.model;
        
        // Apply new preferences
        applyUserPreferences();
        
        // Save preferences
        savePreferences();
    }
}
