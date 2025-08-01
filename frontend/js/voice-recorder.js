/**
 * Voice Recorder - Handles audio recording and transcription
 */

export class VoiceRecorder
{
    constructor(apiClient, alertManager)
    {
        console.log('VoiceRecorder constructor called');
        this.apiClient = apiClient;
        this.alertManager = alertManager;

        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentStream = null;

        // Wake word detection
        this.isListening = false;
        this.recognition = null;
        this.wakeWords = ['ophelia', 'hey ophelia', 'okay ophelia'];
        this.isWakeWordMode = false;
        this.listeningTimeout = null;

        // Audio recording settings
        this.audioSettings = {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
        };

        // DOM elements
        this.listeningToggle = null;
        this.stopListeningBtn = null;

        // Event callbacks
        this.onTranscriptionComplete = null;
        this.onRecordingStart = null;
        this.onRecordingStop = null;
        this.onWakeWordDetected = null;

        this.initializeWakeWordDetection();
        console.log('VoiceRecorder constructor complete');
    }

    /**
     * Initialize DOM elements and event listeners
     */
    initialize()
    {
        console.log('VoiceRecorder initialize() called');
        this.createListeningControls();
        this.setupEventListeners();
    }

    /**
 * Setup event listeners
 */
    setupEventListeners()
    {

        // Keyboard shortcut (Ctrl+Space) - keep for manual recording if needed
        document.addEventListener('keydown', (e) =>
        {
            if (e.code === 'Space' && e.ctrlKey)
            {
                e.preventDefault();
                this.toggleRecording();
            }

            // Escape key to stop continuous listening
            if (e.code === 'Escape')
            {
                e.preventDefault();
                this.stopContinuousListening();
            }
        });

        // Use event delegation to handle toggle changes (survives element replacement)
        // Only set up once to prevent duplicates
        if (!this.delegationSetup)
        {
            this.delegationSetup = true;

            document.addEventListener('change', (e) =>
            {
                if (e.target && e.target.id === 'listening-toggle')
                {
                    console.log('🎯 DELEGATED Toggle changed:', e.target.checked);
                    if (e.target.checked)
                    {
                        console.log('🎯 Starting continuous listening...');
                        this.startContinuousListening();
                    } else
                    {
                        console.log('🎯 Stopping continuous listening...');
                        this.stopContinuousListening();
                    }
                }
            });

            // Also add click listener for debugging
            document.addEventListener('click', (e) =>
            {
                if (e.target && e.target.id === 'listening-toggle')
                {
                    console.log('🎯 DELEGATED Toggle clicked!', e.target.checked);
                }
            });
        } else
        {
            console.log('🔄 Event delegation already set up, skipping...');
        }

    }

    /**
     * Toggle recording on/off
     */
    async toggleRecording()
    {
        if (!this.isRecording)
        {
            await this.startRecording();
        } else
        {
            this.stopRecording();
        }
    }

    /**
     * Start audio recording
     */
    async startRecording()
    {
        try
        {
            // Request microphone permission
            this.currentStream = await navigator.mediaDevices.getUserMedia({
                audio: this.audioSettings
            });

            // Create media recorder
            this.mediaRecorder = new MediaRecorder(this.currentStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.audioChunks = [];

            // Setup event handlers
            this.mediaRecorder.ondataavailable = (event) =>
            {
                if (event.data.size > 0)
                {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () =>
            {
                this.processAudio();
            };

            // Start recording
            this.mediaRecorder.start();
            this.isRecording = true;

            // Update UI
            this.updateRecordingUI(true);

            // Trigger callback
            if (this.onRecordingStart)
            {
                this.onRecordingStart();
            }

        } catch (error)
        {
            console.error('Error starting recording:', error);
            this.alertManager?.showWarning('Microphone access denied. Please enable microphone permissions.');
            this.updateRecordingUI(false);
        }
    }

    /**
     * Stop audio recording
     */
    stopRecording()
    {
        if (this.mediaRecorder && this.isRecording)
        {
            this.mediaRecorder.stop();

            // Stop all tracks
            if (this.currentStream)
            {
                this.currentStream.getTracks().forEach(track => track.stop());
                this.currentStream = null;
            }

            this.isRecording = false;

            // Update UI
            this.updateRecordingUI(false);

            if (this.isWakeWordMode)
            {
                this.updateTranscriptUI('Processing wake word command...');
            } else
            {
                this.updateTranscriptUI('Processing audio...');
            }

            // Trigger callback
            if (this.onRecordingStop)
            {
                this.onRecordingStop();
            }
        }
    }

    /**
     * Process recorded audio
     */
    async processAudio()
    {
        try
        {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });

            // Show processing state
            if (this.isWakeWordMode)
            {
                this.updateTranscriptUI('Processing command...');
            } else
            {
                this.updateTranscriptUI('Transcribing audio...');
            }

            // Send to API for transcription
            const result = await this.apiClient.transcribeAudio(audioBlob, this.getCurrentProcedure());

            // Clear transcript UI
            this.resetTranscriptUI();

            // If this was a wake word command, return to listening state
            if (this.isWakeWordMode && this.isListening)
            {
                this.isWakeWordMode = false;
                this.restartWakeWordListening();
            }

            // Clear timeout
            if (this.listeningTimeout)
            {
                clearTimeout(this.listeningTimeout);
                this.listeningTimeout = null;
            }

            // Trigger completion callback with result
            if (this.onTranscriptionComplete)
            {
                this.onTranscriptionComplete(result);
            }

        } catch (error)
        {
            console.error('Error processing audio:', error);
            this.updateTranscriptUI('Error processing audio. Please try again.');
            this.alertManager?.showWarning('Audio processing failed. Please check your connection and try again.');

            // Reset wake word mode
            if (this.isWakeWordMode)
            {
                this.isWakeWordMode = false;
                if (this.isListening)
                {
                    this.restartWakeWordListening();
                }
            }

            setTimeout(() =>
            {
                this.resetTranscriptUI();
            }, 3000);
        }
    }

    /**
     * Update recording UI state
     */
    updateRecordingUI(isRecording)
    {
        if (isRecording)
        {
            // Update status through listening status instead
            this.updateListeningStatus('Listening... Speak your command.');
        }
        // No else needed - transcript updates are handled by other methods
    }

    /**
     * Update transcript UI
     */
    updateTranscriptUI(text)
    {
        // Update status through listening status instead
        this.updateListeningStatus(text);
    }

    /**
     * Reset transcript UI to default state
     */
    resetTranscriptUI()
    {
        // Reset status back to listening state
        if (this.isListening)
        {
            this.updateListeningStatus('Listening for "Ophelia"...');
        }
        else
        {
            this.updateListeningStatus('Ready');
        }
    }

    /**
     * Get current procedure (should be set externally)
     */
    getCurrentProcedure()
    {
        return this.currentProcedure || 'pad_angioplasty';
    }

    /**
     * Set current procedure
     */
    setCurrentProcedure(procedure)
    {
        this.currentProcedure = procedure;
    }

    /**
     * Set callback for transcription completion
     */
    onTranscription(callback)
    {
        this.onTranscriptionComplete = callback;
    }

    /**
     * Set callback for recording start
     */
    onRecordingStarted(callback)
    {
        this.onRecordingStart = callback;
    }

    /**
     * Set callback for recording stop
     */
    onRecordingStopped(callback)
    {
        this.onRecordingStop = callback;
    }

    /**
     * Check if recording is currently active
     */
    isCurrentlyRecording()
    {
        return this.isRecording;
    }

    /**
     * Force stop recording (for cleanup)
     */
    forceStop()
    {
        if (this.isRecording)
        {
            this.stopRecording();
        }
    }

    /**
     * Clean up resources
     */
    destroy()
    {
        this.forceStop();
        this.stopContinuousListening();

        if (this.recognition)
        {
            this.recognition.abort();
        }

        // Remove keyboard listener would need to be handled globally
    }

    /**
     * Create listening controls UI elements
     */
    createListeningControls()
    {
        // Find the voice interface container
        const voiceInterface = document.querySelector('.voice-interface');
        if (!voiceInterface)
        {
            console.error('Voice interface container not found!');
            return;
        }

        // Check if controls already exist
        if (document.getElementById('listening-controls'))
        {
            // Update element references even if controls already exist
            this.listeningToggle = document.getElementById('listening-toggle');
            this.listeningStatus = document.getElementById('listening-status');
            return;
        }

        // Create listening controls container
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'listening-controls';
        controlsContainer.className = 'listening-controls';
        controlsContainer.innerHTML = `
            <div class="listening-control-item">
                <label class="listening-toggle-label">
                    <input type="checkbox" id="listening-toggle" class="listening-checkbox">
                    <span class="listening-toggle-text">Continuous Listening</span>
                </label>
                <div class="listening-status" id="listening-status">Ready</div>
            </div>
        `;

        // Insert at the beginning of the voice interface
        const firstChild = voiceInterface.firstElementChild;
        if (firstChild)
        {
            voiceInterface.insertBefore(controlsContainer, firstChild);
        } else
        {
            voiceInterface.appendChild(controlsContainer);
        }

        // Update element references
        this.listeningToggle = document.getElementById('listening-toggle');
        this.listeningStatus = document.getElementById('listening-status');
    }

    /**
     * Initialize wake word detection using Web Speech API
     */
    initializeWakeWordDetection()
    {
        console.log('Initializing wake word detection...');
        console.log('webkitSpeechRecognition available:', 'webkitSpeechRecognition' in window);
        console.log('SpeechRecognition available:', 'SpeechRecognition' in window);

        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window))
        {
            console.warn('Speech recognition not supported in this browser');
            this.alertManager?.showWarning('Continuous listening requires a compatible browser (Chrome/Edge recommended)');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        console.log('SpeechRecognition constructor:', SpeechRecognition);
        this.recognition = new SpeechRecognition();
        console.log('Speech recognition instance created:', this.recognition);

        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) =>
        {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++)
            {
                if (event.results[i].isFinal)
                {
                    finalTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript)
            {
                this.processWakeWordResult(finalTranscript.toLowerCase());
            }
        };

        this.recognition.onerror = (event) =>
        {
            console.error('Speech recognition error:', event.error);

            if (event.error === 'not-allowed')
            {
                this.alertManager?.showCritical('Microphone access denied. Please allow microphone access for continuous listening.');
                this.stopContinuousListening();
            }
            else if (event.error === 'network')
            {
                console.warn('Network error in speech recognition - will retry');
                // Network errors are often temporary, let the onend handler restart
            }
            else if (event.error === 'audio-capture')
            {
                console.warn('Audio capture error - microphone might be in use');
                if (!this.isWakeWordMode)
                {
                    // Only show warning if we're not intentionally using the microphone
                    this.alertManager?.showWarning('Microphone capture issue detected. Wake word detection may be interrupted.');
                }
            }
            else if (event.error === 'service-not-allowed')
            {
                this.alertManager?.showWarning('Speech recognition service not allowed. Check browser settings.');
                this.stopContinuousListening();
            }
            else
            {
                console.warn(`Speech recognition error: ${event.error} - attempting to continue`);
                // For other errors, let the onend handler try to restart
            }
        };

        this.recognition.onend = () =>
        {
            // Only restart if we're still listening and not in wake word mode
            if (this.isListening && !this.isWakeWordMode)
            {
                // Restart recognition if we're still supposed to be listening
                setTimeout(() =>
                {
                    if (this.isListening && !this.isWakeWordMode)
                    {
                        try
                        {
                            this.recognition.start();
                            console.log('Wake word recognition restarted');
                        } catch (error)
                        {
                            console.error('Error restarting wake word recognition:', error);
                            // Try again after a longer delay
                            setTimeout(() =>
                            {
                                if (this.isListening && !this.isWakeWordMode)
                                {
                                    try
                                    {
                                        this.recognition.start();
                                    } catch (retryError)
                                    {
                                        console.error('Failed to restart wake word recognition after retry:', retryError);
                                        this.alertManager?.showWarning('Wake word detection stopped. Please toggle continuous listening off and on.');
                                    }
                                }
                            }, 1000);
                        }
                    }
                }, 100);
            }
        };
    }

    /**
     * Process wake word detection results
     */
    processWakeWordResult(transcript)
    {
        const hasWakeWord = this.wakeWords.some(word => transcript.includes(word));

        if (hasWakeWord && !this.isRecording)
        {
            console.log(`Wake word detected in: "${transcript}"`);
            this.updateListeningStatus('Wake word detected! Listening for command...');
            this.alertManager?.showInfo('Wake word detected - speak your command');

            // Trigger wake word callback
            if (this.onWakeWordDetected)
            {
                this.onWakeWordDetected();
            }

            // **FIX: Temporarily stop wake word recognition to avoid conflicts**
            if (this.recognition)
            {
                this.recognition.stop();
            }

            // Start actual recording for command
            this.isWakeWordMode = true;
            this.startRecording();

            // Auto-stop recording after 10 seconds if no command
            this.listeningTimeout = setTimeout(() =>
            {
                if (this.isRecording && this.isWakeWordMode)
                {
                    this.stopRecording();
                    this.isWakeWordMode = false;
                    this.restartWakeWordListening();
                }
            }, 10000);
        }
    }

    /**
 * Start continuous listening for wake word
 */
    async startContinuousListening()
    {
        console.log('startContinuousListening called');
        console.log('this.recognition:', this.recognition);
        console.log('this.isListening:', this.isListening);

        if (!this.recognition)
        {
            console.error('Speech recognition not available - this.recognition is null');
            this.alertManager?.showWarning('Speech recognition not available');
            return;
        }

        // Prevent starting if already listening
        if (this.isListening)
        {
            console.log('Already listening, skipping start');
            return;
        }

        try
        {
            console.log('Setting isListening to true and starting recognition...');
            this.isListening = true;
            this.recognition.start();
            this.updateListeningStatus('Listening for "Ophelia"...');
            this.updateListeningUI(true);
            this.alertManager?.showSuccess('Continuous listening started - say "Ophelia" to begin');
            console.log('Continuous listening started successfully');
        } catch (error)
        {
            console.error('Error starting continuous listening:', error);
            this.alertManager?.showCritical('Failed to start continuous listening');
            this.isListening = false;
            this.updateListeningUI(false);
        }
    }

    /**
     * Stop continuous listening
     */
    stopContinuousListening()
    {
        this.isListening = false;

        if (this.recognition)
        {
            this.recognition.stop();
        }

        if (this.listeningTimeout)
        {
            clearTimeout(this.listeningTimeout);
            this.listeningTimeout = null;
        }

        // Stop any ongoing recording if it was wake word triggered
        if (this.isRecording && this.isWakeWordMode)
        {
            this.stopRecording();
            this.isWakeWordMode = false;
        }

        this.updateListeningStatus('Ready');
        this.updateListeningUI(false);
        this.alertManager?.showInfo('Continuous listening stopped');
    }

    /**
     * Update listening UI state
     */
    updateListeningUI(isListening)
    {
        if (this.listeningToggle)
        {
            this.listeningToggle.checked = isListening;
        }
    }

    /**
     * Update listening status text with animations
     */
    updateListeningStatus(status)
    {
        if (this.listeningStatus)
        {
            // Clear existing animations and classes
            this.listeningStatus.classList.remove('listening', 'processing');
            
            // Clear any existing animation elements
            const existingAnimation = this.listeningStatus.querySelector('.listening-animation, .processing-animation');
            if (existingAnimation) {
                existingAnimation.remove();
            }
            
            // Determine state based on status text
            let animationHTML = '';
            if (status.includes('Listening for "Ophelia"') || status.includes('Wake word detected') || status.includes('Listening... Speak')) {
                this.listeningStatus.classList.add('listening');
                animationHTML = `
                    <div class="listening-animation">
                        <div class="wave"></div>
                        <div class="wave"></div>
                        <div class="wave"></div>
                    </div>
                `;
            } else if (status.includes('Processing') || status.includes('Transcribing') || status.includes('processing')) {
                this.listeningStatus.classList.add('processing');
                animationHTML = `
                    <div class="processing-animation">
                        <div class="spinner"></div>
                    </div>
                `;
            }
            
            // Update status with animation
            this.listeningStatus.innerHTML = animationHTML + status;
        }
    }

    /**
     * Restart wake word listening after command processing
     */
    restartWakeWordListening()
    {
        console.log('restartWakeWordListening called, isListening:', this.isListening, 'isWakeWordMode:', this.isWakeWordMode);

        if (!this.isListening || !this.recognition)
        {
            console.log('Not restarting - not listening or no recognition');
            return;
        }

        this.updateListeningStatus('Restarting wake word detection...');

        // Short delay to ensure MediaRecorder has fully released the microphone
        setTimeout(() =>
        {
            if (this.isListening && !this.isWakeWordMode)
            {
                try
                {
                    console.log('Attempting to restart recognition...');
                    this.recognition.start();
                    this.updateListeningStatus('Listening for "Ophelia"...');
                    console.log('Wake word recognition restarted after command');
                } catch (error)
                {
                    console.error('Error restarting wake word recognition after command:', error);

                    // Only retry if the error isn't "already started"
                    if (error.message && !error.message.includes('already started'))
                    {
                        // Try again with a longer delay
                        setTimeout(() =>
                        {
                            if (this.isListening && !this.isWakeWordMode)
                            {
                                try
                                {
                                    console.log('Retry attempt to restart recognition...');
                                    this.recognition.start();
                                    this.updateListeningStatus('Listening for "Ophelia"...');
                                    console.log('Wake word recognition restarted after retry');
                                } catch (retryError)
                                {
                                    console.error('Failed to restart wake word recognition after command retry:', retryError);
                                    this.updateListeningStatus('Wake word detection failed - try toggling off/on');
                                    this.alertManager?.showWarning('Wake word detection failed to restart. Please toggle continuous listening off and on.');
                                }
                            }
                        }, 2000);
                    } else
                    {
                        console.log('Recognition already started, continuing...');
                        this.updateListeningStatus('Listening for "Ophelia"...');
                    }
                }
            }
        }, 500);
    }



    /**
     * Set callback for wake word detection
     */
    onWakeWord(callback)
    {
        this.onWakeWordDetected = callback;
    }

    /**
     * Check if currently in continuous listening mode
     */
    isContinuousListening()
    {
        return this.isListening;
    }

    /**
     * Get current wake words
     */
    getWakeWords()
    {
        return [...this.wakeWords];
    }

    /**
     * Add custom wake words
     */
    addWakeWord(word)
    {
        if (!this.wakeWords.includes(word.toLowerCase()))
        {
            this.wakeWords.push(word.toLowerCase());
        }
    }

    /**
     * Remove wake word
     */
    removeWakeWord(word)
    {
        const index = this.wakeWords.indexOf(word.toLowerCase());
        if (index > -1)
        {
            this.wakeWords.splice(index, 1);
        }
    }
} 