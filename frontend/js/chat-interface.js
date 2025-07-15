/**
 * Chat Interface - Handles chat history and messaging
 */

export class ChatInterface
{
    constructor(alertManager)
    {
        this.alertManager = alertManager;

        // DOM elements
        this.chatHistory = null;
        this.textInput = null;
        this.sendBtn = null;
        this.ttsAudio = null;
        this.stopAudioBtn = null;
        this.speedButtons = null;

        // Audio settings
        this.currentPlaybackRate = 1.0;

        // Event callbacks
        this.onMessageSent = null;

        this.initializeElements();
        this.setupEventListeners();
        this.initializeChat();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements()
    {
        this.chatHistory = document.getElementById('chat-history');
        this.textInput = document.getElementById('text-input');
        this.sendBtn = document.getElementById('send-btn');
        this.ttsAudio = document.getElementById('tts-audio');
        this.stopAudioBtn = document.getElementById('stop-audio-btn');
        this.speedButtons = {
            normal: document.getElementById('speed-normal-btn'),
            fast: document.getElementById('speed-fast-btn'),
            faster: document.getElementById('speed-faster-btn')
        };

        if (!this.chatHistory || !this.textInput || !this.sendBtn)
        {
            console.error('ChatInterface: Required DOM elements not found');
            this.alertManager?.showWarning('Chat interface not available');
        }

        // Create stop audio button if it doesn't exist
        this.createStopAudioButton();

        // Setup speed controls
        this.setupSpeedControls();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners()
    {
        if (this.sendBtn)
        {
            this.sendBtn.addEventListener('click', () => this.sendTextMessage());
        }

        if (this.textInput)
        {
            this.textInput.addEventListener('keypress', (e) =>
            {
                if (e.key === 'Enter' && !e.shiftKey)
                {
                    e.preventDefault();
                    this.sendTextMessage();
                }
            });
        }

        if (this.stopAudioBtn)
        {
            this.stopAudioBtn.addEventListener('click', () => this.stopAudio());
        }

        // Audio event listeners
        if (this.ttsAudio)
        {
            this.ttsAudio.addEventListener('play', () => this.updateStopButtonVisibility(true));
            this.ttsAudio.addEventListener('pause', () => this.updateStopButtonVisibility(false));
            this.ttsAudio.addEventListener('ended', () => this.updateStopButtonVisibility(false));
        }

        // Keyboard shortcut for stopping audio (Alt+S)
        document.addEventListener('keydown', (e) =>
        {
            if (e.altKey && e.key.toLowerCase() === 's')
            {
                e.preventDefault();
                this.stopAudio();
            }
        });

        // Setup speed control event listeners
        this.setupSpeedEventListeners();
    }

    /**
     * Initialize chat with welcome message
     */
    initializeChat()
    {
        this.clearChatHistory();
    }

    /**
     * Add message to chat history
     */
    addMessage(sender, message, source = 'System')
    {
        if (!this.chatHistory) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(message)}</div>
                <div class="message-time">${source} • ${timeString}</div>
            </div>
        `;

        this.chatHistory.appendChild(messageDiv);
        this.scrollToBottom();
    }

    /**
     * Add user message
     */
    addUserMessage(message, source = 'Text')
    {
        this.addMessage('user', message, source);
    }

    /**
     * Add assistant message
     */
    addAssistantMessage(message, source = 'Assistant')
    {
        this.addMessage('assistant', message, source);
    }

    /**
     * Send text message
     */
    async sendTextMessage()
    {
        if (!this.textInput || !this.sendBtn) return;

        const message = this.textInput.value.trim();
        if (!message) return;

        // Disable send button temporarily
        this.setSendButtonState(false, 'Sending...');

        try
        {
            // Add user message to chat history
            this.addUserMessage(message, 'Text');

            // Clear input
            this.textInput.value = '';

            // Trigger callback if set
            if (this.onMessageSent)
            {
                await this.onMessageSent(message);
            }

        } catch (error)
        {
            console.error('Error sending text message:', error);
            this.addAssistantMessage('Sorry, there was an error processing your message. Please try again.', 'System');
            this.alertManager?.showWarning('Failed to send message. Please try again.');
        } finally
        {
            // Re-enable send button
            this.setSendButtonState(true, 'Send');
        }
    }

    /**
     * Set send button state
     */
    setSendButtonState(enabled, text)
    {
        if (!this.sendBtn) return;

        this.sendBtn.disabled = !enabled;
        this.sendBtn.textContent = text;
    }

    /**
     * Scroll chat to bottom
     */
    scrollToBottom()
    {
        if (this.chatHistory)
        {
            this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
        }
    }

    /**
     * Clear chat history
     */
    clearChatHistory()
    {
        if (!this.chatHistory) return;

        this.chatHistory.innerHTML = `
            <div class="chat-message assistant">
                <div class="message-content">
                    <div class="message-text">Voice assistant ready. Ask about patient data, procedures, or use display commands.</div>
                    <div class="message-time">System</div>
                </div>
            </div>
        `;
    }

    /**
     * Setup speed controls
     */
    setupSpeedControls()
    {
        // Set initial playback rate on the audio element
        if (this.ttsAudio)
        {
            this.ttsAudio.playbackRate = this.currentPlaybackRate;
        }
    }

    /**
     * Setup speed control event listeners
     */
    setupSpeedEventListeners()
    {
        if (this.speedButtons.normal)
        {
            this.speedButtons.normal.addEventListener('click', () => this.setPlaybackSpeed(1.0));
        }
        if (this.speedButtons.fast)
        {
            this.speedButtons.fast.addEventListener('click', () => this.setPlaybackSpeed(1.25));
        }
        if (this.speedButtons.faster)
        {
            this.speedButtons.faster.addEventListener('click', () => this.setPlaybackSpeed(1.5));
        }
    }

    /**
     * Set playback speed
     */
    setPlaybackSpeed(rate)
    {
        this.currentPlaybackRate = rate;

        // Update audio element playback rate
        if (this.ttsAudio)
        {
            this.ttsAudio.playbackRate = rate;
        }

        // Update button active states
        this.updateSpeedButtonStates(rate);

        console.log(`Playback speed set to ${rate}x`);
    }

    /**
     * Update speed button active states
     */
    updateSpeedButtonStates(activeRate)
    {
        // Remove active class from all buttons
        Object.values(this.speedButtons).forEach(btn =>
        {
            if (btn) btn.classList.remove('active');
        });

        // Add active class to the corresponding button
        const buttonMap = {
            1.0: this.speedButtons.normal,
            1.25: this.speedButtons.fast,
            1.5: this.speedButtons.faster
        };

        const activeButton = buttonMap[activeRate];
        if (activeButton)
        {
            activeButton.classList.add('active');
        }
    }

    /**
     * Play TTS audio
     */
    playAudio(audioUrl)
    {
        if (!this.ttsAudio)
        {
            console.warn('TTS audio element not found');
            return;
        }

        console.log('Playing TTS audio:', audioUrl);

        this.ttsAudio.src = audioUrl;
        this.ttsAudio.playbackRate = this.currentPlaybackRate;
        this.ttsAudio.play().catch(error =>
        {
            console.error('Error playing TTS audio:', error);
            this.alertManager?.showWarning('Audio playback failed');
        });
    }

    /**
     * Stop TTS audio
     */
    stopAudio()
    {
        if (!this.ttsAudio) return;

        this.ttsAudio.pause();
        this.ttsAudio.currentTime = 0;
        console.log('TTS audio stopped');

        // Stop speech synthesis as well
        if ('speechSynthesis' in window)
        {
            speechSynthesis.cancel();
        }
    }

    /**
     * Use browser TTS as fallback
     */
    speakText(text)
    {
        console.log('Using browser TTS for:', text);

        if ('speechSynthesis' in window)
        {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = this.currentPlaybackRate * 0.9; // Apply current speed to base rate
            utterance.pitch = 1;
            utterance.volume = 0.8;
            speechSynthesis.speak(utterance);
        } else
        {
            console.warn('Speech synthesis not supported');
        }
    }

    /**
     * Set callback for message sent
     */
    onMessage(callback)
    {
        this.onMessageSent = callback;
    }

    /**
     * Display response from API
     */
    displayResponse(result, apiBaseUrl)
    {
        // Add assistant response to chat history
        this.addAssistantMessage(result.response, 'Assistant');

        // Show alert if necessary
        if (result.alert_level && result.alert_level !== 'info')
        {
            this.alertManager?.showAlert(result.response, result.alert_level);
        }

        // Play audio if available, otherwise fallback to browser TTS
        console.log('🔊 TTS Decision - audio_url:', result.audio_url);
        console.log('🔊 TTS Decision - full result:', result);

        if (result.audio_url)
        {
            console.log('🔊 Using AI TTS audio:', result.audio_url);
            this.playAudio(`${apiBaseUrl}${result.audio_url}`);
        } else
        {
            console.log('🔊 Using browser TTS fallback');
            this.speakText(result.response);
        }

        return result;
    }

    /**
     * Get chat history as text
     */
    getChatHistory()
    {
        if (!this.chatHistory) return '';

        const messages = this.chatHistory.querySelectorAll('.chat-message');
        return Array.from(messages).map(msg =>
        {
            const sender = msg.classList.contains('user') ? 'User' : 'Assistant';
            const text = msg.querySelector('.message-text')?.textContent || '';
            const time = msg.querySelector('.message-time')?.textContent || '';
            return `[${time}] ${sender}: ${text}`;
        }).join('\n');
    }

    /**
     * Export chat history
     */
    exportChatHistory()
    {
        const history = this.getChatHistory();
        const blob = new Blob([history], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-history-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text)
    {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Focus text input
     */
    focusInput()
    {
        if (this.textInput)
        {
            this.textInput.focus();
        }
    }

    /**
     * Get current input text
     */
    getCurrentInput()
    {
        return this.textInput?.value || '';
    }

    /**
     * Set input text
     */
    setInputText(text)
    {
        if (this.textInput)
        {
            this.textInput.value = text;
        }
    }

    /**
     * Clear input
     */
    clearInput()
    {
        this.setInputText('');
    }

    /**
     * Create stop audio button UI element
     */
    createStopAudioButton()
    {
        // Check if button already exists
        if (document.getElementById('stop-audio-btn'))
        {
            this.stopAudioBtn = document.getElementById('stop-audio-btn');
            return;
        }

        // Try to find the listening controls container
        const listeningControls = document.getElementById('listening-controls');
        if (!listeningControls)
        {
            // If listening controls don't exist yet, try again later
            setTimeout(() => this.createStopAudioButton(), 100);
            return;
        }

        // Create stop audio button
        const stopAudioButton = document.createElement('button');
        stopAudioButton.id = 'stop-audio-btn';
        stopAudioButton.className = 'stop-audio-btn';
        stopAudioButton.style.display = 'none';
        stopAudioButton.innerHTML = `
            <span class="stop-audio-icon">🔇</span>
            Stop Audio
        `;

        // Insert after the stop listening button
        const stopListeningBtn = document.getElementById('stop-listening-btn');
        if (stopListeningBtn && stopListeningBtn.parentNode)
        {
            stopListeningBtn.parentNode.insertBefore(stopAudioButton, stopListeningBtn.nextSibling);
        } else
        {
            listeningControls.appendChild(stopAudioButton);
        }

        // Update element reference
        this.stopAudioBtn = stopAudioButton;

        // Set up click event listener if not already done
        if (this.stopAudioBtn && !this.stopAudioBtn.onclick)
        {
            this.stopAudioBtn.addEventListener('click', () => this.stopAudio());
        }
    }

    /**
     * Update stop audio button visibility
     */
    updateStopButtonVisibility(isPlaying)
    {
        // Make sure button exists
        if (!this.stopAudioBtn)
        {
            this.stopAudioBtn = document.getElementById('stop-audio-btn');
        }

        if (this.stopAudioBtn)
        {
            this.stopAudioBtn.style.display = isPlaying ? 'flex' : 'none';
        }
    }

    /**
     * Check if audio is currently playing
     */
    isAudioPlaying()
    {
        if (!this.ttsAudio) return false;
        return !this.ttsAudio.paused && !this.ttsAudio.ended;
    }
} 