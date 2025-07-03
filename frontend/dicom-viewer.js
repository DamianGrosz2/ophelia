// Import the cornerstone.js ecosystem
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneMath from 'cornerstone-math';
import * as cornerstoneTools from 'cornerstone-tools';
import * as cornerstoneWebImageLoader from 'cornerstone-web-image-loader';
import * as dicomParser from 'dicom-parser';

// API base URL provided by main.js or env
const API_BASE_URL = window.API_BASE_URL || (import.meta.env?.VITE_API_URL || 'http://localhost:8000');

export class DicomViewer
{
    constructor(container, onAlert = null)
    {
        // --- Properties ---
        this.container = container;
        this.onAlert = onAlert;
        this.dicomElement = null; // The DOM element where the image will be displayed
        this.currentSeriesId = null;
        this.imageIds = []; // Array of imageIds for the current series stack
        this.isInitialized = false;

        // --- UI elements ---
        this.dicomSeriesSelect = document.getElementById('dicom-series-select');
        this.loadDicomBtn = document.getElementById('load-dicom-btn');
        this.refreshDicomBtn = document.getElementById('refresh-dicom-btn');

        this.initialize();
    }

    /**
     * Main initialization flow.
     */
    async initialize()
    {
        try
        {
            this.setupDicomViewer();
            this.setupUIEventListeners();
            await this.refreshDicomSeriesList();
            this.isInitialized = true;
            console.log('DicomViewer initialized successfully.');
            // Auto-load a default series for demonstration
            this.loadDicomSeries('65244080');
        } catch (error)
        {
            console.error('Failed to initialize DicomViewer:', error);
            if (this.onAlert)
            {
                this.onAlert('DICOM Viewer failed to initialize. See console for details.', 'error');
            }
        }
    }

    /**
     * Sets up the DOM element and Cornerstone tools for this specific viewer instance.
     * This now ASSUMES that the global libraries have already been initialized from main.js.
     */
    setupDicomViewer()
    {
        // Find the viewer element in the DOM
        this.dicomElement = this.container.querySelector('.dicom-viewer');
        if (!this.dicomElement)
        {
            throw new Error('DICOM viewer element with class ".dicom-viewer" not found inside the container.');
        }

        // Global initialization of Cornerstone (init, configure) is now done in main.js.
        // This viewer component now only handles enabling the element and setting up its tools.

        // 1. Enable the DOM element for use with Cornerstone
        cornerstone.enable(this.dicomElement);

        // 2. Add and activate the necessary tools for this element
        this.setupCornerstoneTools();
    }

    /**
     * Sets up the interactive tools for the DICOM viewer.
     */
    setupCornerstoneTools()
    {
        // Stack for scrolling through a series
        const StackScrollMouseWheelTool = cornerstoneTools.StackScrollMouseWheelTool;

        // Standard interaction tools
        const WwwcTool = cornerstoneTools.WwwcTool; // Window/Level
        const PanTool = cornerstoneTools.PanTool;
        const ZoomTool = cornerstoneTools.ZoomTool;

        // Add tools to the tool manager
        cornerstoneTools.addTool(StackScrollMouseWheelTool);
        cornerstoneTools.addTool(WwwcTool);
        cornerstoneTools.addTool(PanTool);
        cornerstoneTools.addTool(ZoomTool);

        // Activate tools with specific mouse bindings
        cornerstoneTools.setToolActive('StackScrollMouseWheel', {}); // Mouse Wheel
        cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 }); // Left-click
        cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 2 }); // Middle-click
        cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 4 }); // Right-click
    }

    /**
     * Binds event listeners to the UI controls.
     */
    setupUIEventListeners()
    {
        if (this.loadDicomBtn)
        {
            this.loadDicomBtn.addEventListener('click', () => this.loadSelectedDicomSeries());
        }
        if (this.refreshDicomBtn)
        {
            this.refreshDicomBtn.addEventListener('click', () => this.refreshDicomSeriesList());
        }

        // Listen for Cornerstone image rendering to update info
        this.dicomElement.addEventListener('cornerstoneimagerendered', (event) =>
        {
            this.updateDicomInfo(event.detail);
        });
    }

    /**
     * Fetches a list of DICOM files for a given series ID and displays the first image.
     * @param {string} seriesId The ID of the series to load.
     */
    async loadDicomSeries(seriesId)
    {
        if (!this.isInitialized || !seriesId) return;
        this.currentSeriesId = seriesId;

        this.updateDicomInfo(`Loading series ${seriesId}...`);

        try
        {
            // Fetch the list of filenames for the series from the server
            const response = await fetch(`${API_BASE_URL}/dicom/series/${seriesId}`);
            if (!response.ok)
            {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            const files = data.files || [];

            if (files.length === 0)
            {
                throw new Error('No DICOM files found in this series.');
            }

            // Create an array of Cornerstone imageIds
            this.imageIds = files.map(filename => `wadouri:${API_BASE_URL}/dicom/file/${filename}`);

            // --- Load and Display the Image Stack ---
            // 1. Display the first image in the series
            const image = await cornerstone.loadImage(this.imageIds[0]);
            cornerstone.displayImage(this.dicomElement, image);

            // 2. Set up the stack for cornerstone-tools
            const stack = {
                currentImageIdIndex: 0,
                imageIds: this.imageIds,
            };

            // 3. Add the stack to the tool state manager
            cornerstoneTools.addStackStateManager(this.dicomElement, ['stack']);
            cornerstoneTools.addToolState(this.dicomElement, 'stack', stack);

            console.log(`Successfully loaded series ${seriesId} with ${this.imageIds.length} images.`);
            if (this.onAlert)
            {
                this.onAlert(`Loaded series ${seriesId}`, 'success');
            }

        } catch (error)
        {
            console.error(`Error loading DICOM series ${seriesId}:`, error);
            this.updateDicomInfo(`Error loading series: ${error.message}`);
            if (this.onAlert)
            {
                this.onAlert(`Failed to load series: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Updates the on-screen display with information about the current DICOM image.
     * @param {object} [detail] - The event detail from `cornerstoneimagerendered`.
     */
    updateDicomInfo(detail = null)
    {
        const dicomInfo = this.container.querySelector('.dicom-info');
        if (!dicomInfo) return;

        // If a simple message is passed, display it (e.g., for loading/error states)
        if (typeof detail === 'string')
        {
            dicomInfo.textContent = detail;
            return;
        }

        try
        {
            const stackState = cornerstoneTools.getToolState(this.dicomElement, 'stack');
            if (!stackState || !stackState.data || stackState.data.length === 0)
            {
                dicomInfo.textContent = 'DICOM Viewer Ready';
                return;
            }

            const stack = stackState.data[0];
            const current = stack.currentImageIdIndex + 1;
            const total = stack.imageIds.length;

            const viewport = cornerstone.getViewport(this.dicomElement);
            const ww = Math.round(viewport.voi.windowWidth);
            const wc = Math.round(viewport.voi.windowCenter);
            const zoom = viewport.scale.toFixed(2);

            dicomInfo.innerHTML = `
                Image: ${current} / ${total}<br>
                Zoom: ${zoom}x<br>
                WW/WC: ${ww} / ${wc}
            `;
        } catch (e)
        {
            // This might fail if the element is not fully ready, so we silently ignore
            dicomInfo.textContent = 'Updating...';
        }
    }

    /**
     * Resets the viewport (zoom, pan, windowing) to the default state.
     */
    resetDicomView()
    {
        if (this.isInitialized)
        {
            cornerstone.reset(this.dicomElement);
        }
    }

    // --- File Browser Methods ---

    async refreshDicomSeriesList()
    {
        try
        {
            const response = await fetch(`${API_BASE_URL}/dicom`);
            if (!response.ok) throw new Error('Failed to fetch DICOM series list.');

            const data = await response.json();
            this.populateDicomSeriesSelect(data.series);
        } catch (error)
        {
            console.error('Error fetching DICOM series:', error);
            if (this.onAlert) this.onAlert(error.message, 'warning');
        }
    }

    populateDicomSeriesSelect(series = [])
    {
        if (!this.dicomSeriesSelect) return;

        this.dicomSeriesSelect.innerHTML = '<option value="">Select DICOM series...</option>';
        series.forEach(seriesId =>
        {
            const option = document.createElement('option');
            option.value = seriesId;
            option.textContent = `Series ${seriesId}`;
            this.dicomSeriesSelect.appendChild(option);
        });
    }

    loadSelectedDicomSeries()
    {
        const selectedSeries = this.dicomSeriesSelect?.value;
        if (!selectedSeries)
        {
            if (this.onAlert) this.onAlert('Please select a DICOM series first.', 'warning');
            return;
        }
        this.loadDicomSeries(selectedSeries);
    }

    /**
     * Cleans up Cornerstone resources and event listeners.
     */
    destroy()
    {
        if (this.dicomElement && this.isInitialized)
        {
            cornerstone.disable(this.dicomElement);
        }
        this.isInitialized = false;
        // Consider removing other event listeners if the component is truly being destroyed.
        console.log("DicomViewer destroyed.");
    }
}