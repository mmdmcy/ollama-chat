// --- GLOBAL STATE ---
let currentChatId = null;
let chatHistory = [];
let currentModel = 'qwen3:1.7b';
let isGenerating = false;
let currentController = null; // AbortController for canceling requests
let availableModels = [];

// Get a random dark theme as default
function getRandomDarkTheme() {
    const darkThemes = ['aurora-dark', 'coral-dark', 'cosmic-dark', 'ember-dark', 'contrast-dark'];
    return darkThemes[Math.floor(Math.random() * darkThemes.length)];
}

// Initialize default user preferences
function getDefaultPreferences() {
    return {
        theme: 'contrast-dark', // Default to high contrast dark theme
        model: '', // No default model - let user select after detection
        readingDirection: 'ltr', // 'ltr' or 'rtl'
        fontSize: 'medium', // 'small', 'medium', 'large'
        showTimestamps: true,
        autoSave: true,
        compactMode: false,
        showThinking: true,
        useConversationContext: true // New preference for conversation context
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
            option.textContent = model.name;
            modelSelect.appendChild(option);
            
            if (DOMElements.settingsModelSelect) {
                const settingsOption = document.createElement('option');
                settingsOption.value = model.name;
                settingsOption.textContent = model.name;
                DOMElements.settingsModelSelect.appendChild(settingsOption);
            }
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
    if (!content || isGenerating) return;

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

    isGenerating = true;
    currentController = new AbortController(); // Create abort controller for this request
    setLoadingState(true);

    const userMessage = { role: 'user', content };
    displayMessage(userMessage);
    addMessageToHistory(userMessage);

    DOMElements.messageInput.value = '';
    autoResize(DOMElements.messageInput);
    scrollToBottom();

    try {
        const response = await callOllamaAPI(content);
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
        DOMElements.messageInput.focus();
        scrollToBottom();
    }
}

async function callOllamaAPI(message) {
    const chat = chatHistory.find(c => c.id === currentChatId);
    let messages = [];
    
    // Include conversation context if enabled
    if (userPreferences.useConversationContext && chat) {
        messages = chat.messages.map(m => ({ role: m.role, content: m.content }));
    }
    
    const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: currentController ? currentController.signal : undefined, // Add abort signal
        body: JSON.stringify({
            model: currentModel,
            messages: [...messages, { role: 'user', content: message }],
            stream: true // Enable streaming
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorBody}`);
    }

    // Create a placeholder message element for real-time updates
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper';
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<i class="fas fa-robot"></i>';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Create thinking section
    const thinkingSection = document.createElement('div');
    thinkingSection.className = 'thinking-section';
    thinkingSection.style.display = 'none';
    thinkingSection.innerHTML = `
        <div class="thinking-header">
            <i class="fas fa-brain"></i> 
            <span>Thinking...</span>
            <div class="thinking-dots">
                <span>.</span><span>.</span><span>.</span>
            </div>
        </div>
        <div class="thinking-content"></div>
    `;
    
    // Create main response section
    const responseSection = document.createElement('div');
    responseSection.className = 'response-section';
    responseSection.style.display = 'none';
    
    contentDiv.appendChild(thinkingSection);
    contentDiv.appendChild(responseSection);
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

    let fullContent = '';
    let thinking = '';
    let actualResponse = '';
    let isInThinking = false;
    let hasStartedResponse = false;

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
                    if (data.message && data.message.content) {
                        const newContent = data.message.content;
                        fullContent += newContent;

                        // Check for thinking tags
                        if (newContent.includes('<think>') || newContent.includes('<thinking>')) {
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

    return { content: finalContent, thinking: finalThinking };
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

    if (message.thinking) {
        contentDiv.innerHTML += `
            <div class="thinking-section">
                <div class="thinking-header"><i class="fas fa-brain"></i> Thinking...</div>
                <div>${formatMessage(message.thinking)}</div>
            </div>`;
    }
    contentDiv.innerHTML += formatMessage(message.content);

    messageDiv.append(avatar, contentDiv);

    // Add copy button below the message content
    const copyBtn = document.createElement('button');
    copyBtn.className = 'message-copy-btn';
    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
    copyBtn.onclick = () => copyMessage(message.content);
    copyBtn.title = 'Copy message';

    messageWrapper.append(messageDiv, copyBtn);
    DOMElements.chatContainer.appendChild(messageWrapper);
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
    DOMElements.chatContainer.scrollTop = DOMElements.chatContainer.scrollHeight;
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
