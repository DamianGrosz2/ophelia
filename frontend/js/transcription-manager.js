/**
 * Transcription Manager
 * 
 * Handles continuous transcription sessions and doctor's letter generation
 */

export class TranscriptionManager
{
    constructor(apiClient, alertManager)
    {
        this.apiClient = apiClient;
        this.alertManager = alertManager;

        this.isRecording = false;
        this.currentSessionId = null;
        this.mediaRecorder = null;
        this.recordingTimer = null;
        this.segmentInterval = null;
        this.activeSegmentRecorders = []; // Track active segment recorders

        // UI elements
        this.startBtn = null;
        this.stopBtn = null;
        this.createLetterBtn = null;
        this.statusDisplay = null;
        this.letterDisplay = null;

        // Recording settings
        this.segmentDuration = 5000; // 5 seconds per segment
        this.recordingStartTime = null;

        this.initializeUI();
    }

    initializeUI()
    {
        // Find UI elements
        this.startBtn = document.getElementById('start-transcription-btn');
        this.stopBtn = document.getElementById('stop-transcription-btn');
        this.createLetterBtn = document.getElementById('create-letter-btn');
        this.statusDisplay = document.getElementById('transcription-status');
        this.letterDisplay = document.getElementById('letter-display');

        console.log('TranscriptionManager UI elements found:', {
            startBtn: !!this.startBtn,
            stopBtn: !!this.stopBtn,
            createLetterBtn: !!this.createLetterBtn,
            statusDisplay: !!this.statusDisplay,
            letterDisplay: !!this.letterDisplay
        });

        if (this.startBtn)
        {
            this.startBtn.addEventListener('click', () =>
            {
                console.log('Start transcription button clicked');
                this.startTranscription();
            });
        } else
        {
            console.warn('Start transcription button not found');
        }

        if (this.stopBtn)
        {
            this.stopBtn.addEventListener('click', () =>
            {
                console.log('Stop transcription button clicked');
                this.stopTranscription();
            });
        }

        if (this.createLetterBtn)
        {
            this.createLetterBtn.addEventListener('click', () =>
            {
                console.log('Create letter button clicked');
                this.generateDoctorLetter();
            });
        }

        this.updateUI();
    }

    /**
     * Reinitialize UI elements (useful when components are loaded after manager creation)
     */
    reinitializeUI()
    {
        console.log('Reinitializing TranscriptionManager UI...');
        this.initializeUI();
    }

    async startTranscription(procedureType = 'pad_angioplasty')
    {
        try
        {
            if (this.isRecording)
            {
                this.alertManager.showAlert('Transcription is already active', 'warning');
                return;
            }

            // Start transcription session on backend
            const response = await this.apiClient.post('/transcription/start', {
                procedure_type: procedureType
            });

            this.currentSessionId = response.session_id;
            this.isRecording = true;
            this.recordingStartTime = new Date();

            // Start microphone recording
            await this.startMicrophoneRecording();

            // Start periodic segment recording
            this.startSegmentRecording();

            // Start UI update timer
            this.startUITimer();

            // Update UI
            this.updateUI();

            this.alertManager.showAlert(
                `Transcription started: ${this.currentSessionId}`,
                'success'
            );

        } catch (error)
        {
            console.error('Failed to start transcription:', error);
            this.alertManager.showAlert('Failed to start transcription', 'error');
        }
    }

    async stopTranscription()
    {
        try
        {
            if (!this.isRecording || !this.currentSessionId)
            {
                this.alertManager.showAlert('No active transcription session', 'warning');
                return;
            }

            // Stop recording
            this.stopMicrophoneRecording();
            this.stopSegmentRecording();
            this.stopActiveSegmentRecorders(); // Stop any in-progress segments
            this.stopUITimer();

            // Stop transcription session on backend
            const response = await this.apiClient.post(`/transcription/stop?session_id=${this.currentSessionId}`, {});

            const sessionInfo = {
                sessionId: this.currentSessionId,
                totalSegments: response.total_segments,
                fullTranscript: response.full_transcript
            };

            // Reset state
            this.isRecording = false;
            this.currentSessionId = null;
            this.recordingStartTime = null;

            // Update UI
            this.updateUI();

            this.alertManager.showAlert(
                `Transcription completed: ${sessionInfo.totalSegments} segments recorded`,
                'success'
            );

            // Store session info for letter generation
            this.lastCompletedSession = sessionInfo;

        } catch (error)
        {
            console.error('Failed to stop transcription:', error);
            this.alertManager.showAlert('Failed to stop transcription', 'error');
        }
    }

    async startMicrophoneRecording()
    {
        try
        {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000
                }
            });

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });

            this.mediaRecorder.start();

        } catch (error)
        {
            console.error('Failed to start microphone:', error);
            throw new Error('Microphone access denied');
        }
    }

    stopMicrophoneRecording()
    {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive')
        {
            this.mediaRecorder.stop();

            // Stop all tracks
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }

    startSegmentRecording()
    {
        this.segmentInterval = setInterval(() =>
        {
            this.recordSegment();
        }, this.segmentDuration);
    }

    stopSegmentRecording()
    {
        if (this.segmentInterval)
        {
            clearInterval(this.segmentInterval);
            this.segmentInterval = null;
        }
    }

    startUITimer()
    {
        // Update UI every second to show elapsed time
        this.recordingTimer = setInterval(() =>
        {
            this.updateUI();
        }, 1000);
    }

    stopUITimer()
    {
        if (this.recordingTimer)
        {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    stopActiveSegmentRecorders()
    {
        // Stop all active segment recorders to prevent race condition
        this.activeSegmentRecorders.forEach(recorder =>
        {
            try
            {
                if (recorder.state !== 'inactive')
                {
                    recorder.stop();
                }
            } catch (error)
            {
                console.warn('Error stopping segment recorder:', error);
            }
        });
        this.activeSegmentRecorders = [];
    }

    async recordSegment()
    {
        if (!this.isRecording || !this.currentSessionId)
        {
            return;
        }

        try
        {
            // Create a new recording for this segment
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000
                }
            });

            const segmentRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });

            // Track this recorder to prevent race conditions
            this.activeSegmentRecorders.push(segmentRecorder);

            const audioBlobs = [];
            const sessionIdSnapshot = this.currentSessionId; // Capture session ID at start

            segmentRecorder.ondataavailable = (event) =>
            {
                if (event.data.size > 0)
                {
                    audioBlobs.push(event.data);
                }
            };

            segmentRecorder.onstop = async () =>
            {
                try
                {
                    // Remove from active recorders
                    const index = this.activeSegmentRecorders.indexOf(segmentRecorder);
                    if (index > -1)
                    {
                        this.activeSegmentRecorders.splice(index, 1);
                    }

                    // Check if session is still active before sending
                    if (!this.isRecording || !sessionIdSnapshot || sessionIdSnapshot !== this.currentSessionId)
                    {
                        console.log('Session no longer active, skipping segment upload');
                        return;
                    }

                    const audioBlob = new Blob(audioBlobs, { type: 'audio/webm' });

                    // Calculate timestamp
                    const elapsedMs = new Date() - this.recordingStartTime;
                    const timestamp = this.formatElapsedTime(elapsedMs);

                    // Send segment to backend
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'segment.webm');
                    formData.append('session_id', sessionIdSnapshot);
                    formData.append('timestamp', timestamp);

                    await fetch(`${this.apiClient.baseUrl}/transcription/segment`, {
                        method: 'POST',
                        body: formData
                    });

                } catch (error)
                {
                    console.error('Failed to process audio segment:', error);
                }

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            segmentRecorder.start();

            // Record for segment duration
            setTimeout(() =>
            {
                segmentRecorder.stop();
            }, this.segmentDuration);

        } catch (error)
        {
            console.error('Failed to record segment:', error);
        }
    }

    async generateDoctorLetter()
    {
        try
        {
            let sessionId = this.currentSessionId;

            // If no active session, use last completed session
            if (!sessionId && this.lastCompletedSession)
            {
                sessionId = this.lastCompletedSession.sessionId;
            }

            if (!sessionId)
            {
                this.alertManager.showAlert('No transcription session available for letter generation', 'warning');
                return;
            }

            this.alertManager.showAlert('Generating doctor\'s letter...', 'info');

            // Generate letter
            const response = await this.apiClient.post('/generate-letter', {
                session_id: sessionId,
                additional_notes: null
            });

            // Display the letter
            this.displayLetter(response.content);

            this.alertManager.showAlert('Doctor\'s letter generated successfully', 'success');

        } catch (error)
        {
            console.error('Failed to generate doctor\'s letter:', error);
            this.alertManager.showAlert('Failed to generate doctor\'s letter', 'error');
        }
    }

    displayLetter(letterContent)
    {
        if (this.letterDisplay)
        {
            this.letterDisplay.innerHTML = `
                <div class="letter-header">
                    <h3>Generated Doctor's Letter</h3>
                    <button class="copy-letter-btn">Copy to Clipboard</button>
                </div>
                <div class="letter-content">
                    <pre>${letterContent}</pre>
                </div>
            `;

            // Add copy functionality
            const copyBtn = this.letterDisplay.querySelector('.copy-letter-btn');
            if (copyBtn)
            {
                copyBtn.addEventListener('click', () =>
                {
                    navigator.clipboard.writeText(letterContent);
                    this.alertManager.showAlert('Letter copied to clipboard', 'success');
                });
            }

            // Show the letter display section
            this.letterDisplay.style.display = 'block';
        }
    }

    updateUI()
    {
        // Update button states
        if (this.startBtn)
        {
            this.startBtn.disabled = this.isRecording;
        }

        if (this.stopBtn)
        {
            this.stopBtn.disabled = !this.isRecording;
        }

        if (this.createLetterBtn)
        {
            this.createLetterBtn.disabled = this.isRecording;
        }

        // Update status display
        if (this.statusDisplay)
        {
            if (this.isRecording)
            {
                const elapsed = this.recordingStartTime ?
                    this.formatElapsedTime(new Date() - this.recordingStartTime) :
                    '00:00:00';
                this.statusDisplay.textContent = `Recording: ${elapsed}`;
                this.statusDisplay.className = 'transcription-status recording';
            } else
            {
                this.statusDisplay.textContent = 'Not Recording';
                this.statusDisplay.className = 'transcription-status idle';
            }
        }
    }

    formatElapsedTime(milliseconds)
    {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Handle voice commands
    async handleVoiceCommand(command)
    {
        switch (command.action)
        {
            case 'start_transcription':
                await this.startTranscription(command.procedure_type);
                break;

            case 'stop_transcription':
                await this.stopTranscription();
                break;

            case 'generate_letter':
                await this.generateDoctorLetter();
                break;

            case 'show_letter':
                // Show the letter display if hidden
                if (this.letterDisplay)
                {
                    this.letterDisplay.style.display = 'block';
                }
                break;

            default:
                console.warn('Unknown transcription command:', command);
        }
    }

    // Start periodic UI updates when recording
    startTimerUpdates()
    {
        if (this.recordingTimer)
        {
            clearInterval(this.recordingTimer);
        }

        this.recordingTimer = setInterval(() =>
        {
            this.updateUI();
        }, 1000);
    }

    stopTimerUpdates()
    {
        if (this.recordingTimer)
        {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }
} 