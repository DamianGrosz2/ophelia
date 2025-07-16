/**
 * Component Loader Utility
 * Dynamically loads HTML components into the main page
 */

class ComponentLoader
{
    constructor()
    {
        this.loadedComponents = new Set();
    }

    /**
     * Load an HTML component from the components directory
     * @param {string} componentName - Name of the component file (without .html)
     * @param {string} targetSelector - CSS selector for the target container
     * @param {string|boolean} append - How to insert: true = append, false = replace, 'prepend' = prepend
     */
    async loadComponent(componentName, targetSelector, append = false)
    {
        try
        {
            const response = await fetch(`/components/${componentName}.html`);
            if (!response.ok)
            {
                throw new Error(`Failed to load component: ${componentName}`);
            }

            const html = await response.text();
            const targetElement = document.querySelector(targetSelector);

            if (!targetElement)
            {
                console.error(`Target element not found: ${targetSelector}`);
                return false;
            }

            if (append === 'prepend')
            {
                targetElement.insertAdjacentHTML('afterbegin', html);
            } else if (append)
            {
                targetElement.insertAdjacentHTML('beforeend', html);
            } else
            {
                targetElement.innerHTML = html;
            }

            this.loadedComponents.add(componentName);
            // console.log(`Component loaded: ${componentName}`);
            return true;
        } catch (error)
        {
            console.error(`Error loading component ${componentName}:`, error);
            return false;
        }
    }

    /**
     * Load multiple components
     * @param {Array} components - Array of {name, target, append} objects
     */
    async loadComponents(components)
    {
        const promises = components.map(comp =>
            this.loadComponent(comp.name, comp.target, comp.append)
        );

        const results = await Promise.all(promises);
        return results.every(result => result === true);
    }

    /**
     * Initialize all application components
     */
    async initializeApp()
    {
        // Load structural components first
        const structuralComponents = [
            { name: 'header', target: 'body', append: 'prepend' },
            { name: 'command-reference', target: 'body', append: true },
            { name: 'surgical-grid', target: '.main-container', append: false }
        ];

        console.log('Loading structural components...');
        const structuralSuccess = await this.loadComponents(structuralComponents);

        if (!structuralSuccess)
        {
            console.error('Failed to load structural components');
            return false;
        }

        // Load content components that will be available for the grid
        const contentComponents = [
            { name: 'patient-panel', target: 'body', append: true },
            { name: 'voice-interface', target: 'body', append: true },
            { name: 'monitoring-panel', target: 'body', append: true },
            { name: 'vtk-viewer', target: 'body', append: true },
            { name: 'image-viewer', target: 'body', append: true },
            { name: 'dicom-viewer', target: 'body', append: true }
        ];

        console.log('Loading content components...');
        const contentSuccess = await this.loadComponents(contentComponents);

        // Immediately remap component IDs for surgical grid compatibility
        this.remapComponentIds();

        // Don't hide components immediately - wait for chat interface to initialize
        console.log('Components loaded, waiting for initialization before hiding...');

        const success = structuralSuccess && contentSuccess;

        if (success)
        {
            console.log('All components loaded successfully');
            // Dispatch a custom event to signal that components are ready
            document.dispatchEvent(new CustomEvent('componentsLoaded'));

            // Hide components after a delay to allow initialization
            this.delayedHideComponents();
        } else
        {
            console.error('Some components failed to load');
        }

        return success;
    }

    /**
 * Remap component IDs for surgical grid compatibility
 */
    remapComponentIds()
    {
        const idMappings = {
            'panel-1': 'patient-panel',
            'panel-2': 'voice-interface',
            'panel-3': 'monitoring-panel',
            'panel-4': 'vtk-viewer',
            'panel-5': 'dicom-viewer',
            'panel-6': 'image-viewer'
        };

        Object.entries(idMappings).forEach(([oldId, newId]) =>
        {
            const element = document.getElementById(oldId);
            if (element)
            {
                element.id = newId;
                // console.log(`Remapped ${oldId} to ${newId} for surgical grid`);
            } else
            {
                console.warn(`Component ${oldId} not found for remapping to ${newId}`);
            }
        });
    }

    /**
     * Hide content components that are used as templates for the grid
     */
    hideContentComponents()
    {
        const componentIds = [
            'patient-panel',
            'voice-interface', // Include this back in the list to hide
            'monitoring-panel',
            'vtk-viewer',
            'dicom-viewer'
        ];

        componentIds.forEach(componentId =>
        {
            const element = document.getElementById(componentId);
            if (element)
            {
                // Hide the component
                element.style.display = 'none';
                element.style.position = 'absolute';
                element.style.top = '-9999px';
                element.style.left = '-9999px';
                element.style.visibility = 'hidden';

                console.log(`Hidden component: ${componentId}`);
            } else
            {
                console.warn(`Component ${componentId} not found for hiding`);
            }
        });
    }

    /**
     * Delay hiding components to allow initialization
     */
    async delayedHideComponents()
    {
        // Wait for chat interface and other components to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('Now hiding content components after initialization delay...');
        this.hideContentComponents();
    }

    /**
     * Check if a component is loaded
     */
    isComponentLoaded(componentName)
    {
        return this.loadedComponents.has(componentName);
    }

    /**
     * Get list of loaded components
     */
    getLoadedComponents()
    {
        return Array.from(this.loadedComponents);
    }
}

// Export for use in other modules
export default ComponentLoader; 