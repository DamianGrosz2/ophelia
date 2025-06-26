// Import cornerstone.js for DICOM viewing
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWebImageLoader from 'cornerstone-web-image-loader';
import * as cornerstoneMath from 'cornerstone-math';
import * as cornerstoneTools from 'cornerstone-tools';
import * as dicomParser from 'dicom-parser';

export class DicomViewer
{
    constructor(container, onAlert = null)
    {
        this.container = container;
        this.onAlert = onAlert;
        this.dicomElement = null;
        this.currentImageIndex = 0;
        this.dicomSeries = [];

        // UI elements
        this.dicomSeriesSelect = null;
        this.loadDicomBtn = null;
        this.refreshDicomBtn = null;

        this.initialize();
    }

    initialize()
    {
        this.initializeDicomViewer();
        this.initializeElements();
        this.setupEventListeners();
        this.refreshDicomSeriesList();
    }

    initializeElements()
    {
        this.dicomSeriesSelect = document.getElementById('dicom-series-select');
        this.loadDicomBtn = document.getElementById('load-dicom-btn');
        this.refreshDicomBtn = document.getElementById('refresh-dicom-btn');
    }

    setupEventListeners()
    {
        // DICOM file browser  
        if (this.loadDicomBtn)
        {
            this.loadDicomBtn.addEventListener('click', () => this.loadSelectedDicomSeries());
        }
        if (this.refreshDicomBtn)
        {
            this.refreshDicomBtn.addEventListener('click', () => this.refreshDicomSeriesList());
        }

        this.setupDicomControls();
    }

    initializeDicomViewer()
    {
        try
        {
            console.log('Starting DICOM viewer initialization...');

            // Check dependencies
            console.log('Checking cornerstone dependencies...');
            console.log('cornerstone:', typeof cornerstone);
            console.log('cornerstoneWebImageLoader:', typeof cornerstoneWebImageLoader);
            console.log('dicomParser:', typeof dicomParser);
            console.log('cornerstoneTools:', typeof cornerstoneTools);
            console.log('cornerstoneMath:', typeof cornerstoneMath);

            // Initialize cornerstone
            if (cornerstoneWebImageLoader.external)
            {
                cornerstoneWebImageLoader.external.cornerstone = cornerstone;
                cornerstoneWebImageLoader.external.dicomParser = dicomParser;
            }
            if (cornerstoneTools.external)
            {
                cornerstoneTools.external.cornerstone = cornerstone;
                cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
            }

            // Register the web image loader with cornerstone
            console.log('Registering image loaders...');
            if (cornerstone.registerImageLoader)
            {
                cornerstone.registerImageLoader('wadouri', cornerstoneWebImageLoader.loadImage);
                cornerstone.registerImageLoader('http', cornerstoneWebImageLoader.loadImage);
                cornerstone.registerImageLoader('https', cornerstoneWebImageLoader.loadImage);
                console.log('Image loaders registered successfully');
            } else
            {
                console.error('cornerstone.registerImageLoader is not available');
            }

            // Configure cornerstone web image loader for DICOM files
            console.log('Configuring cornerstone web image loader...');
            if (cornerstoneWebImageLoader.configure)
            {
                cornerstoneWebImageLoader.configure({
                    beforeSend: function (xhr)
                    {
                        console.log('Setting up XHR for DICOM request...');
                        xhr.setRequestHeader('Accept', 'application/dicom');
                    },
                    // Set up CORS handling
                    useWebWorkers: false
                });
                console.log('Web image loader configured successfully');
            } else
            {
                console.error('cornerstoneWebImageLoader.configure is not available');
            }

            // Get DICOM viewer element
            this.dicomElement = document.querySelector('.dicom-viewer');
            if (!this.dicomElement)
            {
                console.warn('DICOM viewer element not found');
                return;
            }
            console.log('DICOM viewer element found:', this.dicomElement);

            // Enable cornerstone on the element
            console.log('Enabling cornerstone on element...');
            cornerstone.enable(this.dicomElement);
            console.log('Cornerstone enabled successfully');

            console.log('DICOM viewer initialized successfully');

            // Auto-load the default DICOM image
            setTimeout(() =>
            {
                console.log('Auto-loading default DICOM image: 65244080');
                this.loadDicomSeries('65244080');
            }, 1000);

        } catch (error)
        {
            console.error('Failed to initialize DICOM viewer:', error);
            console.error('Initialization error stack:', error.stack);
        }
    }

    setupDicomControls()
    {
        const prevBtn = document.getElementById('prev-dicom-btn');
        const nextBtn = document.getElementById('next-dicom-btn');
        const resetBtn = document.getElementById('reset-dicom-btn');

        if (prevBtn)
        {
            prevBtn.addEventListener('click', () => this.previousDicomImage());
        }
        if (nextBtn)
        {
            nextBtn.addEventListener('click', () => this.nextDicomImage());
        }
        if (resetBtn)
        {
            resetBtn.addEventListener('click', () => this.resetDicomView());
        }

        // Add mouse wheel support for scrolling through series
        if (this.dicomElement)
        {
            this.dicomElement.addEventListener('wheel', (e) =>
            {
                e.preventDefault();
                if (e.deltaY > 0)
                {
                    this.nextDicomImage();
                } else
                {
                    this.previousDicomImage();
                }
            });
        }
    }

    async loadDicomSeries(seriesId = '17155540')
    {
        if (!this.dicomElement)
        {
            console.error('DICOM viewer not initialized');
            return;
        }

        try
        {
            console.log(`Loading DICOM series: ${seriesId}`);

            // Get list of DICOM files from server
            const response = await fetch(`http://localhost:8000/dicom/series/${seriesId}`);
            if (!response.ok)
            {
                throw new Error(`Failed to load DICOM series: ${response.statusText}`);
            }

            const data = await response.json();
            this.dicomSeries = data.files || [];

            if (this.dicomSeries.length === 0)
            {
                throw new Error('No DICOM files found in series');
            }

            // Load first image
            this.currentImageIndex = 0;
            console.log('About to display first DICOM image (index 0)');
            await this.displayDicomImage(0);

            // Update info
            this.updateDicomInfo();

            console.log(`Loaded DICOM series with ${this.dicomSeries.length} images`);

        } catch (error)
        {
            console.error('Error loading DICOM series:', error);
            this.updateDicomInfo('Error loading DICOM series');
        }
    }

    async displayDicomImage(index)
    {
        if (!this.dicomSeries || index < 0 || index >= this.dicomSeries.length)
        {
            return;
        }

        try
        {
            const filename = this.dicomSeries[index];

            // Try different image ID formats
            let imageId = `wadouri:http://localhost:8000/dicom/file/${filename}`;

            console.log(`Loading DICOM image: ${filename} with imageId: ${imageId}`);

            // First check if the file is accessible
            const response = await fetch(`http://localhost:8000/dicom/file/${filename}`);
            if (!response.ok)
            {
                throw new Error(`Failed to fetch DICOM file: ${response.status} ${response.statusText}`);
            }

            console.log('DICOM file is accessible, attempting to load with cornerstone...');

            // Try different imageId formats
            const imageIds = [
                `wadouri:http://localhost:8000/dicom/file/${filename}`,
                `http://localhost:8000/dicom/file/${filename}`,
                `https://localhost:8000/dicom/file/${filename}`
            ];

            let loadedImage = null;
            let lastError = null;

            for (let i = 0; i < imageIds.length; i++)
            {
                try
                {
                    console.log(`Attempt ${i + 1}: Trying imageId:`, imageIds[i]);

                    // Add timeout to cornerstone.loadImage
                    const loadPromise = cornerstone.loadImage(imageIds[i]);
                    const timeoutPromise = new Promise((_, reject) =>
                    {
                        setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000);
                    });

                    loadedImage = await Promise.race([loadPromise, timeoutPromise]);
                    console.log('Successfully loaded image with imageId:', imageIds[i]);
                    break;
                } catch (error)
                {
                    console.warn(`Failed to load with imageId ${imageIds[i]}:`, error.message);
                    lastError = error;

                    // If this is a timeout or loading error, try a direct approach
                    if (error.message.includes('Timeout') || error.message.includes('network'))
                    {
                        console.log(`Attempting direct canvas approach for ${imageIds[i]}`);
                        try
                        {
                            await this.loadDicomAsCanvas(filename);
                            return; // Success with canvas approach
                        } catch (canvasError)
                        {
                            console.warn('Canvas approach also failed:', canvasError.message);
                        }
                    }
                }
            }

            if (!loadedImage)
            {
                throw lastError || new Error('Failed to load image with any imageId format');
            }

            console.log('cornerstone.loadImage completed successfully, image:', loadedImage);

            console.log('About to call cornerstone.displayImage...');
            cornerstone.displayImage(this.dicomElement, loadedImage);
            console.log('cornerstone.displayImage completed successfully');

            this.currentImageIndex = index;
            this.updateDicomInfo();

            console.log(`Successfully loaded DICOM image: ${filename}`);

        } catch (error)
        {
            console.error('Error displaying DICOM image:', error);
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);

            // Try fallback method - first try canvas approach, then placeholder
            try
            {
                console.log('Trying canvas approach as fallback for:', this.dicomSeries[index]);
                await this.loadDicomAsCanvas(this.dicomSeries[index]);
                this.currentImageIndex = index;
                console.log('Canvas fallback successful');
                return; // Success with canvas
            } catch (canvasError)
            {
                console.log('Canvas fallback failed, showing placeholder');
                try
                {
                    console.log('Attempting to display placeholder for:', this.dicomSeries[index]);
                    this.displayDicomPlaceholder(this.dicomSeries[index]);
                    this.currentImageIndex = index;
                    this.updateDicomInfo(`Error: ${error.message}`);
                    console.log('Placeholder displayed successfully');
                } catch (fallbackError)
                {
                    console.error('Fallback also failed:', fallbackError);
                    this.updateDicomInfo('Error loading image');
                }
            }
        }
    }

    async loadDicomAsCanvas(filename)
    {
        console.log('Attempting to parse and display DICOM image:', filename);

        try
        {
            // Fetch the DICOM file directly
            const response = await fetch(`http://localhost:8000/dicom/file/${filename}`);
            if (!response.ok)
            {
                throw new Error(`Failed to fetch DICOM file: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            console.log('DICOM file loaded, size:', arrayBuffer.byteLength);

            // Parse DICOM data using dicom-parser
            const byteArray = new Uint8Array(arrayBuffer);
            const dataSet = dicomParser.parseDicom(byteArray);

            console.log('DICOM parsed successfully');

            // Extract image information
            const rows = dataSet.uint16('x00280010'); // Rows
            const cols = dataSet.uint16('x00280011'); // Columns
            const bitsAllocated = dataSet.uint16('x00280100') || 16; // Bits Allocated
            const bitsStored = dataSet.uint16('x00280101') || 16; // Bits Stored
            const pixelRepresentation = dataSet.uint16('x00280103') || 0; // Pixel Representation
            const windowCenter = dataSet.floatString('x00281050') || dataSet.intString('x00281050') || 128; // Window Center
            const windowWidth = dataSet.floatString('x00281051') || dataSet.intString('x00281051') || 256; // Window Width

            console.log(`Image dimensions: ${cols}x${rows}`);
            console.log(`Bits: ${bitsAllocated}/${bitsStored}, Pixel representation: ${pixelRepresentation}`);
            console.log(`Window: Center=${windowCenter}, Width=${windowWidth}`);

            // Get pixel data
            const pixelDataElement = dataSet.elements.x7fe00010;
            if (!pixelDataElement)
            {
                throw new Error('No pixel data found in DICOM file');
            }

            // Extract pixel data
            let pixelData;
            if (bitsAllocated === 16)
            {
                if (pixelRepresentation === 0)
                {
                    pixelData = new Uint16Array(byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length / 2);
                } else
                {
                    pixelData = new Int16Array(byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length / 2);
                }
            } else
            {
                pixelData = new Uint8Array(byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length);
            }

            console.log(`Pixel data extracted: ${pixelData.length} pixels`);

            // Create canvas for display
            const canvas = document.createElement('canvas');
            canvas.width = cols;
            canvas.height = rows;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.imageRendering = 'pixelated'; // Keep sharp edges for medical images

            const ctx = canvas.getContext('2d');
            const imageData = ctx.createImageData(cols, rows);

            // Apply windowing and convert to 8-bit grayscale
            const minValue = Number(windowCenter) - Number(windowWidth) / 2;
            const maxValue = Number(windowCenter) + Number(windowWidth) / 2;
            const range = maxValue - minValue;

            console.log(`Windowing: ${minValue} to ${maxValue} (range: ${range})`);

            for (let i = 0; i < pixelData.length; i++)
            {
                let pixelValue = pixelData[i];

                // Apply windowing
                if (pixelValue <= minValue)
                {
                    pixelValue = 0;
                } else if (pixelValue >= maxValue)
                {
                    pixelValue = 255;
                } else
                {
                    pixelValue = Math.round(((pixelValue - minValue) / range) * 255);
                }

                // Set RGB values (grayscale)
                const idx = i * 4;
                imageData.data[idx] = pixelValue;     // Red
                imageData.data[idx + 1] = pixelValue; // Green
                imageData.data[idx + 2] = pixelValue; // Blue
                imageData.data[idx + 3] = 255;       // Alpha
            }

            // Draw the image data to canvas
            ctx.putImageData(imageData, 0, 0);

            // Clear the DICOM viewer and add the canvas
            this.dicomElement.innerHTML = '';
            this.dicomElement.appendChild(canvas);

            this.updateDicomInfo(`${filename} - ${cols}x${rows} - W:${windowWidth} L:${windowCenter}`);
            console.log('DICOM image rendered successfully');

        } catch (error)
        {
            console.error('DICOM parsing failed:', error);

            // Fallback to showing error info
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, 512, 512);

            ctx.fillStyle = '#ff4444';
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('DICOM Parsing Failed', 256, 200);
            ctx.fillText(`File: ${filename}`, 256, 230);
            ctx.fillText('Could not extract image data', 256, 260);
            ctx.fillText(error.message.substring(0, 40), 256, 290);

            this.dicomElement.innerHTML = '';
            this.dicomElement.appendChild(canvas);

            throw error;
        }
    }

    displayDicomPlaceholder(filename)
    {
        console.log('Creating DICOM placeholder for:', filename);

        // Create a simple placeholder canvas
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        const ctx = canvas.getContext('2d');

        // Fill with dark background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 512, 512);

        // Add placeholder text
        ctx.fillStyle = '#00ff00';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DICOM Image Placeholder', 256, 200);
        ctx.fillText(`File: ${filename}`, 256, 230);
        ctx.fillText('Cornerstone loader failed', 256, 260);
        ctx.fillText('Check console for details', 256, 290);
        ctx.fillText('Click Load to retry', 256, 320);

        // Draw a simple crosshair
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(256, 0);
        ctx.lineTo(256, 512);
        ctx.moveTo(0, 256);
        ctx.lineTo(512, 256);
        ctx.stroke();

        // Clear the DICOM viewer and add the placeholder
        console.log('Clearing DICOM element and adding placeholder canvas');
        this.dicomElement.innerHTML = '';
        this.dicomElement.appendChild(canvas);

        console.log('Placeholder canvas added to DICOM element');
    }

    previousDicomImage()
    {
        if (this.currentImageIndex > 0)
        {
            this.displayDicomImage(this.currentImageIndex - 1);
        }
    }

    nextDicomImage()
    {
        if (this.currentImageIndex < this.dicomSeries.length - 1)
        {
            this.displayDicomImage(this.currentImageIndex + 1);
        }
    }

    resetDicomView()
    {
        if (this.dicomElement && cornerstone.getEnabledElement(this.dicomElement))
        {
            cornerstone.reset(this.dicomElement);
            this.updateDicomInfo('DICOM view reset');
        }
    }

    updateDicomInfo(message = null)
    {
        const dicomInfo = document.querySelector('.dicom-info');
        if (!dicomInfo) return;

        if (message)
        {
            dicomInfo.textContent = message;
            return;
        }

        if (this.dicomSeries.length > 0)
        {
            const current = this.currentImageIndex + 1;
            const total = this.dicomSeries.length;
            const filename = this.dicomSeries[this.currentImageIndex];

            dicomInfo.innerHTML = `
                Image: ${current}/${total}<br>
                File: ${filename}<br>
                Use mouse wheel to scroll
            `;
        } else
        {
            dicomInfo.textContent = 'DICOM Viewer Ready';
        }
    }

    async loadSpecificDicomFile(filename)
    {
        if (!this.dicomElement)
        {
            console.error('DICOM viewer not initialized');
            return;
        }

        try
        {
            console.log(`Loading specific DICOM file: ${filename}`);

            // Use wadouri: prefix for DICOM files
            const imageId = `wadouri:http://localhost:8000/dicom/file/${filename}`;
            const image = await cornerstone.loadImage(imageId);
            cornerstone.displayImage(this.dicomElement, image);

            this.updateDicomInfo(`Loaded: ${filename}`);
            return true;

        } catch (error)
        {
            console.error('Error loading DICOM file:', error);
            this.updateDicomInfo(`Error: ${filename}`);
            return false;
        }
    }

    // File Browser Methods
    async refreshDicomSeriesList()
    {
        try
        {
            const response = await fetch('http://localhost:8000/dicom');
            if (response.ok)
            {
                const data = await response.json();
                this.populateDicomSeriesSelect(data.series);
            } else
            {
                console.warn('Failed to fetch DICOM series list');
            }
        } catch (error)
        {
            console.error('Error fetching DICOM series:', error);
        }
    }

    populateDicomSeriesSelect(series)
    {
        if (!this.dicomSeriesSelect) return;

        // Clear existing options except the first one
        this.dicomSeriesSelect.innerHTML = '<option value="">Select DICOM series...</option>';

        series.forEach(seriesId =>
        {
            const option = document.createElement('option');
            option.value = seriesId;
            option.textContent = `Series ${seriesId}`;
            this.dicomSeriesSelect.appendChild(option);
        });

        console.log(`Loaded ${series.length} DICOM series`);
    }

    async loadSelectedDicomSeries()
    {
        const selectedSeries = this.dicomSeriesSelect?.value;
        if (!selectedSeries)
        {
            if (this.onAlert)
            {
                this.onAlert('Please select a DICOM series first', 'warning');
            }
            return;
        }

        await this.loadDicomSeries(selectedSeries);
        if (this.onAlert)
        {
            this.onAlert(`Loading DICOM series: ${selectedSeries}`, 'info');
        }
    }

    // Public methods for external control
    getCurrentImageIndex()
    {
        return this.currentImageIndex;
    }

    getSeriesLength()
    {
        return this.dicomSeries.length;
    }

    getCurrentFilename()
    {
        if (this.dicomSeries.length > 0 && this.currentImageIndex >= 0)
        {
            return this.dicomSeries[this.currentImageIndex];
        }
        return null;
    }
} 