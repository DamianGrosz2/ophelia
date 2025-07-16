// Import VTK.js for 3D visualization
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkPolyDataReader from '@kitware/vtk.js/IO/Legacy/PolyDataReader';
import vtkHttpDataAccessHelper from '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';

// API base URL provided by main.js or env
const API_BASE_URL = window.API_BASE_URL || (import.meta.env?.VITE_API_URL || 'http://localhost:8000');

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

        // Load CPO_ist.vtk by default after a short delay to ensure everything is initialized
        setTimeout(() =>
        {
            this.loadVtkFile('CPO_ist.vtk');
        }, 1000);
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
            console.error('❌ VTK container not found');
            return;
        }


        // console.log('🎯 Container dimensions:', {
        //     width: vtkContainer.offsetWidth,
        //     height: vtkContainer.offsetHeight,
        //     clientWidth: vtkContainer.clientWidth,
        //     clientHeight: vtkContainer.clientHeight
        // });

        // Ensure container has proper dimensions
        if (vtkContainer.offsetHeight < 100)
        {
            vtkContainer.style.height = '400px';

        }

        // Create full screen render window - but constrained to container
        this.vtkViewer = vtkFullScreenRenderWindow.newInstance({
            rootContainer: vtkContainer,
            background: [0.1, 0.1, 0.1],
            container: vtkContainer
        });

        // Get renderer and render window
        const renderer = this.vtkViewer.getRenderer();
        const renderWindow = this.vtkViewer.getRenderWindow();

        // Setup initial camera position (moved further back for better view)
        const camera = renderer.getActiveCamera();
        camera.setPosition(0, 0, 100);
        camera.setFocalPoint(0, 0, 0);
        camera.setViewUp(0, 1, 0);

        // Setup interaction event listeners
        this.setupInteractionListeners();

        // Force a resize to ensure proper rendering
        setTimeout(() =>
        {
            if (this.vtkViewer)
            {
                this.vtkViewer.resize();
                this.vtkViewer.getRenderWindow().render();

            }
        }, 100);


    }

    /**
     * Setup interaction event listeners to track scale changes during user interaction
     */
    setupInteractionListeners()
    {
        if (!this.vtkViewer) return;

        const renderWindow = this.vtkViewer.getRenderWindow();
        const interactor = renderWindow.getInteractor();

        // Listen for interaction events (mouse wheel, dragging)
        interactor.onLeftButtonPress(() =>
        {
            // Start interaction - store initial scale if actor exists
            if (this.currentActor)
            {
                this.initialInteractionScale = this.currentActor.getScale()[0];
            }
        });

        interactor.onLeftButtonRelease(() =>
        {
            // End interaction - update scale display
            this.updateScaleDisplayFromActor();
        });

        interactor.onMiddleButtonPress(() =>
        {
            // Pan start
            if (this.currentActor)
            {
                this.initialInteractionScale = this.currentActor.getScale()[0];
            }
        });

        interactor.onMiddleButtonRelease(() =>
        {
            // Pan end
            this.updateScaleDisplayFromActor();
        });

        interactor.onRightButtonPress(() =>
        {
            // Rotate start
            if (this.currentActor)
            {
                this.initialInteractionScale = this.currentActor.getScale()[0];
            }
        });

        interactor.onRightButtonRelease(() =>
        {
            // Rotate end
            this.updateScaleDisplayFromActor();
        });

        // Listen for mouse wheel events (zoom) - override default camera movement
        interactor.onMouseWheel((callData) =>
        {
            // Prevent default VTK camera movement
            if (callData && callData.preventDefault)
            {
                callData.preventDefault();
            }

            // Get scroll direction and calculate zoom factor
            const deltaY = callData?.spinY || callData?.deltaY || 0;
            const zoomFactor = deltaY > 0 ? 0.9 : 1.1; // Scroll up = zoom out, scroll down = zoom in



            // Use our model scaling instead of camera movement
            this.zoomVtkView(zoomFactor);
        });


    }

    /**
     * Update the scale display based on current actor scale
     */
    updateScaleDisplayFromActor()
    {
        if (!this.vtkViewer) return;

        let displayScale = 1.0;
        let scaleSource = "default";

        // Check actor scale (from our programmatic scaling)
        if (this.currentActor && typeof this.currentActor.getScale === 'function')
        {
            const actorScale = this.currentActor.getScale();
            displayScale = actorScale[0];
            scaleSource = "actor";
        }

        this.updateScaleDisplay(displayScale);
    }

    /**
     * Manually resize the VTK viewer - useful when container dimensions change
     */
    resize()
    {
        if (this.vtkViewer)
        {

            this.vtkViewer.resize();
            this.vtkViewer.getRenderWindow().render();
        }
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

            return;
        }

        try
        {
            const url = `${API_BASE_URL}/vtk/${filename}`;


            // Load the data
            const response = await fetch(url);
            if (!response.ok)
            {
                throw new Error(`Failed to load VTK file: ${response.statusText}`);
            }



            // Determine reader based on file extension
            const isXML = filename.toLowerCase().endsWith('.vtp') || filename.toLowerCase().endsWith('.vtu');


            const reader = isXML ? vtkXMLPolyDataReader.newInstance() : vtkPolyDataReader.newInstance();

            const arrayBuffer = await response.arrayBuffer();


            // For legacy VTK files, we need to convert to string first
            if (!isXML)
            {
                const text = new TextDecoder().decode(arrayBuffer);

                reader.parseAsText(text);
            } else
            {
                reader.parseAsArrayBuffer(arrayBuffer);
            }



            // Create mapper and actor
            const mapper = vtkMapper.newInstance();
            mapper.setInputConnection(reader.getOutputPort());

            const actor = vtkActor.newInstance();
            actor.setMapper(mapper);

            // Store reference to actor for later scaling/manipulation
            this.currentActor = actor;


            // Clear previous actors and add new one
            const renderer = this.vtkViewer.getRenderer();
            renderer.removeAllActors();
            renderer.addActor(actor);

            // Reset camera and render
            renderer.resetCamera();

            // Get model bounds for debugging
            const bounds = mapper.getBounds();

            const modelCenter = [
                (bounds[0] + bounds[1]) / 2,
                (bounds[2] + bounds[3]) / 2,
                (bounds[4] + bounds[5]) / 2
            ];


            // Set the actor's origin to its center so scaling works around the center
            actor.setOrigin(modelCenter[0], modelCenter[1], modelCenter[2]);


            // Force camera to look at the model properly
            const camera = renderer.getActiveCamera();
            // Store initial camera distance for scale tracking
            this.initialCameraDistance = camera.getDistance();


            this.vtkViewer.getRenderWindow().render();


            // Update info display
            const vtkInfo = document.querySelector('.vtk-info');
            if (vtkInfo)
            {
                vtkInfo.textContent = `Loaded: ${filename}`;
            }

            // Show and initialize scale display
            this.updateScaleDisplay(1.0);

            // Re-setup interaction listeners now that we have an actor
            this.setupInteractionListeners();

            return true;

        } catch (error)
        {


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

            // Reset model scale to 1.0
            if (this.currentActor && typeof this.currentActor.setScale === 'function')
            {
                this.currentActor.setScale(1.0, 1.0, 1.0);
                this.currentActor.modified();

            }

            // Reset the initial camera distance for scale tracking
            const camera = renderer.getActiveCamera();
            this.initialCameraDistance = camera.getDistance();


            // Update scale display to 1.0
            this.updateScaleDisplay(1.0);

            this.vtkViewer.getRenderWindow().render();
        }
    }

    updateScaleDisplay(scale)
    {
        const scaleInfo = document.querySelector('.vtk-scale-info');
        if (scaleInfo)
        {
            scaleInfo.textContent = `Scale: ${scale.toFixed(1)}x`;
            scaleInfo.style.display = 'block';
        }
    }

    zoomVtkView(factor = 1.5)
    {




        if (this.vtkViewer)
        {


            // Use stored actor reference if available, otherwise fallback to viewProps
            let actor = this.currentActor;

            if (!actor)
            {

                const renderer = this.vtkViewer.getRenderer();
                const viewProps = renderer.getViewProps();



                if (viewProps && viewProps.length > 0)
                {
                    // Find the first actor (not camera, light, etc.)
                    actor = viewProps.find(prop => prop.isA && prop.isA('vtkActor'));

                }
            }

            if (actor && typeof actor.getScale === 'function')
            {
                // Get current scale
                const currentScale = actor.getScale();


                // Get the model's center to scale around it instead of world origin
                const bounds = actor.getBounds();
                if (bounds && bounds.length === 6)
                {
                    const center = [
                        (bounds[0] + bounds[1]) / 2,
                        (bounds[2] + bounds[3]) / 2,
                        (bounds[4] + bounds[5]) / 2
                    ];


                    // Set the actor's origin to its center so it scales around its center
                    actor.setOrigin(center[0], center[1], center[2]);
                }

                // Apply zoom factor to scale
                const newScale = [
                    currentScale[0] * factor,
                    currentScale[1] * factor,
                    currentScale[2] * factor
                ];


                actor.setScale(...newScale);

                // Important: Call modified() to trigger VTK update pipeline
                actor.modified();

                // Force render
                this.vtkViewer.getRenderWindow().render();


                // Update stored scale for debugging

                // Update scale display - use the X component since we scale uniformly
                const finalScale = actor.getScale();
                this.updateScaleDisplay(finalScale[0]);
            } else
            {
                console.error('❌ No actor found or actor does not have getScale method');
                console.error('❌ Available actor:', actor);
            }
        } else
        {
            console.error('❌ this.vtkViewer is null in zoomVtkView');
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

        } else
        {
            console.error('❌ this.vtkViewer is null in rotateVtkView');
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
            const response = await fetch(`${API_BASE_URL}/vtk`);
            if (response.ok)
            {
                const data = await response.json();
                this.populateVtkFileSelect(data.files);
            } else
            {

            }
        } catch (error)
        {

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

            // Auto-select CPO_ist.vtk if it exists
            if (file === 'CPO_ist.vtk')
            {
                option.selected = true;
            }

            this.vtkFileSelect.appendChild(option);
        });


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
        if (this.onAlert && !success)
        {
            this.onAlert(`Failed to load VTK file: ${selectedFile}`, 'warning');
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