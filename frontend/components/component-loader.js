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
            console.log(`Component loaded: ${componentName}`);
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
        const components = [
            { name: 'header', target: 'body', append: 'prepend' },
            { name: 'patient-panel', target: '.main-container', append: true },
            { name: 'voice-interface', target: '.main-container', append: true },
            { name: 'monitoring-panel', target: '.main-container', append: true },
            { name: 'vtk-viewer', target: '.main-container', append: true },
            { name: 'dicom-viewer', target: '.main-container', append: true }
        ];

        console.log('Loading application components...');
        const success = await this.loadComponents(components);

        if (success)
        {
            console.log('All components loaded successfully');
            // Dispatch a custom event to signal that components are ready
            document.dispatchEvent(new CustomEvent('componentsLoaded'));
        } else
        {
            console.error('Some components failed to load');
        }

        return success;
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
window.ComponentLoader = ComponentLoader; 