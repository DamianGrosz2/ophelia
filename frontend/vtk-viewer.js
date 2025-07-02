// Import VTK.js for 3D visualization
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkPolyDataReader from '@kitware/vtk.js/IO/Legacy/PolyDataReader';
import vtkHttpDataAccessHelper from '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';

export class VtkViewer
{
    constructor(container, onAlert = null)
    {
        this.container = container;
        this.onAlert = onAlert;
        this.vtkViewer = null;

        // UI elements
        this.vtkFileSelect = null;
        this.loadVtkBtn = null;
        this.refreshVtkBtn = null;

        this.initialize();
    }

    initialize()
    {
        this.initializeVtkViewer();
        this.initializeElements();
        this.setupEventListeners();
        this.refreshVtkFileList();
    }

    initializeElements()
    {
        this.vtkFileSelect = document.getElementById('vtk-file-select');
        this.loadVtkBtn = document.getElementById('load-vtk-btn');
        this.refreshVtkBtn = document.getElementById('refresh-vtk-btn');
    }

    setupEventListeners()
    {
        // VTK file browser
        if (this.loadVtkBtn)
        {
            this.loadVtkBtn.addEventListener('click', () => this.loadSelectedVtkFile());
        }
        if (this.refreshVtkBtn)
        {
            this.refreshVtkBtn.addEventListener('click', () => this.refreshVtkFileList());
        }

        this.setupVtkControls();
    }

    initializeVtkViewer()
    {
        // Find the VTK viewer container
        const vtkContainer = document.querySelector('.vtk-viewer');
        if (!vtkContainer)
        {
            console.warn('VTK viewer container not found');
            return;
        }

        // Create full screen render window
        this.vtkViewer = vtkFullScreenRenderWindow.newInstance({
            rootContainer: vtkContainer,
            background: [0.1, 0.1, 0.1]
        });

        // Get renderer and render window
        const renderer = this.vtkViewer.getRenderer();
        const renderWindow = this.vtkViewer.getRenderWindow();

        // Setup initial camera position
        const camera = renderer.getActiveCamera();
        camera.setPosition(0, 0, 10);
        camera.setFocalPoint(0, 0, 0);
        camera.setViewUp(0, 1, 0);

        console.log('VTK viewer initialized');
    }

    setupVtkControls()
    {
        const rotateBtn = document.getElementById('rotate-vtk-btn');
        const zoomBtn = document.getElementById('zoom-vtk-btn');
        const panBtn = document.getElementById('pan-vtk-btn');

        if (rotateBtn)
        {
            rotateBtn.addEventListener('click', () => this.resetVtkView());
        }
        if (zoomBtn)
        {
            zoomBtn.addEventListener('click', () => this.zoomVtkView());
        }
        if (panBtn)
        {
            panBtn.addEventListener('click', () => this.resetVtkCamera());
        }
    }

    async loadVtkFile(filename)
    {
        if (!this.vtkViewer)
        {
            console.error('VTK viewer not initialized');
            return;
        }

        try
        {
            const url = `http://localhost:8000/vtk/${filename}`;
            console.log(`Loading VTK file from: ${url}`);

            // Load the data
            const response = await fetch(url);
            if (!response.ok)
            {
                throw new Error(`Failed to load VTK file: ${response.statusText}`);
            }

            console.log('VTK file fetch successful, parsing...');

            // Determine reader based on file extension
            const isXML = filename.toLowerCase().endsWith('.vtp') || filename.toLowerCase().endsWith('.vtu');
            console.log(`Using ${isXML ? 'XML' : 'Legacy'} reader for ${filename}`);

            const reader = isXML ? vtkXMLPolyDataReader.newInstance() : vtkPolyDataReader.newInstance();

            const arrayBuffer = await response.arrayBuffer();
            console.log(`ArrayBuffer size: ${arrayBuffer.byteLength} bytes`);

            // For legacy VTK files, we need to convert to string first
            if (!isXML)
            {
                const text = new TextDecoder().decode(arrayBuffer);
                console.log('VTK file content preview:', text.substring(0, 200));
                reader.parseAsText(text);
            } else
            {
                reader.parseAsArrayBuffer(arrayBuffer);
            }

            console.log('VTK file parsed, creating mapper...');

            // Create mapper and actor
            const mapper = vtkMapper.newInstance();
            mapper.setInputConnection(reader.getOutputPort());

            const actor = vtkActor.newInstance();
            actor.setMapper(mapper);

            // Clear previous actors and add new one
            const renderer = this.vtkViewer.getRenderer();
            renderer.removeAllActors();
            renderer.addActor(actor);

            // Reset camera and render
            renderer.resetCamera();
            this.vtkViewer.getRenderWindow().render();

            // Update info display
            const vtkInfo = document.querySelector('.vtk-info');
            if (vtkInfo)
            {
                vtkInfo.textContent = `Loaded: ${filename}`;
            }

            console.log(`VTK file ${filename} loaded successfully`);
            return true;

        } catch (error)
        {
            console.error('Detailed VTK loading error:', error);
            console.error('Error stack:', error.stack);
            const vtkInfo = document.querySelector('.vtk-info');
            if (vtkInfo)
            {
                vtkInfo.textContent = `Error loading: ${filename}`;
            }
            return false;
        }
    }

    resetVtkView()
    {
        if (this.vtkViewer)
        {
            const renderer = this.vtkViewer.getRenderer();
            renderer.resetCamera();
            this.vtkViewer.getRenderWindow().render();
        }
    }

    zoomVtkView(factor = 1.5)
    {
        if (this.vtkViewer)
        {
            const renderer = this.vtkViewer.getRenderer();
            const camera = renderer.getActiveCamera();
            camera.zoom(factor);
            this.vtkViewer.getRenderWindow().render();
        }
    }

    rotateVtkView(direction = 'left', angle = 15)
    {
        // Rotate the camera around its focal point. Positive angle for left (CCW), negative for right (CW)
        if (this.vtkViewer)
        {
            const renderer = this.vtkViewer.getRenderer();
            const camera = renderer.getActiveCamera();
            const delta = direction === 'right' ? -Math.abs(angle) : Math.abs(angle);
            camera.azimuth(delta);
            this.vtkViewer.getRenderWindow().render();
        }
    }

    resetVtkCamera()
    {
        if (this.vtkViewer)
        {
            const renderer = this.vtkViewer.getRenderer();
            const camera = renderer.getActiveCamera();
            camera.setPosition(0, 0, 10);
            camera.setFocalPoint(0, 0, 0);
            camera.setViewUp(0, 1, 0);
            renderer.resetCamera();
            this.vtkViewer.getRenderWindow().render();
        }
    }

    async refreshVtkFileList()
    {
        try
        {
            const response = await fetch('http://localhost:8000/vtk');
            if (response.ok)
            {
                const data = await response.json();
                this.populateVtkFileSelect(data.files);
            } else
            {
                console.warn('Failed to fetch VTK file list');
            }
        } catch (error)
        {
            console.error('Error fetching VTK files:', error);
        }
    }

    populateVtkFileSelect(files)
    {
        if (!this.vtkFileSelect) return;

        // Clear existing options except the first one
        this.vtkFileSelect.innerHTML = '<option value="">Select VTK file...</option>';

        files.forEach(file =>
        {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            this.vtkFileSelect.appendChild(option);
        });

        console.log(`Loaded ${files.length} VTK files`);
    }

    async loadSelectedVtkFile()
    {
        const selectedFile = this.vtkFileSelect?.value;
        if (!selectedFile)
        {
            if (this.onAlert)
            {
                this.onAlert('Please select a VTK file first', 'warning');
            }
            return;
        }

        const success = await this.loadVtkFile(selectedFile);
        if (this.onAlert)
        {
            if (success)
            {
                this.onAlert(`Loaded VTK file: ${selectedFile}`, 'info');
            } else
            {
                this.onAlert(`Failed to load VTK file: ${selectedFile}`, 'warning');
            }
        }
        return success;
    }

    // Public methods for external control
    getRenderWindow()
    {
        return this.vtkViewer?.getRenderWindow();
    }

    getRenderer()
    {
        return this.vtkViewer?.getRenderer();
    }
} 