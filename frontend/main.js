// // Import Chart.js for visualization
// import Chart from 'chart.js/auto';
// import 'chartjs-adapter-date-fns';

// import * as cornerstone from 'cornerstone-core';
// import * as cornerstoneMath from 'cornerstone-math';
// import Hammer from 'hammerjs';
// import * as cornerstoneTools from 'cornerstone-tools';
// import * as cornerstoneWebImageLoader from 'cornerstone-web-image-loader';
// import * as dicomParser from 'dicom-parser';
// import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';

// // Import DicomViewer and VtkViewer
// import { DicomViewer } from './dicom-viewer.js';
// import { VtkViewer } from './vtk-viewer.js';

// // Backend API base URL
// export const API_BASE_URL = window.API_BASE_URL || (import.meta.env.VITE_API_URL || 'http://localhost:8000');
// window.API_BASE_URL = API_BASE_URL;

// /**
//  * Initializes all Cornerstone libraries. This should be called once when the app starts.
//  */
// function initializeCornerstone()
// {
//     // Link the external dependencies to the cornerstone-tools and cornerstone-web-image-loader libraries
//     cornerstoneTools.external.cornerstone = cornerstone;
//     cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
//     cornerstoneWebImageLoader.external.cornerstone = cornerstone;
//     cornerstoneWebImageLoader.external.dicomParser = dicomParser;
//     // Register HammerJS for gesture and pointer event support
//     cornerstoneTools.external.Hammer = Hammer;

//     // Link externals for WADO image loader
//     cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
//     cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

//     // Initialize cornerstone-tools with global configuration
//     cornerstoneTools.init({
//         showSVGCursors: true,
//     });

//     // Configure the web image loader with global settings
//     cornerstoneWebImageLoader.configure({
//         useWebWorkers: false, // Set to true for better performance in production
//         beforeSend: (xhr) =>
//         {
//             // This is a good place to add authorization headers if needed
//         },
//     });

//     // Configure WADO Image Loader (disable web workers for simple dev setup)
//     cornerstoneWADOImageLoader.configure({
//         useWebWorkers: false,
//         decodeConfig: {
//             convertFloatPixelDataToInt: false,
//             use16BitDataType: true
//         }
//     });

//     console.log('Cornerstone libraries initialized globally from main.js.');
// }

// class ORVoiceAssistant
// {
//     constructor()
//     {
//         this.isRecording = false;
//         this.mediaRecorder = null;
//         this.audioChunks = [];
//         this.currentProcedure = 'pad_angioplasty';
//         this.vitalsChart = null;
//         this.vtkViewer = null;
//         this.dicomViewer = null;

//         initializeCornerstone(); // Initialize Cornerstone libraries globally

//         this.initializeElements();
//         this.setupEventListeners();
//         this.initializeVitalsChart();
//         this.initializeVtkViewer();
//         this.initializeDicomViewer();
//         this.loadProcedureData();
//         this.startRealTimeUpdates();
//     }

//     initializeElements()
//     {
//         this.voiceBtn = document.getElementById('voice-btn');
//         this.chatHistory = document.getElementById('chat-history');
//         this.currentTranscript = document.getElementById('current-transcript');
//         this.textInput = document.getElementById('text-input');
//         this.sendBtn = document.getElementById('send-btn');
//         this.patientName = document.getElementById('patient-name');
//         this.patientSections = document.getElementById('patient-sections');
//         this.statusIndicators = document.getElementById('status-indicators');
//         this.ttsAudio = document.getElementById('tts-audio');
//         this.procedureBtns = document.querySelectorAll('.procedure-btn');
//     }

//     setupEventListeners()
//     {
//         // Voice recording
//         this.voiceBtn.addEventListener('click', () => this.toggleRecording());

//         // Text input and send button
//         this.sendBtn.addEventListener('click', () => this.sendTextMessage());
//         this.textInput.addEventListener('keypress', (e) =>
//         {
//             if (e.key === 'Enter' && !e.shiftKey)
//             {
//                 e.preventDefault();
//                 this.sendTextMessage();
//             }
//         });

//         // Procedure selection
//         this.procedureBtns.forEach(btn =>
//         {
//             btn.addEventListener('click', (e) =>
//             {
//                 this.switchProcedure(e.target.dataset.procedure);
//             });
//         });

//         // Keyboard shortcuts
//         document.addEventListener('keydown', (e) =>
//         {
//             if (e.code === 'Space' && e.ctrlKey)
//             {
//                 e.preventDefault();
//                 this.toggleRecording();
//             }
//         });
//     }

//     async toggleRecording()
//     {
//         if (!this.isRecording)
//         {
//             await this.startRecording();
//         } else
//         {
//             this.stopRecording();
//         }
//     }

//     async startRecording()
//     {
//         try
//         {
//             const stream = await navigator.mediaDevices.getUserMedia({
//                 audio: {
//                     sampleRate: 16000,
//                     channelCount: 1,
//                     echoCancellation: true,
//                     noiseSuppression: true
//                 }
//             });

//             this.mediaRecorder = new MediaRecorder(stream, {
//                 mimeType: 'audio/webm;codecs=opus'
//             });

//             this.audioChunks = [];

//             this.mediaRecorder.ondataavailable = (event) =>
//             {
//                 if (event.data.size > 0)
//                 {
//                     this.audioChunks.push(event.data);
//                 }
//             };

//             this.mediaRecorder.onstop = () =>
//             {
//                 this.processAudio();
//             };

//             this.mediaRecorder.start();
//             this.isRecording = true;

//             // Update UI
//             this.voiceBtn.classList.add('recording');
//             this.voiceBtn.querySelector('.voice-icon').textContent = '⏹️';
//             this.currentTranscript.textContent = 'Listening... Speak your command.';
//             this.currentTranscript.classList.add('active');

//         } catch (error)
//         {
//             console.error('Error starting recording:', error);
//             this.showAlert('Microphone access denied. Please enable microphone permissions.', 'warning');
//         }
//     }

//     stopRecording()
//     {
//         if (this.mediaRecorder && this.isRecording)
//         {
//             this.mediaRecorder.stop();
//             this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
//             this.isRecording = false;

//             // Update UI
//             this.voiceBtn.classList.remove('recording');
//             this.voiceBtn.querySelector('.voice-icon').textContent = '🎤';
//             this.currentTranscript.textContent = 'Processing audio...';
//             this.currentTranscript.classList.add('active');
//         }
//     }

//     async processAudio()
//     {
//         try
//         {
//             const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
//             const formData = new FormData();
//             formData.append('audio', audioBlob, 'recording.webm');
//             formData.append('procedure_type', this.currentProcedure);

//             // First transcribe the audio
//             const transcribeResponse = await fetch(`${API_BASE_URL}/transcribe`, {
//                 method: 'POST',
//                 body: formData
//             });

//             if (transcribeResponse.ok)
//             {
//                 const transcribeResult = await transcribeResponse.json();

//                 // Add user message to chat history
//                 this.addMessageToHistory('user', transcribeResult.transcript, 'Voice');

//                 // Process the command
//                 await this.processVoiceCommand(transcribeResult.transcript);
//             } else
//             {
//                 throw new Error('Transcription failed');
//             }
//         } catch (error)
//         {
//             console.error('Error processing audio:', error);
//             this.currentTranscript.textContent = 'Error processing audio. Please try again.';
//             this.currentTranscript.classList.remove('active');
//             this.showAlert('Audio processing failed. Please check your connection and try again.', 'warning');
//         }
//     }

//     async processVoiceCommand(transcript)
//     {
//         try
//         {
//             const response = await fetch(`${API_BASE_URL}/ask`, {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({
//                     transcript: transcript,
//                     procedure_type: this.currentProcedure,
//                     command_type: 'query'
//                 })
//             });

//             if (response.ok)
//             {
//                 const result = await response.json();
//                 this.displayResponse(result);
//             } else
//             {
//                 throw new Error('Voice command processing failed');
//             }
//         } catch (error)
//         {
//             console.error('Error processing voice command:', error);
//             this.displayFallbackResponse(transcript);
//         }
//     }

//     displayFallbackResponse(transcript)
//     {
//         let response = "I'm ready to help with your query.";

//         if (transcript.toLowerCase().includes('creatinine'))
//         {
//             response = "Creatinine is 1.2 mg/dL with eGFR of 58. Consider contrast nephropathy risk.";
//         } else if (transcript.toLowerCase().includes('contrast'))
//         {
//             response = "Contrast used: 45mL of maximum 75mL. 30mL remaining.";
//         } else if (transcript.toLowerCase().includes('allerg'))
//         {
//             response = "Patient allergies: Iodine contrast causing rash, Penicillin causing hives. Use with caution.";
//         } else if (transcript.toLowerCase().includes('inr'))
//         {
//             response = "INR is 2.3 on 2025-01-09. Patient is adequately anticoagulated.";
//         } else if (transcript.toLowerCase().includes('open') || transcript.toLowerCase().includes('load') || transcript.toLowerCase().includes('show'))
//         {
//             if (transcript.toLowerCase().includes('vtk') || transcript.toLowerCase().includes('cpo'))
//             {
//                 response = "Loading VTK file for 3D visualization.";
//                 // Try to extract filename or use default
//                 const filename = transcript.toLowerCase().includes('cpo') ? 'CPO_ist.vtk' : 'CPO_ist.vtk';
//                 this.vtkViewer?.loadVtkFile(filename);
//             }
//             else if (transcript.toLowerCase().includes('dicom') || transcript.toLowerCase().includes('scan') || transcript.toLowerCase().includes('image'))
//             {
//                 response = "Loading DICOM medical images.";
//                 // Try to extract series ID from transcript
//                 const seriesMatch = transcript.match(/(\d{8})/);
//                 const seriesId = seriesMatch ? seriesMatch[1] : '17155540';
//                 this.dicomViewer?.loadDicomSeries(seriesId);
//             }
//         } else if (transcript.toLowerCase().includes('next') || transcript.toLowerCase().includes('previous'))
//         {
//             if (transcript.toLowerCase().includes('image') || transcript.toLowerCase().includes('slice'))
//             {
//                 if (transcript.toLowerCase().includes('next'))
//                 {
//                     response = "Moving to next DICOM image.";
//                     this.dicomViewer?.nextDicomImage();
//                 }
//                 else
//                 {
//                     response = "Moving to previous DICOM image.";
//                     this.dicomViewer?.previousDicomImage();
//                 }
//             }
//         } else if (transcript.toLowerCase().includes('rotate') || transcript.toLowerCase().includes('reset'))
//         {
//             if (transcript.toLowerCase().includes('view') || transcript.toLowerCase().includes('3d'))
//             {
//                 if (transcript.toLowerCase().includes('reset'))
//                 {
//                     response = "Resetting 3D view orientation.";
//                     this.vtkViewer?.resetVtkView();
//                 }
//                 else
//                 {
//                     const direction = transcript.toLowerCase().includes('right') ? 'right' : 'left';
//                     response = `Rotating 3D view ${direction}.`;
//                     this.vtkViewer?.rotateVtkView(direction);
//                 }
//             }
//         } else if (transcript.toLowerCase().includes('zoom'))
//         {
//             if (transcript.toLowerCase().includes('3d') || transcript.toLowerCase().includes('model'))
//             {
//                 response = "Zooming 3D model.";
//                 this.vtkViewer?.zoomVtkView();
//             }
//         } else if (transcript.toLowerCase().includes('close'))
//         {
//             if (transcript.toLowerCase().includes('patient'))
//             {
//                 response = "Closing patient information panel.";
//                 window.closePanel('panel-1');
//             }
//             else if (transcript.toLowerCase().includes('monitoring') || transcript.toLowerCase().includes('vitals'))
//             {
//                 response = "Closing procedural monitoring panel.";
//                 window.closePanel('panel-3');
//             }
//             else if (transcript.toLowerCase().includes('3d') || transcript.toLowerCase().includes('vtk'))
//             {
//                 response = "Closing 3D visualization panel.";
//                 window.closePanel('panel-4');
//             }
//             else if (transcript.toLowerCase().includes('dicom') || transcript.toLowerCase().includes('image'))
//             {
//                 response = "Closing DICOM viewer panel.";
//                 window.closePanel('panel-5');
//             }
//         } else if (transcript.toLowerCase().includes('open') && transcript.toLowerCase().includes('panel'))
//         {
//             if (transcript.toLowerCase().includes('patient'))
//             {
//                 response = "Opening patient information panel.";
//                 window.reopenPanel('panel-1');
//             }
//             else if (transcript.toLowerCase().includes('monitoring') || transcript.toLowerCase().includes('vitals'))
//             {
//                 response = "Opening procedural monitoring panel.";
//                 window.reopenPanel('panel-3');
//             }
//             else if (transcript.toLowerCase().includes('3d') || transcript.toLowerCase().includes('vtk'))
//             {
//                 response = "Opening 3D visualization panel.";
//                 window.reopenPanel('panel-4');
//             }
//             else if (transcript.toLowerCase().includes('dicom') || transcript.toLowerCase().includes('image'))
//             {
//                 response = "Opening DICOM viewer panel.";
//                 window.reopenPanel('panel-5');
//             }
//         }

//         // Add to chat history and clear transcript
//         this.addMessageToHistory('assistant', response, 'Assistant');
//         this.currentTranscript.textContent = 'Click the microphone to start voice command or type a message below...';
//         this.currentTranscript.classList.remove('active');

//         this.speakResponse(response); // Fallback always uses browser TTS
//     }

//     displayResponse(result)
//     {
//         // Add assistant response to chat history
//         this.addMessageToHistory('assistant', result.response, 'Assistant');

//         // Clear current transcript
//         this.currentTranscript.textContent = 'Click the microphone to start voice command or type a message below...';
//         this.currentTranscript.classList.remove('active');

//         // Show alert if necessary
//         if (result.alert_level !== 'info')
//         {
//             this.showAlert(result.response, result.alert_level);
//         }

//         // Handle display commands
//         if (result.display_commands && result.display_commands.length > 0)
//         {
//             this.executeDisplayCommands(result.display_commands);
//         }

//         // Update visual data if provided
//         if (result.visual_data)
//         {
//             this.updateVisualData(result.visual_data);
//         }

//         // Play OpenAI TTS audio if available, otherwise fallback to browser TTS
//         if (result.audio_url)
//         {
//             this.playGeneratedAudio(result.audio_url);
//         } else
//         {
//             this.speakResponse(result.response);
//         }
//     }

//     executeDisplayCommands(commands)
//     {
//         commands.forEach(command =>
//         {
//             console.log('Executing display command:', command);

//             if (command.action === 'show' && command.target === 'vtk')
//             {
//                 // Load VTK file if specified
//                 const filename = command.data?.filename || 'CPO_ist.vtk';
//                 this.vtkViewer?.loadVtkFile(filename);
//                 this.showAlert(`Loading 3D model: ${filename}`, 'info');
//             }
//             else if (command.action === 'show' && command.target === 'dicom')
//             {
//                 // Load DICOM series if specified
//                 const seriesId = command.data?.seriesId || '17155540';
//                 this.dicomViewer?.loadDicomSeries(seriesId);
//                 this.showAlert(`Loading DICOM series: ${seriesId}`, 'info');
//             }
//             else if (command.action === 'next' && command.target === 'dicom')
//             {
//                 this.dicomViewer?.nextDicomImage();
//                 this.showAlert('Next DICOM image', 'info');
//             }
//             else if (command.action === 'previous' && command.target === 'dicom')
//             {
//                 this.dicomViewer?.previousDicomImage();
//                 this.showAlert('Previous DICOM image', 'info');
//             }
//             else if (command.action === 'zoom' && command.target === '3d')
//             {
//                 const factor = command.data?.zoom_level || 1.5;
//                 this.vtkViewer?.zoomVtkView(factor);
//                 this.showAlert(`Zooming 3D view by ${factor}x`, 'info');
//             }
//             else if (command.action === 'rotate' && command.target === '3d')
//             {
//                 const direction = command.data?.direction || 'left';
//                 const angle = command.data?.angle || 15;
//                 this.vtkViewer?.rotateVtkView(direction, angle);
//                 this.showAlert(`Rotating 3D view ${direction}`, 'info');
//             }
//             else if (command.action === 'reset' && command.target === '3d')
//             {
//                 this.vtkViewer?.resetVtkView();
//                 this.showAlert('Reset 3D view orientation', 'info');
//             }
//             else
//             {
//                 // Original display commands
//                 this.showAlert(`Display command: ${command.action} ${command.target}`, 'info');
//             }
//         });
//     }

//     updateVisualData(data)
//     {
//         // Update lab values display
//         if (data.creatinine || data.potassium || data.inr)
//         {
//             this.updateLabValues(data);
//         }
//     }

//     playGeneratedAudio(audioUrl)
//     {
//         // Play OpenAI TTS generated audio
//         console.log('Playing OpenAI TTS audio:', audioUrl);

//         // Use the hidden audio element from HTML
//         this.ttsAudio.src = `${API_BASE_URL}${audioUrl}`;
//         this.ttsAudio.play().catch(error =>
//         {
//             console.error('Error playing generated audio:', error);
//             // Fallback to text-to-speech if audio fails
//             this.speakResponse('Audio playback failed');
//         });
//     }

//     speakResponse(text)
//     {
//         // Use Web Speech API for text-to-speech (fallback)
//         console.log('Using browser TTS fallback for:', text);
//         if ('speechSynthesis' in window)
//         {
//             const utterance = new SpeechSynthesisUtterance(text);
//             utterance.rate = 0.9;
//             utterance.pitch = 1;
//             utterance.volume = 0.8;
//             speechSynthesis.speak(utterance);
//         }
//     }

//     // New chat functionality methods
//     addMessageToHistory(sender, message, source)
//     {
//         const chatHistory = this.chatHistory;
//         const messageDiv = document.createElement('div');
//         messageDiv.className = `chat-message ${sender}`;

//         const now = new Date();
//         const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

//         messageDiv.innerHTML = `
//             <div class="message-content">
//                 <div class="message-text">${message}</div>
//                 <div class="message-time">${source} • ${timeString}</div>
//             </div>
//         `;

//         chatHistory.appendChild(messageDiv);

//         // Scroll to bottom
//         chatHistory.scrollTop = chatHistory.scrollHeight;
//     }

//     async sendTextMessage()
//     {
//         const message = this.textInput.value.trim();
//         if (!message) return;

//         // Disable send button temporarily
//         this.sendBtn.disabled = true;
//         this.sendBtn.textContent = 'Sending...';

//         try
//         {
//             // Add user message to chat history
//             this.addMessageToHistory('user', message, 'Text');

//             // Clear input
//             this.textInput.value = '';

//             // Process the text command
//             await this.processVoiceCommand(message);

//         } catch (error)
//         {
//             console.error('Error sending text message:', error);
//             this.addMessageToHistory('assistant', 'Sorry, there was an error processing your message. Please try again.', 'System');
//             this.showAlert('Failed to send message. Please try again.', 'warning');
//         } finally
//         {
//             // Re-enable send button
//             this.sendBtn.disabled = false;
//             this.sendBtn.textContent = 'Send';
//         }
//     }

//     clearChatHistory()
//     {
//         this.chatHistory.innerHTML = `
//             <div class="chat-message assistant">
//                 <div class="message-content">
//                     <div class="message-text">Voice assistant ready. Ask about patient data, procedures, or use display commands.</div>
//                     <div class="message-time">System</div>
//                 </div>
//             </div>
//         `;
//     }

//     switchProcedure(procedureType)
//     {
//         this.currentProcedure = procedureType;

//         // Update active button
//         this.procedureBtns.forEach(btn => btn.classList.remove('active'));
//         document.querySelector(`[data-procedure="${procedureType}"]`).classList.add('active');

//         // Load new procedure data
//         this.loadProcedureData();
//     }

//     async loadProcedureData()
//     {
//         try
//         {
//             const response = await fetch(`${API_BASE_URL}/procedures/${this.currentProcedure}`);
//             if (response.ok)
//             {
//                 const data = await response.json();
//                 this.updatePatientDisplay(data);
//                 this.updateStatusIndicators(data);
//             }
//         } catch (error)
//         {
//             console.error('Error loading procedure data:', error);
//             this.loadDemoData();
//         }
//     }

//     async loadDemoData()
//     {
//         try
//         {
//             console.log(`Attempting to fetch mock data for procedure: ${this.currentProcedure}`);
//             // Try to fetch from backend first
//             const response = await fetch(`${API_BASE_URL}/mock-data`);
//             if (response.ok)
//             {
//                 console.log('Mock data fetch successful');
//                 const mockData = await response.json();
//                 const procedureData = mockData.procedures[this.currentProcedure];
//                 if (procedureData)
//                 {
//                     console.log(`Found procedure data for: ${this.currentProcedure}`);
//                     this.updatePatientDisplay(procedureData);
//                     this.updateStatusIndicators(procedureData);
//                     return;
//                 } else
//                 {
//                     console.log(`No procedure data found for: ${this.currentProcedure}`);
//                 }
//             } else
//             {
//                 console.log('Failed to fetch mock data');
//             }
//         } catch (error)
//         {
//             console.error('Backend not available, using fallback data', error);
//         }

//         // Fallback data if backend is not available
//         if (this.currentProcedure === 'pad_angioplasty')
//         {
//             this.updatePatientDisplay({
//                 patient: {
//                     demographics: {
//                         name: "Robert Martinez",
//                         mrn: "MRN-789456",
//                         age: 68,
//                         gender: "Male",
//                         weight: 85,
//                         height: 175,
//                         bmi: 28.5
//                     },
//                     medicalHistory: {
//                         previousInterventions: ["Left SFA angioplasty 2023"],
//                         diabetes: "Type 2, well-controlled",
//                         smokingHistory: "Former smoker, quit 2020",
//                         comorbidities: ["Hypertension", "Hyperlipidemia", "CAD"]
//                     },
//                     labs: {
//                         creatinine: { value: 1.2, unit: "mg/dL", egfr: 58 },
//                         platelets: { value: 245000, unit: "/μL" },
//                         inr: { value: 1.1 },
//                         hemoglobin: { value: 13.2, unit: "g/dL" }
//                     },
//                     allergies: ["Iodine contrast - rash", "Penicillin - hives"],
//                     currentVitals: {
//                         bloodPressure: "142/88",
//                         heartRate: 78,
//                         oxygenSaturation: 98
//                     }
//                 },
//                 intraopData: {
//                     contrastUsed: 45, maxContrast: 75, fluoroscopyTime: 12.5,
//                     vitals: { bloodPressure: "142/88", heartRate: 78 }
//                 }
//             });
//         } else
//         {
//             this.updatePatientDisplay({
//                 patient: {
//                     demographics: {
//                         name: "Anna Müller",
//                         mrn: "AFIB-2025-001",
//                         age: 57,
//                         gender: "Female",
//                         weight: 72,
//                         height: 168,
//                         bmi: 25.5,
//                         address: "Musterweg 12, 93051 Regensburg",
//                         phone: "0176-1234567",
//                         primaryPhysician: "Dr. Schmidt, Praxis Musterstadt"
//                     },
//                     cardiacHistory: {
//                         arrhythmia: "Paroxysmal atrial fibrillation",
//                         duration: "18 months",
//                         frequency: "2-3 episodes per week",
//                         episodeDuration: "2-6 hours, spontaneous conversion",
//                         symptoms: "Palpitations, mild dyspnea on exertion, fatigue"
//                     },
//                     medicalHistory: {
//                         hypertension: "5 years, well controlled with Ramipril"
//                     },
//                     labs: {
//                         hemoglobin: { value: 13.2, unit: "g/dL" },
//                         platelets: { value: 250, unit: "G/L" },
//                         inr: { value: 1.2, note: "On Apixaban" },
//                         creatinine: { value: 0.8, unit: "mg/dL", egfr: ">90" },
//                         electrolytes: {
//                             sodium: "Normal",
//                             potassium: "Normal",
//                             calcium: "Normal"
//                         }
//                     },
//                     medications: [
//                         "Metoprolol succinate 47.5mg daily (rate control)",
//                         "Apixaban 5mg twice daily (anticoagulation)",
//                         "Ramipril 5mg daily (hypertension)"
//                     ],
//                     riskScores: {
//                         cha2ds2vasc: 1,
//                         hasbled: 1,
//                         anticoagulationIndicated: true
//                     },
//                     socialHistory: {
//                         maritalStatus: "Married",
//                         children: "2 adult children",
//                         occupation: "Teacher (full-time)",
//                         smoking: "Never smoker",
//                         alcohol: "Occasional (1-2 glasses wine per week)"
//                     },
//                     familyHistory: {
//                         mother: "Hypertension, no known AF",
//                         father: "Myocardial infarction at age 65"
//                     },
//                     currentVitals: {
//                         bloodPressure: "128/82",
//                         heartRate: 78,
//                         rhythm: "Sinus rhythm",
//                         temperature: 36.5,
//                         oxygenSaturation: 98
//                     },
//                     allergies: ["No known drug allergies", "Contrast media tolerated well"]
//                 },
//                 intraopData: {
//                     ablation: { powerSetting: 35, targetTemperature: 43 },
//                     vitals: { bloodPressure: "125/75", heartRate: 78 }
//                 }
//             });
//         }
//     }

//     updatePatientDisplay(data)
//     {
//         const patient = data.patient;

//         // Update patient name
//         this.patientName.textContent = patient.demographics.name;

//         // Clear existing sections
//         this.patientSections.innerHTML = '';

//         // Create collapsible sections based on available data
//         this.createPatientSections(patient);
//     }

//     createCollapsibleSection(title, content, isExpanded = true)
//     {
//         const section = document.createElement('div');
//         section.className = 'collapsible-section';

//         const header = document.createElement('div');
//         header.className = `collapsible-header ${!isExpanded ? 'collapsed' : ''}`;
//         header.innerHTML = `
//             <span class="collapsible-title">${title}</span>
//             <span class="collapsible-arrow">▼</span>
//         `;

//         const contentDiv = document.createElement('div');
//         contentDiv.className = `collapsible-content ${!isExpanded ? 'collapsed' : ''}`;
//         contentDiv.innerHTML = content;

//         // Add click handler
//         header.addEventListener('click', () =>
//         {
//             const isCollapsed = header.classList.contains('collapsed');
//             header.classList.toggle('collapsed', !isCollapsed);
//             contentDiv.classList.toggle('collapsed', !isCollapsed);
//         });

//         section.appendChild(header);
//         section.appendChild(contentDiv);

//         return section;
//     }

//     createPatientSections(patient)
//     {
//         // Demographics Section (always expanded)
//         const demographicsContent = this.createDemographicsContent(patient.demographics);
//         this.patientSections.appendChild(this.createCollapsibleSection('👤 Demographics', demographicsContent, true));

//         // Medical History Section
//         if (patient.medicalHistory || patient.cardiacHistory)
//         {
//             const historyContent = this.createMedicalHistoryContent(patient);
//             this.patientSections.appendChild(this.createCollapsibleSection('📋 Medical History', historyContent, true));
//         }

//         // Laboratory Values Section
//         if (patient.labs)
//         {
//             const labContent = this.createLabContent(patient.labs);
//             this.patientSections.appendChild(this.createCollapsibleSection('🧪 Laboratory Values', labContent, true));
//         }

//         // Imaging Section
//         if (patient.imaging)
//         {
//             const imagingContent = this.createImagingContent(patient.imaging);
//             this.patientSections.appendChild(this.createCollapsibleSection('📸 Imaging Studies', imagingContent, false));
//         }

//         // Medications Section
//         if (patient.medications && patient.medications.length > 0)
//         {
//             const medicationsContent = this.createMedicationsContent(patient.medications);
//             this.patientSections.appendChild(this.createCollapsibleSection('💊 Current Medications', medicationsContent, false));
//         }

//         // Risk Scores Section
//         if (patient.riskScores)
//         {
//             const riskContent = this.createRiskScoresContent(patient.riskScores);
//             this.patientSections.appendChild(this.createCollapsibleSection('📊 Risk Assessment', riskContent, true));
//         }

//         // Current Vitals Section
//         if (patient.currentVitals)
//         {
//             const vitalsContent = this.createCurrentVitalsContent(patient.currentVitals);
//             this.patientSections.appendChild(this.createCollapsibleSection('❤️ Current Vitals', vitalsContent, true));
//         }

//         // Social & Family History Section
//         if (patient.socialHistory || patient.familyHistory)
//         {
//             const socialContent = this.createSocialHistoryContent(patient);
//             this.patientSections.appendChild(this.createCollapsibleSection('👥 Social & Family History', socialContent, false));
//         }

//         // Allergies Section (always show as alert)
//         const allergiesContent = this.createAllergiesContent(patient.allergies);
//         const allergiesSection = this.createCollapsibleSection('⚠️ Allergies & Contraindications', allergiesContent, true);
//         // Apply alert styling to the section itself and its header
//         allergiesSection.style.background = 'rgba(255, 59, 48, 0.1)';
//         allergiesSection.style.borderColor = 'rgba(255, 59, 48, 0.5)';
//         const allergiesHeader = allergiesSection.querySelector('.collapsible-header');
//         if (allergiesHeader)
//         {
//             allergiesHeader.style.background = 'rgba(255, 59, 48, 0.15)';
//         }
//         this.patientSections.appendChild(allergiesSection);
//     }

//     createDemographicsContent(demographics)
//     {
//         return `
//             <div class="info-row">
//                 <span class="info-label">MRN:</span>
//                 <span class="info-value">${demographics.mrn || 'N/A'}</span>
//             </div>
//             <div class="info-row">
//                 <span class="info-label">Age:</span>
//                 <span class="info-value">${demographics.age} years</span>
//             </div>
//             <div class="info-row">
//                 <span class="info-label">Gender:</span>
//                 <span class="info-value">${demographics.gender}</span>
//             </div>
//             <div class="info-row">
//                 <span class="info-label">Weight:</span>
//                 <span class="info-value">${demographics.weight} kg</span>
//             </div>
//             <div class="info-row">
//                 <span class="info-label">Height:</span>
//                 <span class="info-value">${demographics.height || 'N/A'} cm</span>
//             </div>
//             <div class="info-row">
//                 <span class="info-label">BMI:</span>
//                 <span class="info-value">${demographics.bmi || 'N/A'}</span>
//             </div>
//             ${demographics.address ? `
//             <div class="info-row">
//                 <span class="info-label">Address:</span>
//                 <span class="info-value">${demographics.address}</span>
//             </div>` : ''}
//             ${demographics.phone ? `
//             <div class="info-row">
//                 <span class="info-label">Phone:</span>
//                 <span class="info-value">${demographics.phone}</span>
//             </div>` : ''}
//             ${demographics.primaryPhysician ? `
//             <div class="info-row">
//                 <span class="info-label">Primary Physician:</span>
//                 <span class="info-value">${demographics.primaryPhysician}</span>
//             </div>` : ''}
//         `;
//     }

//     createMedicalHistoryContent(patient)
//     {
//         let content = '';

//         if (patient.cardiacHistory)
//         {
//             const ch = patient.cardiacHistory;
//             content += `
//                 <div class="info-row">
//                     <span class="info-label">Arrhythmia:</span>
//                     <span class="info-value">${ch.arrhythmia || 'None'}</span>
//                 </div>
//                 ${ch.duration ? `
//                 <div class="info-row">
//                     <span class="info-label">Duration:</span>
//                     <span class="info-value">${ch.duration}</span>
//                 </div>` : ''}
//                 ${ch.frequency ? `
//                 <div class="info-row">
//                     <span class="info-label">Frequency:</span>
//                     <span class="info-value">${ch.frequency}</span>
//                 </div>` : ''}
//                 ${ch.symptoms ? `
//                 <div class="info-row">
//                     <span class="info-label">Symptoms:</span>
//                     <span class="info-value">${ch.symptoms}</span>
//                 </div>` : ''}
//                 ${ch.episodeDuration ? `
//                 <div class="info-row">
//                     <span class="info-label">Episode Duration:</span>
//                     <span class="info-value">${ch.episodeDuration}</span>
//                 </div>` : ''}
//             `;
//         }

//         if (patient.medicalHistory)
//         {
//             const mh = patient.medicalHistory;
//             if (mh.hypertension)
//             {
//                 content += `
//                 <div class="info-row">
//                     <span class="info-label">Hypertension:</span>
//                     <span class="info-value">${mh.hypertension}</span>
//                 </div>`;
//             }
//             if (mh.diabetes && mh.diabetes !== 'None')
//             {
//                 content += `
//                 <div class="info-row">
//                     <span class="info-label">Diabetes:</span>
//                     <span class="info-value">${mh.diabetes}</span>
//                 </div>`;
//             }
//             if (mh.previousInterventions && mh.previousInterventions.length > 0)
//             {
//                 content += `
//                 <div class="info-row">
//                     <span class="info-label">Previous Interventions:</span>
//                     <div class="info-value">
//                         <ul class="info-list">
//                             ${mh.previousInterventions.map(intervention => `<li>${intervention}</li>`).join('')}
//                         </ul>
//                     </div>
//                 </div>`;
//             }
//             if (mh.comorbidities && mh.comorbidities.length > 0)
//             {
//                 content += `
//                 <div class="info-row">
//                     <span class="info-label">Comorbidities:</span>
//                     <div class="info-value">
//                         <ul class="info-list">
//                             ${mh.comorbidities.map(comorbidity => `<li>${comorbidity}</li>`).join('')}
//                         </ul>
//                     </div>
//                 </div>`;
//             }
//             if (mh.smokingHistory)
//             {
//                 content += `
//                 <div class="info-row">
//                     <span class="info-label">Smoking History:</span>
//                     <span class="info-value">${mh.smokingHistory}</span>
//                 </div>`;
//             }
//         }

//         return content || '<div class="info-value">No significant medical history</div>';
//     }

//     createLabContent(labs)
//     {
//         let content = '';

//         Object.keys(labs).forEach(labKey =>
//         {
//             const lab = labs[labKey];
//             if (typeof lab === 'object' && lab.value !== undefined)
//             {
//                 content += `
//                 <div class="info-row">
//                     <span class="info-label">${this.formatLabName(labKey)}:</span>
//                     <span class="info-value">${lab.value} ${lab.unit || ''} ${lab.note ? `(${lab.note})` : ''}</span>
//                 </div>`;
//             } else if (typeof lab === 'object')
//             {
//                 // Handle nested objects like electrolytes, thyroidFunction
//                 Object.keys(lab).forEach(subKey =>
//                 {
//                     if (subKey !== 'date' && subKey !== 'status')
//                     {
//                         content += `
//                         <div class="info-row">
//                             <span class="info-label">${this.formatLabName(subKey)}:</span>
//                             <span class="info-value">${lab[subKey]}</span>
//                         </div>`;
//                     }
//                 });
//             }
//         });

//         return content || '<div class="info-value">No laboratory data available</div>';
//     }

//     createImagingContent(imaging)
//     {
//         let content = '';

//         Object.keys(imaging).forEach(studyType =>
//         {
//             const study = imaging[studyType];
//             content += `<h4 style="color: #ee2375; margin: 0.5rem 0;">${this.formatStudyName(studyType)}</h4>`;

//             Object.keys(study).forEach(key =>
//             {
//                 if (key !== 'date')
//                 {
//                     content += `
//                     <div class="info-row">
//                         <span class="info-label">${this.formatLabName(key)}:</span>
//                         <span class="info-value">${study[key]}</span>
//                     </div>`;
//                 }
//             });

//             if (study.date)
//             {
//                 content += `
//                 <div class="info-row">
//                     <span class="info-label">Date:</span>
//                     <span class="info-value">${study.date}</span>
//                 </div>`;
//             }
//         });

//         return content || '<div class="info-value">No imaging studies available</div>';
//     }

//     createMedicationsContent(medications)
//     {
//         return `
//             <ul class="info-list">
//                 ${medications.map(med => `<li>${med}</li>`).join('')}
//             </ul>
//         `;
//     }

//     createRiskScoresContent(riskScores)
//     {
//         let content = '';

//         if (riskScores.cha2ds2vasc !== undefined)
//         {
//             const scoreClass = riskScores.cha2ds2vasc <= 1 ? 'score-low' : riskScores.cha2ds2vasc <= 3 ? 'score-medium' : 'score-high';
//             content += `
//             <div class="info-row">
//                 <span class="info-label">CHA₂DS₂-VASc:</span>
//                 <span class="info-value">${riskScores.cha2ds2vasc} <span class="score-badge ${scoreClass}">${riskScores.cha2ds2vasc <= 1 ? 'Low' : riskScores.cha2ds2vasc <= 3 ? 'Moderate' : 'High'}</span></span>
//             </div>`;
//         }

//         if (riskScores.hasbled !== undefined)
//         {
//             const scoreClass = riskScores.hasbled <= 2 ? 'score-low' : riskScores.hasbled <= 4 ? 'score-medium' : 'score-high';
//             content += `
//             <div class="info-row">
//                 <span class="info-label">HAS-BLED:</span>
//                 <span class="info-value">${riskScores.hasbled} <span class="score-badge ${scoreClass}">${riskScores.hasbled <= 2 ? 'Low' : riskScores.hasbled <= 4 ? 'Moderate' : 'High'}</span></span>
//             </div>`;
//         }

//         if (riskScores.anticoagulationIndicated !== undefined)
//         {
//             content += `
//             <div class="info-row">
//                 <span class="info-label">Anticoagulation:</span>
//                 <span class="info-value">${riskScores.anticoagulationIndicated ? 'Indicated' : 'Not indicated'}</span>
//             </div>`;
//         }

//         return content || '<div class="info-value">No risk scores calculated</div>';
//     }

//     createCurrentVitalsContent(vitals)
//     {
//         return `
//             <div class="vitals-grid">
//                 ${vitals.bloodPressure ? `
//                 <div class="vital-item">
//                     <div class="vital-label">Blood Pressure</div>
//                     <div class="vital-value">${vitals.bloodPressure}</div>
//                 </div>` : ''}
//                 ${vitals.heartRate ? `
//                 <div class="vital-item">
//                     <div class="vital-label">Heart Rate</div>
//                     <div class="vital-value">${vitals.heartRate} bpm</div>
//                 </div>` : ''}
//                 ${vitals.temperature ? `
//                 <div class="vital-item">
//                     <div class="vital-label">Temperature</div>
//                     <div class="vital-value">${vitals.temperature}°C</div>
//                 </div>` : ''}
//                 ${vitals.oxygenSaturation ? `
//                 <div class="vital-item">
//                     <div class="vital-label">O₂ Saturation</div>
//                     <div class="vital-value">${vitals.oxygenSaturation}%</div>
//                 </div>` : ''}
//                 ${vitals.rhythm ? `
//                 <div class="vital-item">
//                     <div class="vital-label">Rhythm</div>
//                     <div class="vital-value">${vitals.rhythm}</div>
//                 </div>` : ''}
//             </div>
//         `;
//     }

//     createSocialHistoryContent(patient)
//     {
//         let content = '';

//         if (patient.socialHistory)
//         {
//             const sh = patient.socialHistory;
//             Object.keys(sh).forEach(key =>
//             {
//                 content += `
//                 <div class="info-row">
//                     <span class="info-label">${this.formatLabName(key)}:</span>
//                     <span class="info-value">${sh[key]}</span>
//                 </div>`;
//             });
//         }

//         if (patient.familyHistory)
//         {
//             content += '<h4 style="color: #ee2375; margin: 0.5rem 0;">Family History</h4>';
//             const fh = patient.familyHistory;
//             Object.keys(fh).forEach(key =>
//             {
//                 content += `
//                 <div class="info-row">
//                     <span class="info-label">${this.formatLabName(key)}:</span>
//                     <span class="info-value">${fh[key]}</span>
//                 </div>`;
//             });
//         }

//         return content || '<div class="info-value">No social or family history available</div>';
//     }

//     createAllergiesContent(allergies)
//     {
//         if (allergies && allergies.length > 0)
//         {
//             return `
//                 <ul class="info-list" style="color: #ff3b30;">
//                     ${allergies.map(allergy => `<li><strong>${allergy}</strong></li>`).join('')}
//                 </ul>
//             `;
//         } else
//         {
//             return '<div class="info-value" style="color: #22c55e;"><strong>No known allergies</strong></div>';
//         }
//     }

//     formatLabName(key)
//     {
//         return key.replace(/([A-Z])/g, ' $1')
//             .replace(/^./, str => str.toUpperCase())
//             .replace(/egfr/gi, 'eGFR')
//             .replace(/inr/gi, 'INR')
//             .replace(/tsh/gi, 'TSH')
//             .replace(/ft3/gi, 'fT3')
//             .replace(/ft4/gi, 'fT4')
//             .replace(/bmi/gi, 'BMI')
//             .replace(/mrn/gi, 'MRN');
//     }

//     formatStudyName(studyType)
//     {
//         return studyType.replace(/([A-Z])/g, ' $1')
//             .replace(/^./, str => str.toUpperCase())
//             .replace(/ct/gi, 'CT')
//             .replace(/mri/gi, 'MRI')
//             .replace(/echo/gi, 'Echo');
//     }

//     updateLabValues(labs)
//     {
//         let labHTML = '';

//         Object.entries(labs).forEach(([key, value]) =>
//         {
//             if (value && typeof value === 'object')
//             {
//                 labHTML += `
//                     <div class="data-item">
//                         <div class="data-label">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
//                         <div class="data-value">${value.value} ${value.unit || ''}</div>
//                     </div>
//                 `;
//             }
//         });

//         this.labValues.innerHTML = labHTML;
//     }

//     updateStatusIndicators(data)
//     {
//         const intraop = data.intraopData;
//         let statusHTML = '';

//         if (this.currentProcedure === 'pad_angioplasty')
//         {
//             statusHTML = `
//                 <div class="status-item">
//                     <div class="status-value">${intraop.contrastUsed}/${intraop.maxContrast}</div>
//                     <div class="status-label">Contrast (mL)</div>
//                 </div>
//                 <div class="status-item">
//                     <div class="status-value">${intraop.fluoroscopyTime}</div>
//                     <div class="status-label">Fluoro Time (min)</div>
//                 </div>
//                 <div class="status-item">
//                     <div class="status-value">${intraop.vitals.bloodPressure}</div>
//                     <div class="status-label">Blood Pressure</div>
//                 </div>
//                 <div class="status-item">
//                     <div class="status-value">${intraop.vitals.heartRate}</div>
//                     <div class="status-label">Heart Rate</div>
//                 </div>
//             `;
//         } else if (this.currentProcedure === 'ep_ablation')
//         {
//             statusHTML = `
//                 <div class="status-item">
//                     <div class="status-value">${intraop.ablation.powerSetting}W</div>
//                     <div class="status-label">Ablation Power</div>
//                 </div>
//                 <div class="status-item">
//                     <div class="status-value">${intraop.ablation.targetTemperature}°C</div>
//                     <div class="status-label">Target Temp</div>
//                 </div>
//                 <div class="status-item">
//                     <div class="status-value">${intraop.vitals.bloodPressure}</div>
//                     <div class="status-label">Blood Pressure</div>
//                 </div>
//                 <div class="status-item">
//                     <div class="status-value">${intraop.vitals.heartRate}</div>
//                     <div class="status-label">Heart Rate</div>
//                 </div>
//             `;
//         }

//         this.statusIndicators.innerHTML = statusHTML;
//     }

//     initializeVitalsChart()
//     {
//         const ctx = document.getElementById('vitalsChart').getContext('2d');

//         this.vitalsChart = new Chart(ctx, {
//             type: 'line',
//             data: {
//                 labels: [],
//                 datasets: [{
//                     label: 'Heart Rate',
//                     data: [],
//                     borderColor: '#ee2375',
//                     backgroundColor: 'rgba(238, 35, 117, 0.1)',
//                     tension: 0.4
//                 }, {
//                     label: 'Systolic BP',
//                     data: [],
//                     borderColor: '#ff6b6b',
//                     backgroundColor: 'rgba(255, 107, 107, 0.1)',
//                     tension: 0.4
//                 }]
//             },
//             options: {
//                 responsive: true,
//                 maintainAspectRatio: false,
//                 plugins: {
//                     legend: {
//                         labels: {
//                             color: '#e0e7ff'
//                         }
//                     }
//                 },
//                 scales: {
//                     x: {
//                         ticks: { color: '#94a3b8' },
//                         grid: { color: 'rgba(148, 163, 184, 0.2)' }
//                     },
//                     y: {
//                         ticks: { color: '#94a3b8' },
//                         grid: { color: 'rgba(148, 163, 184, 0.2)' }
//                     }
//                 }
//             }
//         });
//     }

//     initializeVtkViewer()
//     {
//         // Initialize VTK viewer using the separate VtkViewer class
//         this.vtkViewer = new VtkViewer(
//             document.querySelector('.vtk-viewer'),
//             (message, level) => this.showAlert(message, level)
//         );
//     }

//     // Voice command integration methods for VTK viewer
//     loadVtkFile(filename)
//     {
//         return this.vtkViewer?.loadVtkFile(filename);
//     }

//     resetVtkView()
//     {
//         this.vtkViewer?.resetVtkView();
//     }

//     zoomVtkView(factor = 1.5)
//     {
//         this.vtkViewer?.zoomVtkView(factor);
//     }

//     resetVtkCamera()
//     {
//         this.vtkViewer?.resetVtkCamera();
//     }

//     initializeDicomViewer()
//     {
//         // Find the panel that is the main container for the DICOM viewer.
//         const dicomPanelContainer = document.getElementById('panel-5');

//         // Make sure the container exists before initializing the viewer.
//         if (dicomPanelContainer)
//         {
//             // Pass the entire panel as the container.
//             // The DicomViewer class will find the ".dicom-viewer" element inside it.
//             this.dicomViewer = new DicomViewer(
//                 dicomPanelContainer,
//                 (message, level) => this.showAlert(message, level)
//             );
//         } else
//         {
//             console.error("Fatal Error: The DICOM viewer panel ('#panel-5') was not found in the DOM.");
//             this.showAlert("Could not initialize DICOM viewer: container not found.", "error");
//         }
//     }

//     // Voice command integration methods for DICOM viewer
//     loadDicomSeries(seriesId)
//     {
//         return this.dicomViewer?.loadDicomSeries(seriesId);
//     }

//     nextDicomImage()
//     {
//         this.dicomViewer?.nextDicomImage();
//     }

//     previousDicomImage()
//     {
//         this.dicomViewer?.previousDicomImage();
//     }

//     resetDicomView()
//     {
//         this.dicomViewer?.resetDicomView();
//     }

//     // File Browser Methods - delegated to VtkViewer
//     async refreshVtkFileList()
//     {
//         return this.vtkViewer?.refreshVtkFileList();
//     }

//     populateVtkFileSelect(files)
//     {
//         return this.vtkViewer?.populateVtkFileSelect(files);
//     }

//     async loadSelectedVtkFile()
//     {
//         return this.vtkViewer?.loadSelectedVtkFile();
//     }

//     startRealTimeUpdates()
//     {
//         // Simulate real-time vital signs updates
//         setInterval(() =>
//         {
//             const now = new Date();
//             const hr = 70 + Math.random() * 20; // 70-90 BPM
//             const sbp = 120 + Math.random() * 40; // 120-160 mmHg

//             this.vitalsChart.data.labels.push(now.toLocaleTimeString());
//             this.vitalsChart.data.datasets[0].data.push(hr);
//             this.vitalsChart.data.datasets[1].data.push(sbp);

//             // Keep only last 20 data points
//             if (this.vitalsChart.data.labels.length > 20)
//             {
//                 this.vitalsChart.data.labels.shift();
//                 this.vitalsChart.data.datasets.forEach(dataset => dataset.data.shift());
//             }

//             this.vitalsChart.update('none');
//         }, 2000);
//     }

//     showAlert(message, level = 'info')
//     {
//         const alert = document.createElement('div');
//         alert.className = `alert ${level}`;
//         alert.textContent = message;

//         document.body.appendChild(alert);

//         // Auto-remove after 5 seconds
//         setTimeout(() =>
//         {
//             if (alert.parentNode)
//             {
//                 alert.parentNode.removeChild(alert);
//             }
//         }, 5000);
//     }
// }

// // Dynamic grid layout calculation
// function updateGridLayout()
// {
//     const mainContainer = document.querySelector('.main-container');
//     const panels = ['panel-1', 'panel-2', 'panel-3', 'panel-4', 'panel-5'];
//     const panelWeights = {
//         'panel-1': 1,     // Patient Info
//         'panel-2': 1.2,   // Voice Command Center (slightly larger)
//         'panel-3': 1,     // Procedural Monitoring  
//         'panel-4': 1,     // 3D Visualization
//         'panel-5': 1      // DICOM Viewer
//     };

//     // Build grid template based on open panels
//     const gridColumns = [];

//     panels.forEach(panelId =>
//     {
//         const panel = document.getElementById(panelId);
//         if (panel && !panel.classList.contains('closed'))
//         {
//             gridColumns.push(`${panelWeights[panelId]}fr`);
//         } else
//         {
//             gridColumns.push('0');
//         }
//     });

//     mainContainer.style.gridTemplateColumns = gridColumns.join(' ');
//     console.log('Grid layout updated:', gridColumns.join(' '));
// }

// // Global functions for panel management (accessible from onclick handlers)
// window.closePanel = function (panelId)
// {
//     const panel = document.getElementById(panelId);

//     if (panel)
//     {
//         // Hide the panel
//         panel.classList.add('closed');

//         // Update grid layout dynamically
//         updateGridLayout();

//         console.log(`Panel ${panelId} closed`);
//     }
// };

// window.reopenPanel = function (panelId)
// {
//     const panel = document.getElementById(panelId);

//     if (panel)
//     {
//         // Show the panel
//         panel.classList.remove('closed');

//         // Update grid layout dynamically
//         updateGridLayout();

//         console.log(`Panel ${panelId} reopened`);
//     }
// };

// window.getClosedPanels = function ()
// {
//     const closedPanels = [];
//     const panels = ['panel-1', 'panel-3', 'panel-4', 'panel-5']; // Excludes panel-2 (Voice Command Center)

//     panels.forEach(panelId =>
//     {
//         const panel = document.getElementById(panelId);
//         if (panel && panel.classList.contains('closed'))
//         {
//             closedPanels.push(panelId);
//         }
//     });

//     return closedPanels;
// };

// window.togglePanel = function (panelId)
// {
//     const panel = document.getElementById(panelId);
//     if (panel)
//     {
//         if (panel.classList.contains('closed'))
//         {
//             window.reopenPanel(panelId);
//         }
//         else
//         {
//             window.closePanel(panelId);
//         }
//     }
// };

// // Function to initialize the application after components are loaded
// function initializeApplication()
// {
//     console.log('Initializing ORVoiceAssistant...');

//     // 1. Initialize Cornerstone libraries FIRST
//     try
//     {
//         initializeCornerstone();
//     } catch (error)
//     {
//         console.error("FATAL: Could not initialize Cornerstone!", error);
//         // Display an error message to the user if this fails
//         const appContainer = document.querySelector('.main-container');
//         if (appContainer)
//         {
//             appContainer.innerHTML = `<div class="error-message">Failed to load medical imaging libraries. Please refresh the page.</div>`;
//         }
//         return;
//     }

//     // 2. Now it's safe to create the main application and its viewers
//     window.voiceAssistant = new ORVoiceAssistant();

//     // 3. Initialize the grid layout
//     updateGridLayout();

//     console.log('ORVoiceAssistant initialized successfully');
// }

// // Initialize when components are loaded or DOM is ready (whichever comes last)
// if (document.readyState === 'loading')
// {
//     document.addEventListener('DOMContentLoaded', () =>
//     {
//         // If components are already loaded, initialize immediately
//         if (document.querySelector('#patient-name'))
//         {
//             initializeApplication();
//         } else
//         {
//             // Otherwise wait for components to load
//             document.addEventListener('componentsLoaded', initializeApplication);
//         }
//     });
// } else
// {
//     // DOM is already ready, check if components are loaded
//     if (document.querySelector('#patient-name'))
//     {
//         initializeApplication();
//     } else
//     {
//         // Wait for components to load
//         document.addEventListener('componentsLoaded', initializeApplication);
//     }
// }