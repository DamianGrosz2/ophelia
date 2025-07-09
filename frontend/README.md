# Ophelia Voice Assistant - Frontend

## Project Structure

The frontend has been refactored into a modular, component-based architecture for better maintainability and clean code.

### File Structure

```
frontend/
├── index.html              # Main HTML file (simplified)
├── styles.css              # Centralized CSS file
├── main.js                 # Main application logic
├── components/             # Reusable HTML components
│   ├── component-loader.js # Component loading utility
│   ├── header.html         # Application header
│   ├── patient-panel.html  # Patient information panel
│   ├── voice-interface.html # Voice command center
│   ├── monitoring-panel.html # Procedural monitoring
│   ├── vtk-viewer.html     # 3D visualization viewer
│   └── dicom-viewer.html   # DICOM image viewer
└── README.md               # This file
```

## Key Improvements

### 1. **Separation of Concerns**
- **HTML**: Clean structure in `index.html` with components in separate files
- **CSS**: All styles moved to dedicated `styles.css` file
- **JavaScript**: Modular component loading system

### 2. **Maintainable CSS**
- Organized into logical sections (Base, Layout, Components, etc.)
- Clear naming conventions
- Reduced duplication
- Better comments and structure

### 3. **Component-Based Architecture**
- Each major UI section is a separate component
- Dynamic component loading
- Reusable and modular design
- Easy to add/remove/modify components

### 4. **Clean HTML**
- Reduced from 1000+ lines to ~50 lines
- No inline styles
- Clear structure and organization

## Component System

### Component Loader
The `ComponentLoader` class handles dynamic loading of HTML components:

```javascript
const componentLoader = new ComponentLoader();
await componentLoader.initializeApp();
```

### Adding New Components
1. Create a new `.html` file in `/components/`
2. Add component to the loader configuration
3. Style the component in `styles.css`

### Component Types
- **Header**: Application navigation and procedure selector
- **Patient Panel**: Patient information and medical data
- **Voice Interface**: Voice commands and chat interface
- **Monitoring Panel**: Real-time data and charts
- **VTK Viewer**: 3D medical visualization
- **DICOM Viewer**: Medical image viewing

## CSS Organization

The CSS is organized into clear sections:

```css
/* ===== BASE STYLES ===== */
/* Core styling and resets */

/* ===== HEADER STYLES ===== */
/* Application header and navigation */

/* ===== LAYOUT STYLES ===== */
/* Grid layout and main structure */

/* ===== PANEL STYLES ===== */
/* Common panel styling */

/* ===== COMPONENT-SPECIFIC STYLES ===== */
/* Styles for each component */

/* ===== UTILITY CLASSES ===== */
/* Helper classes */

/* ===== RESPONSIVE DESIGN ===== */
/* Media queries */
```

## Development Workflow

### Making Changes
1. **CSS Changes**: Edit `styles.css`
2. **HTML Structure**: Edit component files in `/components/`
3. **Functionality**: Edit `main.js` or component-specific scripts

### Adding Features
1. Create new component file if needed
2. Add styles to appropriate CSS section
3. Update component loader if necessary
4. Test component loading and styling

### Benefits of This Structure

1. **Maintainability**: Each component is isolated and easy to modify
2. **Scalability**: Easy to add new panels or features
3. **Performance**: Components load dynamically as needed
4. **Debugging**: Clear separation makes issues easier to locate
5. **Collaboration**: Multiple developers can work on different components
6. **Reusability**: Components can be reused in other projects

## Browser Compatibility

- Modern browsers with ES6+ support
- Fetch API support required for component loading
- CSS Grid support for layout

## Development Notes

- Components are loaded asynchronously
- Main application initializes after all components are loaded
- Event system ensures proper initialization order
- Error handling for failed component loads 