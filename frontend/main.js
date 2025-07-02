// Import Chart.js for visualization
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

import * as cornerstone from 'cornerstone-core';
import * as cornerstoneMath from 'cornerstone-math';
import Hammer from 'hammerjs';
import * as cornerstoneTools from 'cornerstone-tools';
import * as cornerstoneWebImageLoader from 'cornerstone-web-image-loader';
import * as dicomParser from 'dicom-parser';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';

// Import DicomViewer and VtkViewer
import { DicomViewer } from './dicom-viewer.js';
import { VtkViewer } from './vtk-viewer.js';

/**
 * Initializes all Cornerstone libraries. This should be called once when the app starts.
 */
function initializeCornerstone()
{
    // Link the external dependencies to the cornerstone-tools and cornerstone-web-image-loader libraries
    cornerstoneTools.external.cornerstone = cornerstone;
    cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
    cornerstoneWebImageLoader.external.cornerstone = cornerstone;
    cornerstoneWebImageLoader.external.dicomParser = dicomParser;
    // Register HammerJS for gesture and pointer event support
    cornerstoneTools.external.Hammer = Hammer;

    // Link externals for WADO image loader
    cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
    cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

    // Initialize cornerstone-tools with global configuration
    cornerstoneTools.init({
        showSVGCursors: true,
    });

    // Configure the web image loader with global settings
    cornerstoneWebImageLoader.configure({
        useWebWorkers: false, // Set to true for better performance in production
        beforeSend: (xhr) =>
        {
            // This is a good place to add authorization headers if needed
        },
    });

    // Configure WADO Image Loader (disable web workers for simple dev setup)
    cornerstoneWADOImageLoader.configure({
        useWebWorkers: false,
        decodeConfig: {
            convertFloatPixelDataToInt: false,
            use16BitDataType: true
        }
    });

    console.log('Cornerstone libraries initialized globally from main.js.');
}

class ORVoiceAssistant
{
    constructor()
    {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentProcedure = 'pad_angioplasty';
        this.vitalsChart = null;
        this.vtkViewer = null;
        this.dicomViewer = null;

        initializeCornerstone(); // Initialize Cornerstone libraries globally

        this.initializeElements();
        this.setupEventListeners();
        this.initializeVitalsChart();
        this.initializeVtkViewer();
        this.initializeDicomViewer();
        this.loadProcedureData();
        this.startRealTimeUpdates();
    }

    initializeElements()
    {
        this.voiceBtn = document.getElementById('voice-btn');
        this.chatHistory = document.getElementById('chat-history');
        this.currentTranscript = document.getElementById('current-transcript');
        this.textInput = document.getElementById('text-input');
        this.sendBtn = document.getElementById('send-btn');
        this.patientName = document.getElementById('patient-name');
        this.patientDemographics = document.getElementById('patient-demographics');
        this.labValues = document.getElementById('lab-values');
        this.allergiesList = document.getElementById('allergies-list');
        this.statusIndicators = document.getElementById('status-indicators');
        this.ttsAudio = document.getElementById('tts-audio');
        this.procedureBtns = document.querySelectorAll('.procedure-btn');
    }

    setupEventListeners()
    {
        // Voice recording
        this.voiceBtn.addEventListener('click', () => this.toggleRecording());

        // Text input and send button
        this.sendBtn.addEventListener('click', () => this.sendTextMessage());
        this.textInput.addEventListener('keypress', (e) =>
        {
            if (e.key === 'Enter' && !e.shiftKey)
            {
                e.preventDefault();
                this.sendTextMessage();
            }
        });

        // Procedure selection
        this.procedureBtns.forEach(btn =>
        {
            btn.addEventListener('click', (e) =>
            {
                this.switchProcedure(e.target.dataset.procedure);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) =>
        {
            if (e.code === 'Space' && e.ctrlKey)
            {
                e.preventDefault();
                this.toggleRecording();
            }
        });
    }

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

    async startRecording()
    {
        try
        {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.audioChunks = [];

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

            this.mediaRecorder.start();
            this.isRecording = true;

            // Update UI
            this.voiceBtn.classList.add('recording');
            this.voiceBtn.querySelector('.voice-icon').textContent = '⏹️';
            this.currentTranscript.textContent = 'Listening... Speak your command.';
            this.currentTranscript.classList.add('active');

        } catch (error)
        {
            console.error('Error starting recording:', error);
            this.showAlert('Microphone access denied. Please enable microphone permissions.', 'warning');
        }
    }

    stopRecording()
    {
        if (this.mediaRecorder && this.isRecording)
        {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;

            // Update UI
            this.voiceBtn.classList.remove('recording');
            this.voiceBtn.querySelector('.voice-icon').textContent = '🎤';
            this.currentTranscript.textContent = 'Processing audio...';
            this.currentTranscript.classList.add('active');
        }
    }

    async processAudio()
    {
        try
        {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            formData.append('procedure_type', this.currentProcedure);

            // First transcribe the audio
            const transcribeResponse = await fetch('http://localhost:8000/transcribe', {
                method: 'POST',
                body: formData
            });

            if (transcribeResponse.ok)
            {
                const transcribeResult = await transcribeResponse.json();

                // Add user message to chat history
                this.addMessageToHistory('user', transcribeResult.transcript, 'Voice');

                // Process the command
                await this.processVoiceCommand(transcribeResult.transcript);
            } else
            {
                throw new Error('Transcription failed');
            }
        } catch (error)
        {
            console.error('Error processing audio:', error);
            this.currentTranscript.textContent = 'Error processing audio. Please try again.';
            this.currentTranscript.classList.remove('active');
            this.showAlert('Audio processing failed. Please check your connection and try again.', 'warning');
        }
    }

    async processVoiceCommand(transcript)
    {
        try
        {
            const response = await fetch('http://localhost:8000/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transcript: transcript,
                    procedure_type: this.currentProcedure,
                    command_type: 'query'
                })
            });

            if (response.ok)
            {
                const result = await response.json();
                this.displayResponse(result);
            } else
            {
                throw new Error('Voice command processing failed');
            }
        } catch (error)
        {
            console.error('Error processing voice command:', error);
            this.displayFallbackResponse(transcript);
        }
    }

    displayFallbackResponse(transcript)
    {
        let response = "I'm ready to help with your query.";

        if (transcript.toLowerCase().includes('creatinine'))
        {
            response = "Creatinine is 1.2 mg/dL with eGFR of 58. Consider contrast nephropathy risk.";
        } else if (transcript.toLowerCase().includes('contrast'))
        {
            response = "Contrast used: 45mL of maximum 75mL. 30mL remaining.";
        } else if (transcript.toLowerCase().includes('allerg'))
        {
            response = "Patient allergies: Iodine contrast causing rash, Penicillin causing hives. Use with caution.";
        } else if (transcript.toLowerCase().includes('inr'))
        {
            response = "INR is 2.3 on 2025-01-09. Patient is adequately anticoagulated.";
        } else if (transcript.toLowerCase().includes('open') || transcript.toLowerCase().includes('load') || transcript.toLowerCase().includes('show'))
        {
            if (transcript.toLowerCase().includes('vtk') || transcript.toLowerCase().includes('cpo'))
            {
                response = "Loading VTK file for 3D visualization.";
                // Try to extract filename or use default
                const filename = transcript.toLowerCase().includes('cpo') ? 'CPO_ist.vtk' : 'CPO_ist.vtk';
                this.vtkViewer?.loadVtkFile(filename);
            }
            else if (transcript.toLowerCase().includes('dicom') || transcript.toLowerCase().includes('scan') || transcript.toLowerCase().includes('image'))
            {
                response = "Loading DICOM medical images.";
                // Try to extract series ID from transcript
                const seriesMatch = transcript.match(/(\d{8})/);
                const seriesId = seriesMatch ? seriesMatch[1] : '17155540';
                this.dicomViewer?.loadDicomSeries(seriesId);
            }
        } else if (transcript.toLowerCase().includes('next') || transcript.toLowerCase().includes('previous'))
        {
            if (transcript.toLowerCase().includes('image') || transcript.toLowerCase().includes('slice'))
            {
                if (transcript.toLowerCase().includes('next'))
                {
                    response = "Moving to next DICOM image.";
                    this.dicomViewer?.nextDicomImage();
                }
                else
                {
                    response = "Moving to previous DICOM image.";
                    this.dicomViewer?.previousDicomImage();
                }
            }
        } else if (transcript.toLowerCase().includes('rotate') || transcript.toLowerCase().includes('reset'))
        {
            if (transcript.toLowerCase().includes('view') || transcript.toLowerCase().includes('3d'))
            {
                if (transcript.toLowerCase().includes('reset'))
                {
                    response = "Resetting 3D view orientation.";
                    this.vtkViewer?.resetVtkView();
                }
                else
                {
                    const direction = transcript.toLowerCase().includes('right') ? 'right' : 'left';
                    response = `Rotating 3D view ${direction}.`;
                    this.vtkViewer?.rotateVtkView(direction);
                }
            }
        } else if (transcript.toLowerCase().includes('zoom'))
        {
            if (transcript.toLowerCase().includes('3d') || transcript.toLowerCase().includes('model'))
            {
                response = "Zooming 3D model.";
                this.vtkViewer?.zoomVtkView();
            }
        } else if (transcript.toLowerCase().includes('close'))
        {
            if (transcript.toLowerCase().includes('patient'))
            {
                response = "Closing patient information panel.";
                window.closePanel('panel-1');
            }
            else if (transcript.toLowerCase().includes('monitoring') || transcript.toLowerCase().includes('vitals'))
            {
                response = "Closing procedural monitoring panel.";
                window.closePanel('panel-3');
            }
            else if (transcript.toLowerCase().includes('3d') || transcript.toLowerCase().includes('vtk'))
            {
                response = "Closing 3D visualization panel.";
                window.closePanel('panel-4');
            }
            else if (transcript.toLowerCase().includes('dicom') || transcript.toLowerCase().includes('image'))
            {
                response = "Closing DICOM viewer panel.";
                window.closePanel('panel-5');
            }
        } else if (transcript.toLowerCase().includes('open') && transcript.toLowerCase().includes('panel'))
        {
            if (transcript.toLowerCase().includes('patient'))
            {
                response = "Opening patient information panel.";
                window.reopenPanel('panel-1');
            }
            else if (transcript.toLowerCase().includes('monitoring') || transcript.toLowerCase().includes('vitals'))
            {
                response = "Opening procedural monitoring panel.";
                window.reopenPanel('panel-3');
            }
            else if (transcript.toLowerCase().includes('3d') || transcript.toLowerCase().includes('vtk'))
            {
                response = "Opening 3D visualization panel.";
                window.reopenPanel('panel-4');
            }
            else if (transcript.toLowerCase().includes('dicom') || transcript.toLowerCase().includes('image'))
            {
                response = "Opening DICOM viewer panel.";
                window.reopenPanel('panel-5');
            }
        }

        // Add to chat history and clear transcript
        this.addMessageToHistory('assistant', response, 'Assistant');
        this.currentTranscript.textContent = 'Click the microphone to start voice command or type a message below...';
        this.currentTranscript.classList.remove('active');

        this.speakResponse(response); // Fallback always uses browser TTS
    }

    displayResponse(result)
    {
        // Add assistant response to chat history
        this.addMessageToHistory('assistant', result.response, 'Assistant');

        // Clear current transcript
        this.currentTranscript.textContent = 'Click the microphone to start voice command or type a message below...';
        this.currentTranscript.classList.remove('active');

        // Show alert if necessary
        if (result.alert_level !== 'info')
        {
            this.showAlert(result.response, result.alert_level);
        }

        // Handle display commands
        if (result.display_commands && result.display_commands.length > 0)
        {
            this.executeDisplayCommands(result.display_commands);
        }

        // Update visual data if provided
        if (result.visual_data)
        {
            this.updateVisualData(result.visual_data);
        }

        // Play OpenAI TTS audio if available, otherwise fallback to browser TTS
        if (result.audio_url)
        {
            this.playGeneratedAudio(result.audio_url);
        } else
        {
            this.speakResponse(result.response);
        }
    }

    executeDisplayCommands(commands)
    {
        commands.forEach(command =>
        {
            console.log('Executing display command:', command);

            if (command.action === 'show' && command.target === 'vtk')
            {
                // Load VTK file if specified
                const filename = command.data?.filename || 'CPO_ist.vtk';
                this.vtkViewer?.loadVtkFile(filename);
                this.showAlert(`Loading 3D model: ${filename}`, 'info');
            }
            else if (command.action === 'show' && command.target === 'dicom')
            {
                // Load DICOM series if specified
                const seriesId = command.data?.seriesId || '17155540';
                this.dicomViewer?.loadDicomSeries(seriesId);
                this.showAlert(`Loading DICOM series: ${seriesId}`, 'info');
            }
            else if (command.action === 'next' && command.target === 'dicom')
            {
                this.dicomViewer?.nextDicomImage();
                this.showAlert('Next DICOM image', 'info');
            }
            else if (command.action === 'previous' && command.target === 'dicom')
            {
                this.dicomViewer?.previousDicomImage();
                this.showAlert('Previous DICOM image', 'info');
            }
            else if (command.action === 'zoom' && command.target === '3d')
            {
                const factor = command.data?.zoom_level || 1.5;
                this.vtkViewer?.zoomVtkView(factor);
                this.showAlert(`Zooming 3D view by ${factor}x`, 'info');
            }
            else if (command.action === 'rotate' && command.target === '3d')
            {
                const direction = command.data?.direction || 'left';
                const angle = command.data?.angle || 15;
                this.vtkViewer?.rotateVtkView(direction, angle);
                this.showAlert(`Rotating 3D view ${direction}`, 'info');
            }
            else if (command.action === 'reset' && command.target === '3d')
            {
                this.vtkViewer?.resetVtkView();
                this.showAlert('Reset 3D view orientation', 'info');
            }
            else
            {
                // Original display commands
                this.showAlert(`Display command: ${command.action} ${command.target}`, 'info');
            }
        });
    }

    updateVisualData(data)
    {
        // Update lab values display
        if (data.creatinine || data.potassium || data.inr)
        {
            this.updateLabValues(data);
        }
    }

    playGeneratedAudio(audioUrl)
    {
        // Play OpenAI TTS generated audio
        console.log('Playing OpenAI TTS audio:', audioUrl);

        // Use the hidden audio element from HTML
        this.ttsAudio.src = `http://localhost:8000${audioUrl}`;
        this.ttsAudio.play().catch(error =>
        {
            console.error('Error playing generated audio:', error);
            // Fallback to text-to-speech if audio fails
            this.speakResponse('Audio playback failed');
        });
    }

    speakResponse(text)
    {
        // Use Web Speech API for text-to-speech (fallback)
        console.log('Using browser TTS fallback for:', text);
        if ('speechSynthesis' in window)
        {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            speechSynthesis.speak(utterance);
        }
    }

    // New chat functionality methods
    addMessageToHistory(sender, message, source)
    {
        const chatHistory = this.chatHistory;
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${message}</div>
                <div class="message-time">${source} • ${timeString}</div>
            </div>
        `;

        chatHistory.appendChild(messageDiv);

        // Scroll to bottom
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    async sendTextMessage()
    {
        const message = this.textInput.value.trim();
        if (!message) return;

        // Disable send button temporarily
        this.sendBtn.disabled = true;
        this.sendBtn.textContent = 'Sending...';

        try
        {
            // Add user message to chat history
            this.addMessageToHistory('user', message, 'Text');

            // Clear input
            this.textInput.value = '';

            // Process the text command
            await this.processVoiceCommand(message);

        } catch (error)
        {
            console.error('Error sending text message:', error);
            this.addMessageToHistory('assistant', 'Sorry, there was an error processing your message. Please try again.', 'System');
            this.showAlert('Failed to send message. Please try again.', 'warning');
        } finally
        {
            // Re-enable send button
            this.sendBtn.disabled = false;
            this.sendBtn.textContent = 'Send';
        }
    }

    clearChatHistory()
    {
        this.chatHistory.innerHTML = `
            <div class="chat-message assistant">
                <div class="message-content">
                    <div class="message-text">Voice assistant ready. Ask about patient data, procedures, or use display commands.</div>
                    <div class="message-time">System</div>
                </div>
            </div>
        `;
    }

    switchProcedure(procedureType)
    {
        this.currentProcedure = procedureType;

        // Update active button
        this.procedureBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-procedure="${procedureType}"]`).classList.add('active');

        // Load new procedure data
        this.loadProcedureData();
    }

    async loadProcedureData()
    {
        try
        {
            const response = await fetch(`http://localhost:8000/procedures/${this.currentProcedure}`);
            if (response.ok)
            {
                const data = await response.json();
                this.updatePatientDisplay(data);
                this.updateStatusIndicators(data);
            }
        } catch (error)
        {
            console.error('Error loading procedure data:', error);
            this.loadDemoData();
        }
    }

    loadDemoData()
    {
        if (this.currentProcedure === 'pad_angioplasty')
        {
            this.updatePatientDisplay({
                patient: {
                    demographics: { name: "Robert Martinez", age: 68, gender: "Male", weight: 85, bmi: 28.5 },
                    labs: {
                        creatinine: { value: 1.2, unit: "mg/dL" },
                        platelets: { value: 245000, unit: "/μL" },
                        inr: { value: 1.1 }
                    },
                    allergies: ["Iodine contrast - rash", "Penicillin - hives"]
                },
                intraopData: {
                    contrastUsed: 45, maxContrast: 75, fluoroscopyTime: 12.5,
                    vitals: { bloodPressure: "142/88", heartRate: 78 }
                }
            });
        } else
        {
            this.updatePatientDisplay({
                patient: {
                    demographics: { name: "Linda Thompson", age: 62, gender: "Female", weight: 72 },
                    labs: {
                        potassium: { value: 4.2, unit: "mEq/L" },
                        magnesium: { value: 2.1, unit: "mg/dL" },
                        inr: { value: 2.3 }
                    },
                    allergies: []
                },
                intraopData: {
                    ablation: { powerSetting: 35, targetTemperature: 43 },
                    vitals: { bloodPressure: "125/75", heartRate: 95 }
                }
            });
        }
    }

    updatePatientDisplay(data)
    {
        const patient = data.patient;

        // Update patient name
        this.patientName.textContent = patient.demographics.name;

        // Update demographics
        this.patientDemographics.innerHTML = `
            <div class="data-item">
                <div class="data-label">Age</div>
                <div class="data-value">${patient.demographics.age} years</div>
            </div>
            <div class="data-item">
                <div class="data-label">Gender</div>
                <div class="data-value">${patient.demographics.gender}</div>
            </div>
            <div class="data-item">
                <div class="data-label">Weight</div>
                <div class="data-value">${patient.demographics.weight} kg</div>
            </div>
            <div class="data-item">
                <div class="data-label">BMI</div>
                <div class="data-value">${patient.demographics.bmi || 'N/A'}</div>
            </div>
        `;

        // Update lab values
        this.updateLabValues(patient.labs);

        // Update allergies
        if (patient.allergies && patient.allergies.length > 0)
        {
            this.allergiesList.innerHTML = patient.allergies.map(allergy =>
                `<div style="margin-bottom: 0.5rem;">• ${allergy}</div>`
            ).join('');
        } else
        {
            this.allergiesList.innerHTML = 'No known allergies';
        }
    }

    updateLabValues(labs)
    {
        let labHTML = '';

        Object.entries(labs).forEach(([key, value]) =>
        {
            if (value && typeof value === 'object')
            {
                labHTML += `
                    <div class="data-item">
                        <div class="data-label">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
                        <div class="data-value">${value.value} ${value.unit || ''}</div>
                    </div>
                `;
            }
        });

        this.labValues.innerHTML = labHTML;
    }

    updateStatusIndicators(data)
    {
        const intraop = data.intraopData;
        let statusHTML = '';

        if (this.currentProcedure === 'pad_angioplasty')
        {
            statusHTML = `
                <div class="status-item">
                    <div class="status-value">${intraop.contrastUsed}/${intraop.maxContrast}</div>
                    <div class="status-label">Contrast (mL)</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.fluoroscopyTime}</div>
                    <div class="status-label">Fluoro Time (min)</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.vitals.bloodPressure}</div>
                    <div class="status-label">Blood Pressure</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.vitals.heartRate}</div>
                    <div class="status-label">Heart Rate</div>
                </div>
            `;
        } else if (this.currentProcedure === 'ep_ablation')
        {
            statusHTML = `
                <div class="status-item">
                    <div class="status-value">${intraop.ablation.powerSetting}W</div>
                    <div class="status-label">Ablation Power</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.ablation.targetTemperature}°C</div>
                    <div class="status-label">Target Temp</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.vitals.bloodPressure}</div>
                    <div class="status-label">Blood Pressure</div>
                </div>
                <div class="status-item">
                    <div class="status-value">${intraop.vitals.heartRate}</div>
                    <div class="status-label">Heart Rate</div>
                </div>
            `;
        }

        this.statusIndicators.innerHTML = statusHTML;
    }

    initializeVitalsChart()
    {
        const ctx = document.getElementById('vitalsChart').getContext('2d');

        this.vitalsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Heart Rate',
                    data: [],
                    borderColor: '#ee2375',
                    backgroundColor: 'rgba(238, 35, 117, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Systolic BP',
                    data: [],
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e0e7ff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(148, 163, 184, 0.2)' }
                    },
                    y: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(148, 163, 184, 0.2)' }
                    }
                }
            }
        });
    }

    initializeVtkViewer()
    {
        // Initialize VTK viewer using the separate VtkViewer class
        this.vtkViewer = new VtkViewer(
            document.querySelector('.vtk-viewer'),
            (message, level) => this.showAlert(message, level)
        );
    }

    // Voice command integration methods for VTK viewer
    loadVtkFile(filename)
    {
        return this.vtkViewer?.loadVtkFile(filename);
    }

    resetVtkView()
    {
        this.vtkViewer?.resetVtkView();
    }

    zoomVtkView(factor = 1.5)
    {
        this.vtkViewer?.zoomVtkView(factor);
    }

    resetVtkCamera()
    {
        this.vtkViewer?.resetVtkCamera();
    }

    initializeDicomViewer()
    {
        // Find the panel that is the main container for the DICOM viewer.
        const dicomPanelContainer = document.getElementById('panel-5');

        // Make sure the container exists before initializing the viewer.
        if (dicomPanelContainer)
        {
            // Pass the entire panel as the container.
            // The DicomViewer class will find the ".dicom-viewer" element inside it.
            this.dicomViewer = new DicomViewer(
                dicomPanelContainer,
                (message, level) => this.showAlert(message, level)
            );
        } else
        {
            console.error("Fatal Error: The DICOM viewer panel ('#panel-5') was not found in the DOM.");
            this.showAlert("Could not initialize DICOM viewer: container not found.", "error");
        }
    }

    // Voice command integration methods for DICOM viewer
    loadDicomSeries(seriesId)
    {
        return this.dicomViewer?.loadDicomSeries(seriesId);
    }

    nextDicomImage()
    {
        this.dicomViewer?.nextDicomImage();
    }

    previousDicomImage()
    {
        this.dicomViewer?.previousDicomImage();
    }

    resetDicomView()
    {
        this.dicomViewer?.resetDicomView();
    }

    // File Browser Methods - delegated to VtkViewer
    async refreshVtkFileList()
    {
        return this.vtkViewer?.refreshVtkFileList();
    }

    populateVtkFileSelect(files)
    {
        return this.vtkViewer?.populateVtkFileSelect(files);
    }

    async loadSelectedVtkFile()
    {
        return this.vtkViewer?.loadSelectedVtkFile();
    }

    startRealTimeUpdates()
    {
        // Simulate real-time vital signs updates
        setInterval(() =>
        {
            const now = new Date();
            const hr = 70 + Math.random() * 20; // 70-90 BPM
            const sbp = 120 + Math.random() * 40; // 120-160 mmHg

            this.vitalsChart.data.labels.push(now.toLocaleTimeString());
            this.vitalsChart.data.datasets[0].data.push(hr);
            this.vitalsChart.data.datasets[1].data.push(sbp);

            // Keep only last 20 data points
            if (this.vitalsChart.data.labels.length > 20)
            {
                this.vitalsChart.data.labels.shift();
                this.vitalsChart.data.datasets.forEach(dataset => dataset.data.shift());
            }

            this.vitalsChart.update('none');
        }, 2000);
    }

    showAlert(message, level = 'info')
    {
        const alert = document.createElement('div');
        alert.className = `alert ${level}`;
        alert.textContent = message;

        document.body.appendChild(alert);

        // Auto-remove after 5 seconds
        setTimeout(() =>
        {
            if (alert.parentNode)
            {
                alert.parentNode.removeChild(alert);
            }
        }, 5000);
    }
}

// Dynamic grid layout calculation
function updateGridLayout()
{
    const mainContainer = document.querySelector('.main-container');
    const panels = ['panel-1', 'panel-2', 'panel-3', 'panel-4', 'panel-5'];
    const panelWeights = {
        'panel-1': 1,     // Patient Info
        'panel-2': 1.2,   // Voice Command Center (slightly larger)
        'panel-3': 1,     // Procedural Monitoring  
        'panel-4': 1,     // 3D Visualization
        'panel-5': 1      // DICOM Viewer
    };

    // Build grid template based on open panels
    const gridColumns = [];

    panels.forEach(panelId =>
    {
        const panel = document.getElementById(panelId);
        if (panel && !panel.classList.contains('closed'))
        {
            gridColumns.push(`${panelWeights[panelId]}fr`);
        } else
        {
            gridColumns.push('0');
        }
    });

    mainContainer.style.gridTemplateColumns = gridColumns.join(' ');
    console.log('Grid layout updated:', gridColumns.join(' '));
}

// Global functions for panel management (accessible from onclick handlers)
window.closePanel = function (panelId)
{
    const panel = document.getElementById(panelId);

    if (panel)
    {
        // Hide the panel
        panel.classList.add('closed');

        // Update grid layout dynamically
        updateGridLayout();

        console.log(`Panel ${panelId} closed`);
    }
};

window.reopenPanel = function (panelId)
{
    const panel = document.getElementById(panelId);

    if (panel)
    {
        // Show the panel
        panel.classList.remove('closed');

        // Update grid layout dynamically
        updateGridLayout();

        console.log(`Panel ${panelId} reopened`);
    }
};

window.getClosedPanels = function ()
{
    const closedPanels = [];
    const panels = ['panel-1', 'panel-3', 'panel-4', 'panel-5']; // Excludes panel-2 (Voice Command Center)

    panels.forEach(panelId =>
    {
        const panel = document.getElementById(panelId);
        if (panel && panel.classList.contains('closed'))
        {
            closedPanels.push(panelId);
        }
    });

    return closedPanels;
};

window.togglePanel = function (panelId)
{
    const panel = document.getElementById(panelId);
    if (panel)
    {
        if (panel.classList.contains('closed'))
        {
            window.reopenPanel(panelId);
        }
        else
        {
            window.closePanel(panelId);
        }
    }
};

document.addEventListener('DOMContentLoaded', () =>
{
    // 1. Initialize Cornerstone libraries FIRST
    try
    {
        initializeCornerstone();
    } catch (error)
    {
        console.error("FATAL: Could not initialize Cornerstone!", error);
        // Display an error message to the user if this fails
        const appContainer = document.querySelector('.main-container');
        if (appContainer)
        {
            appContainer.innerHTML = `<div class="error-message">Failed to load medical imaging libraries. Please refresh the page.</div>`;
        }
        return;
    }

    // 2. Now it's safe to create the main application and its viewers
    new ORVoiceAssistant();

    // 3. Initialize the grid layout
    updateGridLayout();
});