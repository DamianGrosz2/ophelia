/**
 * Image Viewer - Medical Image Display Component
 * 
 * Provides functionality for displaying and navigating through PNG images
 * with zoom capabilities and navigation controls.
 */

// API base URL provided by main.js or env
const API_BASE_URL = window.API_BASE_URL || (import.meta.env?.VITE_API_URL || 'http://localhost:8000');

export class ImageViewer {
    constructor(container, alertCallback = null) {
        this.container = container;
        this.alertCallback = alertCallback;
        
        // Image state
        this.currentImages = [];
        this.currentImageIndex = 0;
        this.currentZoom = 1.0;
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;
        this.scrollLeft = 0;
        this.scrollTop = 0;
        
        // DOM elements
        this.imageSelect = null;
        this.mainImage = null;
        this.imagePlaceholder = null;
        this.imageDisplayArea = null;
        this.imageCounter = null;
        this.zoomLevel = null;
        this.imageFilename = null;
        this.imageScaleInfo = null;
        
        // Initialize the viewer
        this.initialize();
    }
    
    /**
     * Initialize the image viewer
     */
    async initialize() {
        try {
            console.log('Initializing Image Viewer...');
            
            // Set up DOM elements
            this.setupDOMElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load available images
            await this.refreshImageList();
            
            console.log('Image Viewer initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Image Viewer:', error);
            this.showAlert('Failed to initialize Image Viewer', 'error');
        }
    }
    
    /**
     * Set up DOM element references
     */
    setupDOMElements() {
        // Control elements
        this.imageSelect = this.container.querySelector('#image-file-select');
        this.headerPrevBtn = this.container.querySelector('#header-prev-btn');
        this.headerNextBtn = this.container.querySelector('#header-next-btn');
        
        // Display elements
        this.mainImage = this.container.querySelector('#main-image');
        this.imagePlaceholder = this.container.querySelector('#image-placeholder');
        this.imageDisplayArea = this.container.querySelector('#image-display-area');
        
        // Navigation elements
        this.imageCounter = this.container.querySelector('#image-counter');
        
        // Zoom elements
        this.zoomInBtn = this.container.querySelector('#zoom-in-btn');
        this.zoomOutBtn = this.container.querySelector('#zoom-out-btn');
        this.zoomLevel = this.container.querySelector('#zoom-level');
        
        // Info elements
        this.imageFilename = this.container.querySelector('#image-filename');
        this.imageScaleInfo = this.container.querySelector('#image-scale-info');
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Header navigation buttons
        this.headerPrevBtn?.addEventListener('click', () => this.previousImage());
        this.headerNextBtn?.addEventListener('click', () => this.nextImage());
        
        // Zoom buttons
        this.zoomInBtn?.addEventListener('click', () => this.zoomIn());
        this.zoomOutBtn?.addEventListener('click', () => this.zoomOut());
        
        // Image select dropdown
        this.imageSelect?.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadImage(e.target.value);
            }
        });
        
        // Mouse events for panning
        this.imageDisplayArea?.addEventListener('mousedown', (e) => this.startPan(e));
        this.imageDisplayArea?.addEventListener('mousemove', (e) => this.handlePan(e));
        this.imageDisplayArea?.addEventListener('mouseup', () => this.stopPan());
        this.imageDisplayArea?.addEventListener('mouseleave', () => this.stopPan());
        
        // Mouse events for zoom-to-location
        this.imageDisplayArea?.addEventListener('dblclick', (e) => this.zoomToLocation(e));
        
        // Wheel event for zoom at mouse position
        this.imageDisplayArea?.addEventListener('wheel', (e) => this.handleWheelZoom(e));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }
    
    /**
     * Load available images from backend
     */
    async refreshImageList() {
        try {
            console.log('Refreshing image list...');
            
            const response = await fetch(`${API_BASE_URL}/images`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.currentImages = data.files || [];
            
            // Update dropdown
            this.updateImageSelect();
            
            // Update navigation
            this.updateNavigation();
            
            // Auto-load first image if available
            if (this.currentImages.length > 0) {
                this.loadImage(this.currentImages[0]);
            }
            
            console.log(`Loaded ${this.currentImages.length} images`);
            
        } catch (error) {
            console.error('Failed to refresh image list:', error);
            this.showAlert('Failed to load image list', 'error');
            this.currentImages = [];
            this.updateImageSelect();
        }
    }
    
    /**
     * Update image selection dropdown
     */
    updateImageSelect() {
        if (!this.imageSelect) return;
        
        // Clear existing options
        this.imageSelect.innerHTML = '<option value="">Select Image...</option>';
        
        // Add image options
        this.currentImages.forEach(filename => {
            const option = document.createElement('option');
            option.value = filename;
            option.textContent = filename;
            this.imageSelect.appendChild(option);
        });
    }
    
    
    /**
     * Load specific image by filename
     */
    async loadImage(filename) {
        try {
            console.log(`Loading image: ${filename}`);
            
            // Find image index
            const imageIndex = this.currentImages.indexOf(filename);
            if (imageIndex === -1) {
                throw new Error('Image not found in list');
            }
            
            // Update current index
            this.currentImageIndex = imageIndex;
            
            // Build image URL
            const imageUrl = `${API_BASE_URL}/images/${filename}`;
            
            // Load image
            this.mainImage.src = imageUrl;
            this.mainImage.alt = filename;
            
            // Show image, hide placeholder
            this.showImage();
            
            // Reset zoom
            this.resetZoom();
            
            // Update UI
            this.updateNavigation();
            this.updateImageInfo(filename);
            
            // Update dropdown selection
            if (this.imageSelect) {
                this.imageSelect.value = filename;
            }
            
            console.log(`Successfully loaded image: ${filename}`);
            
        } catch (error) {
            console.error(`Failed to load image ${filename}:`, error);
            this.showAlert(`Failed to load image: ${filename}`, 'error');
        }
    }
    
    /**
     * Show image and hide placeholder
     */
    showImage() {
        this.mainImage.style.display = 'block';
        this.imagePlaceholder.style.display = 'none';
    }
    
    /**
     * Hide image and show placeholder
     */
    hideImage() {
        this.mainImage.style.display = 'none';
        this.imagePlaceholder.style.display = 'flex';
    }
    
    /**
     * Navigate to previous image
     */
    previousImage() {
        if (this.currentImages.length === 0) return;
        
        this.currentImageIndex = (this.currentImageIndex - 1 + this.currentImages.length) % this.currentImages.length;
        this.loadImage(this.currentImages[this.currentImageIndex]);
    }
    
    /**
     * Navigate to next image
     */
    nextImage() {
        if (this.currentImages.length === 0) return;
        
        this.currentImageIndex = (this.currentImageIndex + 1) % this.currentImages.length;
        this.loadImage(this.currentImages[this.currentImageIndex]);
    }
    
    /**
     * Load specific image by index
     */
    loadImageByIndex(index) {
        if (index >= 0 && index < this.currentImages.length) {
            this.currentImageIndex = index;
            this.loadImage(this.currentImages[index]);
        }
    }
    
    /**
     * Zoom in
     */
    zoomIn() {
        this.currentZoom = Math.min(this.currentZoom * 1.2, 5.0);
        this.applyZoom();
    }
    
    /**
     * Zoom out
     */
    zoomOut() {
        this.currentZoom = Math.max(this.currentZoom / 1.2, 0.1);
        this.applyZoom();
    }
    
    /**
     * Reset zoom to 100%
     */
    resetZoom() {
        this.currentZoom = 1.0;
        this.applyZoom();
    }
    
    /**
     * Apply current zoom level with transform origin
     */
    applyZoom(originX = '50%', originY = '50%') {
        this.mainImage.style.transformOrigin = `${originX} ${originY}`;
        this.mainImage.style.transform = `scale(${this.currentZoom})`;
        this.updateZoomDisplay();
    }
    
    /**
     * Zoom to a specific location on the image
     */
    zoomToLocation(e) {
        e.preventDefault();
        
        if (!this.mainImage || this.mainImage.style.display === 'none') return;
        
        const rect = this.imageDisplayArea.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Convert to percentage relative to the display area
        const originX = (x / rect.width) * 100;
        const originY = (y / rect.height) * 100;
        
        // Zoom in at the clicked location
        this.currentZoom = Math.min(this.currentZoom * 1.5, 5.0);
        this.applyZoom(`${originX}%`, `${originY}%`);
    }
    
    /**
     * Update zoom level display
     */
    updateZoomDisplay() {
        const zoomPercent = Math.round(this.currentZoom * 100);
        
        if (this.zoomLevel) {
            this.zoomLevel.textContent = `${zoomPercent}%`;
        }
        
        if (this.imageScaleInfo) {
            this.imageScaleInfo.textContent = `Scale: ${zoomPercent}%`;
            this.imageScaleInfo.style.display = 'block';
        }
    }
    
    /**
     * Update navigation controls
     */
    updateNavigation() {
        // Update counter
        if (this.imageCounter) {
            const current = this.currentImages.length > 0 ? this.currentImageIndex + 1 : 0;
            const total = this.currentImages.length;
            this.imageCounter.textContent = `${current} / ${total}`;
        }
        
        // Update button states
        const hasImages = this.currentImages.length > 0;
        const hasPrev = hasImages && this.currentImageIndex > 0;
        const hasNext = hasImages && this.currentImageIndex < this.currentImages.length - 1;
        
        // Update header navigation buttons
        if (this.headerPrevBtn) {
            this.headerPrevBtn.disabled = !hasPrev;
        }
        
        if (this.headerNextBtn) {
            this.headerNextBtn.disabled = !hasNext;
        }
    }
    
    /**
     * Update image info display
     */
    updateImageInfo(filename) {
        if (this.imageFilename) {
            this.imageFilename.textContent = filename;
        }
    }
    
    /**
     * Handle wheel events for zoom at mouse position
     */
    handleWheelZoom(e) {
        e.preventDefault();
        
        if (!this.mainImage || this.mainImage.style.display === 'none') return;
        
        const rect = this.imageDisplayArea.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Convert to percentage relative to the display area
        const originX = (x / rect.width) * 100;
        const originY = (y / rect.height) * 100;
        
        // Zoom in or out at mouse position
        if (e.deltaY < 0) {
            this.currentZoom = Math.min(this.currentZoom * 1.1, 5.0);
        } else {
            this.currentZoom = Math.max(this.currentZoom / 1.1, 0.1);
        }
        
        this.applyZoom(`${originX}%`, `${originY}%`);
    }
    
    /**
     * Start pan operation
     */
    startPan(e) {
        if (e.button !== 0) return; // Only left mouse button
        
        this.isPanning = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.scrollLeft = this.imageDisplayArea.scrollLeft;
        this.scrollTop = this.imageDisplayArea.scrollTop;
        
        this.imageDisplayArea.style.cursor = 'grabbing';
        e.preventDefault();
    }
    
    /**
     * Handle pan operation
     */
    handlePan(e) {
        if (!this.isPanning) return;
        
        e.preventDefault();
        
        const deltaX = e.clientX - this.startX;
        const deltaY = e.clientY - this.startY;
        
        this.imageDisplayArea.scrollLeft = this.scrollLeft - deltaX;
        this.imageDisplayArea.scrollTop = this.scrollTop - deltaY;
    }
    
    /**
     * Stop pan operation
     */
    stopPan() {
        this.isPanning = false;
        this.imageDisplayArea.style.cursor = 'grab';
    }
    
    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(e) {
        // Only handle if the image viewer is active
        if (!this.container.closest('.panel:not([style*="display: none"])')) {
            return;
        }
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.previousImage();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextImage();
                break;
            case '=':
            case '+':
                e.preventDefault();
                this.zoomIn();
                break;
            case '-':
                e.preventDefault();
                this.zoomOut();
                break;
            case '0':
                e.preventDefault();
                this.resetZoom();
                break;
        }
    }
    
    /**
     * Get available images
     */
    getAvailableImages() {
        return this.currentImages;
    }
    
    /**
     * Get current image info
     */
    getCurrentImageInfo() {
        return {
            filename: this.currentImages[this.currentImageIndex] || null,
            index: this.currentImageIndex,
            total: this.currentImages.length,
            zoom: this.currentZoom
        };
    }
    
    /**
     * Show alert message
     */
    showAlert(message, level = 'info') {
        console.log(`ImageViewer Alert [${level}]: ${message}`);
        
        if (this.alertCallback) {
            this.alertCallback(message, level);
        }
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyboard);
        
        // Reset panning state
        this.isPanning = false;
        
        // Clear references
        this.container = null;
        this.currentImages = [];
        this.currentImageIndex = 0;
    }
}