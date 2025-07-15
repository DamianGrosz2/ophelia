/**
 * Main Application - Refactored Orchestrator
 * 
 * This is the new lightweight main file that coordinates all the smaller,
 * focused components instead of having one monolithic class.
 */

// Import Chart.js for visualization
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

// Import Cornerstone libraries
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneMath from 'cornerstone-math';
import Hammer from 'hammerjs';
import * as cornerstoneTools from 'cornerstone-tools';
import * as cornerstoneWebImageLoader from 'cornerstone-web-image-loader';
import * as dicomParser from 'dicom-parser';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';

// Import DicomViewer and VtkViewer (existing classes)
import { DicomViewer } from '../dicom-viewer.js';
import { VtkViewer } from '../vtk-viewer.js';

// Import our new modular components
import { ApiClient } from './api-client.js';
import { AlertManager } from './alert-manager.js';
import { VoiceRecorder } from './voice-recorder.js';
import { ChatInterface } from './chat-interface.js';
import { ProcedureManager } from './procedure-manager.js';
import { PatientDisplayRenderer } from './patient-display-renderer.js';
import { VitalsChartManager } from './vitals-chart-manager.js';
import { SurgicalGridManager } from './surgical-grid-manager.js';

/**
 * Initialize Cornerstone libraries globally
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
        useWebWorkers: false,
        beforeSend: (xhr) =>
        {
            // This is a good place to add authorization headers if needed
        },
    });

    // Configure WADO Image Loader
    cornerstoneWADOImageLoader.configure({
        useWebWorkers: false,
        decodeConfig: {
            convertFloatPixelDataToInt: false,
            use16BitDataType: true
        }
    });

    console.log('Cornerstone libraries initialized globally');
}

/**
 * Main OR Voice Assistant Application - Refactored
 * 
 * This class now focuses on orchestrating the various components
 * rather than implementing all functionality itself.
 */
class ORVoiceAssistant
{
    constructor()
    {
        console.log('Initializing ORVoiceAssistant with modular architecture...');

        // Start async initialization
        this.initialize();
    }

    async initialize()
    {
        try
        {
            // Initialize Cornerstone first
            this.initializeCornerstone();

            // Initialize core components (now async)
            await this.initializeComponents();

            // Wire up component interactions
            this.setupComponentInteractions();

            // Start the application
            await this.startApplication();

            console.log('ORVoiceAssistant initialized successfully');
        }
        catch (error)
        {
            console.error('Failed to initialize ORVoiceAssistant:', error);
            throw error;
        }
    }

    /**
     * Initialize Cornerstone libraries
     */
    initializeCornerstone()
    {
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
            throw error;
        }
    }

    /**
     * Initialize all modular components
     */
    async initializeComponents()
    {
        // Create shared services first
        this.apiClient = new ApiClient();
        this.alertManager = new AlertManager();

        // Create the surgical grid manager first
        this.surgicalGrid = new SurgicalGridManager(this.alertManager);

        // Wait a short moment to ensure DOM elements are available
        await new Promise(resolve => setTimeout(resolve, 10));

        // Create UI components
        this.voiceRecorder = new VoiceRecorder(this.apiClient, this.alertManager);
        this.chatInterface = new ChatInterface(this.alertManager);
        this.procedureManager = new ProcedureManager(this.apiClient, this.alertManager);
        this.patientDisplay = new PatientDisplayRenderer(this.alertManager);
        this.vitalsChart = new VitalsChartManager(this.alertManager);

        // Initialize command popup
        this.initializeCommandPopup();

        console.log('All components initialized');
    }

    /**
     * Wire up interactions between components
     */
    setupComponentInteractions()
    {
        // Voice recording -> Chat
        this.voiceRecorder.onTranscription((transcribeResult) =>
        {
            this.chatInterface.addUserMessage(transcribeResult.transcript, 'Voice');
            this.processCommand(transcribeResult.transcript);
        });

        // Text messages -> Command processing
        this.chatInterface.onMessage((message) =>
        {
            this.processCommand(message);
        });

        // Procedure changes -> Update displays AND layout
        this.procedureManager.onProcedureChange((procedureType, data) =>
        {
            console.log(`Procedure changed to: ${procedureType}`);

            // Update voice recorder
            this.voiceRecorder.setCurrentProcedure(procedureType);

            // Update surgical grid layout for new procedure
            this.surgicalGrid.setProcedureType(procedureType);

            // Update data displays
            if (data)
            {
                this.patientDisplay.updateDisplay(data);
                this.vitalsChart.updateStatusIndicators(data, procedureType);
            }
        });

        // Data loaded -> Update displays
        this.procedureManager.onDataLoad((data) =>
        {
            this.patientDisplay.updateDisplay(data);
            this.vitalsChart.updateStatusIndicators(data, this.procedureManager.getCurrentProcedure());
        });

        console.log('Component interactions configured');
    }

    /**
     * Initialize command popup functionality
     */
    initializeCommandPopup()
    {
        const commandsBtn = document.getElementById('commands-btn');
        const commandPopupOverlay = document.getElementById('command-popup-overlay');
        const closeCommandsPopup = document.getElementById('close-commands-popup');

        if (!commandsBtn || !commandPopupOverlay || !closeCommandsPopup)
        {
            console.warn('Command popup elements not found, skipping initialization');
            return;
        }

        // Show popup when commands button is clicked
        commandsBtn.addEventListener('click', () =>
        {
            this.showCommandPopup();
        });

        // Close popup when close button is clicked
        closeCommandsPopup.addEventListener('click', () =>
        {
            this.hideCommandPopup();
        });

        // Close popup when clicking outside the popup content
        commandPopupOverlay.addEventListener('click', (e) =>
        {
            if (e.target === commandPopupOverlay)
            {
                this.hideCommandPopup();
            }
        });

        // Close popup with Escape key
        document.addEventListener('keydown', (e) =>
        {
            if (e.key === 'Escape' && commandPopupOverlay.classList.contains('show'))
            {
                this.hideCommandPopup();
            }
        });

        console.log('Command popup initialized');
    }

    /**
     * Show the command reference popup
     */
    showCommandPopup()
    {
        const commandPopupOverlay = document.getElementById('command-popup-overlay');
        if (commandPopupOverlay)
        {
            commandPopupOverlay.classList.add('show');
            // Focus the close button for accessibility
            const closeBtn = document.getElementById('close-commands-popup');
            if (closeBtn)
            {
                closeBtn.focus();
            }
        }
    }

    /**
     * Hide the command reference popup
     */
    hideCommandPopup()
    {
        const commandPopupOverlay = document.getElementById('command-popup-overlay');
        if (commandPopupOverlay)
        {
            commandPopupOverlay.classList.remove('show');
            // Return focus to the commands button
            const commandsBtn = document.getElementById('commands-btn');
            if (commandsBtn)
            {
                commandsBtn.focus();
            }
        }
    }

    /**
     * Initialize external viewers (VTK and DICOM)
     */
    initializeViewers()
    {
        // Initialize VTK viewer
        const vtkContainer = document.querySelector('.vtk-viewer');
        if (vtkContainer)
        {
            this.vtkViewer = new VtkViewer(
                vtkContainer,
                (message, level) => this.alertManager.showAlert(message, level)
            );
        } else
        {
            console.error("VTK viewer container not found");
            this.alertManager.showCritical("Could not initialize VTK viewer: container not found.");
        }

        // Initialize DICOM viewer
        const dicomPanelContainer = document.getElementById('dicom-viewer');
        if (dicomPanelContainer)
        {
            this.dicomViewer = new DicomViewer(
                dicomPanelContainer,
                (message, level) => this.alertManager.showAlert(message, level)
            );
        } else
        {
            console.error("DICOM viewer panel not found");
            this.alertManager.showCritical("Could not initialize DICOM viewer: container not found.");
        }

        console.log('External viewers initialized');
    }

    /**
     * Start the application
     */
    async startApplication()
    {
        try
        {
            // Load initial procedure data
            await this.procedureManager.loadProcedureData();

            // Initialize surgical grid with current procedure type
            const currentProcedure = this.procedureManager.getCurrentProcedure();
            console.log(`Initializing surgical grid with procedure: ${currentProcedure}`);
            this.surgicalGrid.setProcedureType(currentProcedure);

            // Start real-time vitals monitoring
            this.vitalsChart.startRealTimeUpdates();

            // Initialize external viewers after grid is set up
            setTimeout(() => this.initializeViewers(), 500);

            // Initialize the voice recorder UI
            this.voiceRecorder.initialize();

            this.alertManager.showSuccess('Voice Assistant ready');

        } catch (error)
        {
            console.error('Error starting application:', error);
            this.alertManager.showCritical('Failed to initialize application. Please refresh the page.');
        }
    }

    /**
     * Process voice or text commands
     */
    async processCommand(command)
    {
        try
        {
            console.log('Processing command:', command);

            // First check if it's a surgical grid command
            if (this.surgicalGrid.processGridCommand(command))
            {
                // Grid command was handled, no need to process further
                return;
            }

            // Try API processing for medical commands
            const result = await this.apiClient.processCommand(
                command,
                this.procedureManager.getCurrentProcedure()
            );

            // Display the response
            this.chatInterface.displayResponse(result, this.apiClient.baseUrl);

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

        } catch (error)
        {
            console.error('API processing failed, using fallback:', error);
            // Use fallback processing
            this.processFallbackCommand(command);
        }
    }

    /**
     * Fallback command processing when API is unavailable
     */
    processFallbackCommand(command)
    {
        let response = this.generateFallbackResponse(command);

        // Add to chat and speak
        this.chatInterface.addAssistantMessage(response, 'Assistant');
        this.chatInterface.speakText(response);

        // Execute any local commands
        this.executeLocalCommands(command);
    }

    /**
     * Generate fallback responses
     */
    generateFallbackResponse(command)
    {
        const cmd = command.toLowerCase();

        if (cmd.includes('creatinine'))
        {
            return "Creatinine is 1.2 mg/dL with eGFR of 58. Consider contrast nephropathy risk.";
        } else if (cmd.includes('contrast'))
        {
            return "Contrast used: 45mL of maximum 75mL. 30mL remaining.";
        } else if (cmd.includes('allerg'))
        {
            return "Patient allergies: Iodine contrast causing rash, Penicillin causing hives. Use with caution.";
        } else if (cmd.includes('inr'))
        {
            return "INR is 2.3 on 2025-01-09. Patient is adequately anticoagulated.";
        }

        return "I'm ready to help with your query.";
    }

    /**
     * Execute display commands from API response
     */
    executeDisplayCommands(commands)
    {
        console.log('🎯 executeDisplayCommands called with:', commands);
        console.log('🎯 Available VtkViewer references:');
        console.log('🎯   this.vtkViewer:', this.vtkViewer);
        console.log('🎯   window.activeVtkViewer:', window.activeVtkViewer);

        commands.forEach(command =>
        {
            console.log('🎯 Processing single command:', command);

            switch (command.action)
            {
                case 'show':
                    if (command.target === 'vtk')
                    {
                        const filename = command.data?.filename || 'CPO_ist.vtk';
                        this.vtkViewer?.loadVtkFile(filename);
                        this.alertManager.showInfo(`Loading 3D model: ${filename}`);
                    } else if (command.target === 'dicom')
                    {
                        const seriesId = command.data?.seriesId || '17155540';
                        this.dicomViewer?.loadDicomSeries(seriesId);
                        this.alertManager.showInfo(`Loading DICOM series: ${seriesId}`);
                    }
                    break;

                case 'next':
                    if (command.target === 'dicom')
                    {
                        this.dicomViewer?.nextDicomImage();
                        this.alertManager.showInfo('Next DICOM image');
                    }
                    break;

                case 'previous':
                    if (command.target === 'dicom')
                    {
                        this.dicomViewer?.previousDicomImage();
                        this.alertManager.showInfo('Previous DICOM image');
                    }
                    break;

                case 'zoom':
                    if (command.target === '3d')
                    {
                        const factor = command.data?.zoom_level || 1.5;
                        const vtkViewer = this.vtkViewer || window.activeVtkViewer;
                        if (vtkViewer)
                        {
                            vtkViewer.zoomVtkView(factor);
                            this.alertManager.showInfo(`Zooming 3D view by ${factor}x`);
                        } else
                        {
                            console.error('❌ No VtkViewer available for zoom command');
                            this.alertManager.showWarning('3D viewer not available');
                        }
                    }
                    break;

                case 'rotate':
                    if (command.target === '3d')
                    {
                        const direction = command.data?.direction || 'left';
                        const angle = command.data?.angle || 15;
                        const vtkViewer = this.vtkViewer || window.activeVtkViewer;
                        console.log('🎯 Executing rotate command with viewer:', vtkViewer);
                        if (vtkViewer)
                        {
                            vtkViewer.rotateVtkView(direction, angle);
                            this.alertManager.showInfo(`Rotating 3D view ${direction}`);
                            console.log('✅ Rotate command executed successfully');
                        } else
                        {
                            console.error('❌ No VtkViewer available for rotate command');
                            this.alertManager.showWarning('3D viewer not available');
                        }
                    }
                    break;

                case 'reset':
                    if (command.target === '3d')
                    {
                        const vtkViewer = this.vtkViewer || window.activeVtkViewer;
                        if (vtkViewer)
                        {
                            vtkViewer.resetVtkView();
                            this.alertManager.showInfo('Reset 3D view orientation');
                        } else
                        {
                            console.error('❌ No VtkViewer available for reset command');
                            this.alertManager.showWarning('3D viewer not available');
                        }
                    }
                    break;

                case 'close':
                    this.handleCloseDisplayCommand(command.target);
                    break;

                case 'open':
                    this.handleOpenDisplayCommand(command.target);
                    break;
            }
        });
    }

    /**
     * Handle close display commands from API
     */
    handleCloseDisplayCommand(target)
    {
        // Use surgical grid manager to close programs
        if (this.surgicalGrid)
        {
            const success = this.surgicalGrid.handleCloseCommand(`close ${target}`);
            if (!success)
            {
                this.alertManager.showWarning(`Could not close ${target}`);
            }
        }
        else
        {
            this.alertManager.showError('Surgical grid manager not available');
        }
    }

    /**
     * Handle open display commands from API
     */
    handleOpenDisplayCommand(target)
    {
        const panelMap = {
            'patient': 'panel-1',
            'voice': 'panel-2',
            'monitoring': 'panel-3',
            '3d': 'panel-4',
            'dicom': 'panel-5'
        };

        const panelId = panelMap[target];
        if (panelId && window.reopenPanel)
        {
            window.reopenPanel(panelId);
            this.alertManager.showInfo(`Opened ${target} panel`);
        }
    }

    /**
     * Execute local commands for fallback processing
     */
    executeLocalCommands(command)
    {
        const cmd = command.toLowerCase();

        if (cmd.includes('open') || cmd.includes('load') || cmd.includes('show'))
        {
            if (cmd.includes('vtk') || cmd.includes('cpo'))
            {
                const filename = cmd.includes('cpo') ? 'CPO_ist.vtk' : 'CPO_ist.vtk';
                this.vtkViewer?.loadVtkFile(filename);
            } else if (cmd.includes('dicom') || cmd.includes('scan') || cmd.includes('image'))
            {
                const seriesMatch = command.match(/(\d{8})/);
                const seriesId = seriesMatch ? seriesMatch[1] : '17155540';
                this.dicomViewer?.loadDicomSeries(seriesId);
            }
        } else if (cmd.includes('next') || cmd.includes('previous'))
        {
            if (cmd.includes('image') || cmd.includes('slice'))
            {
                if (cmd.includes('next'))
                {
                    this.dicomViewer?.nextDicomImage();
                } else
                {
                    this.dicomViewer?.previousDicomImage();
                }
            }
        } else if (cmd.includes('close'))
        {
            this.handleCloseCommands(cmd);
        } else if (cmd.includes('open') && cmd.includes('panel'))
        {
            this.handleOpenPanelCommands(cmd);
        }
    }

    /**
     * Handle close panel commands
     */
    handleCloseCommands(cmd)
    {
        if (cmd.includes('patient'))
        {
            window.closePanel('panel-1');
        } else if (cmd.includes('monitoring') || cmd.includes('vitals'))
        {
            window.closePanel('panel-3');
        } else if (cmd.includes('3d') || cmd.includes('vtk'))
        {
            window.closePanel('panel-4');
        } else if (cmd.includes('dicom') || cmd.includes('image'))
        {
            window.closePanel('panel-5');
        }
    }

    /**
     * Handle open panel commands
     */
    handleOpenPanelCommands(cmd)
    {
        if (cmd.includes('patient'))
        {
            window.reopenPanel('panel-1');
        } else if (cmd.includes('monitoring') || cmd.includes('vitals'))
        {
            window.reopenPanel('panel-3');
        } else if (cmd.includes('3d') || cmd.includes('vtk'))
        {
            window.reopenPanel('panel-4');
        } else if (cmd.includes('dicom') || cmd.includes('image'))
        {
            window.reopenPanel('panel-5');
        }
    }

    /**
     * Update visual data displays
     */
    updateVisualData(data)
    {
        // This can be expanded to update various visual elements
        if (data.creatinine || data.potassium || data.inr)
        {
            // Update could trigger patient display refresh
            console.log('Visual data update:', data);
        }
    }

    /**
     * Update grid layout (now handled by surgical grid)
     */
    updateGridLayout()
    {
        // Grid layout is now handled by the SurgicalGridManager
        // This method kept for compatibility
        console.log('Grid layout managed by SurgicalGridManager');
    }

    /**
     * Clean up resources
     */
    destroy()
    {
        this.vitalsChart?.destroy();
        this.voiceRecorder?.destroy();
        this.vtkViewer?.destroy?.();
        this.dicomViewer?.destroy?.();
        this.alertManager?.clearAllAlerts();

        console.log('ORVoiceAssistant destroyed');
    }
}

// Legacy functions for compatibility (now handled by SurgicalGridManager)
window.closePanel = function (panelId)
{
    console.log(`Legacy closePanel called for ${panelId} - now handled by SurgicalGridManager`);
};

window.reopenPanel = function (panelId)
{
    console.log(`Legacy reopenPanel called for ${panelId} - now handled by SurgicalGridManager`);
};

window.getClosedPanels = function ()
{
    console.log('Legacy getClosedPanels called - now handled by SurgicalGridManager');
    return [];
};

window.togglePanel = function (panelId)
{
    console.log(`Legacy togglePanel called for ${panelId} - now handled by SurgicalGridManager`);
};

// Function to initialize the application after components are loaded
function initializeApplication()
{
    console.log('Initializing ORVoiceAssistant...');

    try
    {
        // Create the main application instance
        window.voiceAssistant = new ORVoiceAssistant();
        console.log('ORVoiceAssistant initialized successfully');
    } catch (error)
    {
        console.error('Failed to initialize ORVoiceAssistant:', error);
        // Show error to user
        const appContainer = document.querySelector('.main-container');
        if (appContainer)
        {
            appContainer.innerHTML = `
                <div class="error-message">
                    <h2>Initialization Failed</h2>
                    <p>${error.message}</p>
                    <button onclick="location.reload()">Retry</button>
                </div>
            `;
        }
    }
}

// Initialize when components are loaded or DOM is ready
if (document.readyState === 'loading')
{
    document.addEventListener('DOMContentLoaded', () =>
    {
        if (document.querySelector('#patient-name'))
        {
            initializeApplication();
        } else
        {
            document.addEventListener('componentsLoaded', initializeApplication);
        }
    });
} else
{
    // DOM is already ready, check if components are loaded
    if (document.querySelector('#patient-name'))
    {
        initializeApplication();
    } else
    {
        document.addEventListener('componentsLoaded', initializeApplication);
    }
}

// Export the main class for testing or external access
export { ORVoiceAssistant }; 