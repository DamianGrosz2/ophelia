/**
 * Surgical Grid Manager
 * 
 * Implements the static 2x4 surgical grid system with voice commands,
 * visual feedback, and layout presets for OR environments.
 */

import { VtkViewer } from '../vtk-viewer.js';
import { DicomViewer } from '../dicom-viewer.js';
import { ImageViewer } from '../image-viewer.js';

export class SurgicalGridManager
{
    constructor(alertManager)
    {
        this.alertManager = alertManager;
        this.gridPositions = [
            'A-Top', 'B-Top', 'C-Top', 'D-Top',
            'A-Bottom', 'B-Bottom', 'C-Bottom', 'D-Bottom'
        ];

        // Track cell contents and state
        this.cellContents = new Map();
        this.cellStates = new Map();
        this.highlightTimeout = null;

        // Reorder functionality
        this.currentReorderSource = null;
        this.selectedReorderCells = new Set();

        // Reopen functionality
        this.closedPrograms = [];
        this.selectedClosedProgram = null;
        this.selectedReopenCells = new Set();

        // Available programs/components
        this.availablePrograms = {
            'vitals': 'monitoring-panel',
            'patient': 'patient-panel',
            'dicom': 'dicom-viewer',
            '3d': 'vtk-viewer',
            'images': 'image-viewer',
            'voice': 'voice-interface',
        };

        // Saved layouts
        this.savedLayouts = this.loadSavedLayouts();

        // Current procedure type
        this.currentProcedure = 'pad_angioplasty';

        this.initializeGrid();
        this.setupEventListeners();
        this.updateReopenButtonState();
    }

    /**
     * Set the current procedure type and load appropriate layout
     */
    setProcedureType(procedureType)
    {
        console.log(`Setting procedure type to: ${procedureType}`);
        this.currentProcedure = procedureType;
        this.loadProcedureLayout(procedureType);
    }

    /**
     * Load procedure-specific layout
     */
    loadProcedureLayout(procedureType)
    {
        console.log(`Loading layout for procedure: ${procedureType}`);

        // Clear current layout first
        this.clearScreen();

        // Load procedure-specific layout
        switch (procedureType)
        {
            case 'pad_angioplasty':
                this.createPadAngioplastyLayout();
                break;
            case 'ep_ablation':
                this.createEpAblationLayout();
                break;
            default:
                console.warn(`Unknown procedure type: ${procedureType}, using default layout`);
                this.createDefaultLayout();
                break;
        }
    }

    /**
     * Initialize the grid system
     */
    initializeGrid()
    {
        // Initialize all cells as empty
        this.gridPositions.forEach(position =>
        {
            this.cellContents.set(position, null);
            this.cellStates.set(position, 'empty');
            this.updateCellAppearance(position);
        });

        // Force clear all layouts first to ensure clean start with spanning components
        localStorage.removeItem('surgicalGridLayouts');
        this.savedLayouts = [];

        // Don't automatically create layout here - wait for procedure type to be set
        console.log('Grid initialized, waiting for procedure type to be set');
    }

    /**
     * Wait for components to be loaded and create demo layout
     */
    waitForComponentsAndCreateDemo()
    {


        // Check if componentsLoaded event has already fired
        if (window.componentsLoadedFlag)
        {

            setTimeout(() => this.createDemoLayout(), 500);
            return;
        }

        // Listen for the componentsLoaded event
        document.addEventListener('componentsLoaded', () =>
        {

            setTimeout(() => this.createDemoLayout(), 1000);
        }, { once: true });

        // Fallback timeout in case event doesn't fire
        setTimeout(() =>
        {

            this.createDemoLayout();
        }, 3000);
    }

    /**
     * Set up event listeners for grid interactions
     */
    setupEventListeners()
    {
        // Close button handlers
        document.querySelectorAll('.cell-close-btn').forEach(btn =>
        {
            btn.addEventListener('click', (e) =>
            {
                const position = e.target.dataset.position;
                this.closeCell(position);
            });
        });

        // Reorder button handlers
        document.querySelectorAll('.cell-reorder-btn').forEach(btn =>
        {
            btn.addEventListener('click', (e) =>
            {
                const position = e.target.dataset.position;
                this.showReorderOverlay(position);
            });
        });

        // Reorder overlay handlers
        const reorderOverlay = document.getElementById('reorder-overlay');
        const reorderCloseBtn = document.getElementById('reorder-close-btn');
        const reorderConfirmBtn = document.getElementById('reorder-confirm-btn');
        const reorderExpandBtn = document.getElementById('reorder-expand-btn');
        const reorderCancelBtn = document.getElementById('reorder-cancel-btn');

        if (reorderCloseBtn)
        {
            reorderCloseBtn.addEventListener('click', () => this.hideReorderOverlay());
        }

        if (reorderConfirmBtn)
        {
            reorderConfirmBtn.addEventListener('click', () => this.confirmReorder());
        }

        if (reorderExpandBtn)
        {
            reorderExpandBtn.addEventListener('click', () => this.confirmExpand());
        }

        if (reorderCancelBtn)
        {
            reorderCancelBtn.addEventListener('click', () => this.hideReorderOverlay());
        }

        if (reorderOverlay)
        {
            // Close overlay when clicking outside content
            reorderOverlay.addEventListener('click', (e) =>
            {
                if (e.target === reorderOverlay)
                {
                    this.hideReorderOverlay();
                }
            });

            // Handle reorder cell selection (now supports multi-select)
            document.addEventListener('click', (e) =>
            {
                if (e.target.closest('.reorder-cell'))
                {
                    const targetPosition = e.target.closest('.reorder-cell').dataset.target;
                    this.toggleReorderCellSelection(targetPosition);
                }
            });
        }

        // Keyboard event listeners
        document.addEventListener('keydown', (e) =>
        {
            // Close reorder overlay with Escape key
            if (e.key === 'Escape' && this.currentReorderSource)
            {
                this.hideReorderOverlay();
            }
            // Close reopen overlay with Escape key
            if (e.key === 'Escape' && document.getElementById('reopen-overlay')?.classList.contains('show'))
            {
                this.hideReopenOverlay();
            }
        });

        // Layout preset handlers
        const saveBtn = document.getElementById('save-layout-btn');
        const clearBtn = document.getElementById('clear-screen-btn');
        const presetsToggle = document.getElementById('presets-toggle');

        if (saveBtn)
        {
            saveBtn.addEventListener('click', () => this.showSaveLayoutDialog());
        }

        if (clearBtn)
        {
            clearBtn.addEventListener('click', () => this.clearScreen());
        }

        if (presetsToggle)
        {
            presetsToggle.addEventListener('click', () => this.togglePresetsPanel());
        }

        // Reopen button handler
        const reopenBtn = document.getElementById('reopen-btn');
        if (reopenBtn)
        {
            reopenBtn.addEventListener('click', () => this.showReopenOverlay());
        }

        // Reopen overlay handlers
        const reopenOverlay = document.getElementById('reopen-overlay');
        const reopenCloseBtn = document.getElementById('reopen-close-btn');
        const reopenConfirmBtn = document.getElementById('reopen-confirm-btn');
        const reopenCancelBtn = document.getElementById('reopen-cancel-btn');

        if (reopenCloseBtn)
        {
            reopenCloseBtn.addEventListener('click', () => this.hideReopenOverlay());
        }

        if (reopenConfirmBtn)
        {
            reopenConfirmBtn.addEventListener('click', () => this.confirmReopen());
        }

        if (reopenCancelBtn)
        {
            reopenCancelBtn.addEventListener('click', () => this.hideReopenOverlay());
        }

        if (reopenOverlay)
        {
            // Close overlay when clicking outside content
            reopenOverlay.addEventListener('click', (e) =>
            {
                if (e.target === reopenOverlay)
                {
                    this.hideReopenOverlay();
                }
            });

            // Handle closed program selection
            document.addEventListener('click', (e) =>
            {
                if (e.target.closest('.closed-program-item'))
                {
                    const programName = e.target.closest('.closed-program-item').dataset.program;
                    this.selectClosedProgram(programName);
                }
            });

            // Handle reopen cell selection
            document.addEventListener('click', (e) =>
            {
                if (e.target.closest('.reopen-cell'))
                {
                    const targetPosition = e.target.closest('.reopen-cell').dataset.target;
                    this.toggleReopenCellSelection(targetPosition);
                }
            });
        }

        // Handle preset loading
        document.addEventListener('click', (e) =>
        {
            if (e.target.classList.contains('load-preset-btn'))
            {
                const layoutName = e.target.dataset.layoutName;
                this.loadLayoutByName(layoutName);
            }
            if (e.target.classList.contains('delete-preset-btn'))
            {
                const layoutName = e.target.dataset.layoutName;
                this.deleteLayout(layoutName);
            }
        });
    }

    /**
     * Process voice commands for the surgical grid
     */
    processGridCommand(command)
    {
        const cmd = command.toLowerCase().trim();
        console.log(`🎯 processGridCommand called with: "${command}"`);
        console.log(`🎯 Normalized command: "${cmd}"`);

        try
        {
            // OPEN commands
            if (cmd.includes('open') && (cmd.includes(' in ') || cmd.includes(' on ') || cmd.includes(' across ')))
            {
                console.log(`🎯 Detected OPEN command`);
                return this.handleOpenCommand(cmd);
            }

            // MOVE commands  
            if (cmd.includes('move') && cmd.includes(' to '))
            {
                console.log(`🎯 Detected MOVE command`);
                return this.handleMoveCommand(cmd);
            }

            // EXPAND commands
            if (cmd.includes('expand') && cmd.includes(' to '))
            {
                console.log(`🎯 Detected EXPAND command`);
                return this.handleExpandCommand(cmd);
            }

            // SWAP commands
            if (cmd.includes('swap') && cmd.includes(' with '))
            {
                console.log(`🎯 Detected SWAP command`);
                return this.handleSwapCommand(cmd);
            }

            // CLOSE commands
            if (cmd.includes('close') || cmd.includes('clear'))
            {
                console.log(`🎯 Detected CLOSE command`);
                return this.handleCloseCommand(cmd);
            }

            // LAYOUT commands
            if (cmd.includes('save layout'))
            {
                console.log(`🎯 Detected SAVE LAYOUT command`);
                return this.handleSaveLayoutCommand(cmd);
            }

            if (cmd.includes('load layout'))
            {
                console.log(`🎯 Detected LOAD LAYOUT command`);
                return this.handleLoadLayoutCommand(cmd);
            }

            console.log(`🎯 No grid command pattern matched for: "${cmd}"`);
            return { success: false, message: null };
        } catch (error)
        {
            console.error('Error processing grid command:', error);
            this.showFeedback('Error processing command', 'error');
            return { success: false, message: 'Error processing grid command' };
        }
    }

    /**
     * Handle OPEN commands
     */
    handleOpenCommand(cmd)
    {
        console.log(`🎯 handleOpenCommand processing: "${cmd}"`);

        // Extract program and location(s)
        const openMatch = cmd.match(/open\s+(.+?)\s+(?:in|on|across)\s+(.+)/);
        if (!openMatch)
        {
            console.log(`🎯 Failed to match OPEN command pattern`);
            return { success: false, message: null };
        }

        const programName = openMatch[1].trim();
        const locationText = openMatch[2].trim();

        console.log(`🎯 Extracted program: "${programName}"`);
        console.log(`🎯 Extracted location: "${locationText}"`);

        const program = this.findProgram(programName);
        if (!program)
        {
            console.log(`🎯 Program not found for: "${programName}"`);
            const message = `Program "${programName}" not found`;
            this.showFeedback(message, 'error');
            return { success: false, message };
        }

        console.log(`🎯 Found program: "${program}"`);

        const positions = this.parseLocations(locationText);
        if (positions.length === 0)
        {
            console.log(`🎯 No positions found for: "${locationText}"`);
            const message = `Location "${locationText}" not recognized`;
            this.showFeedback(message, 'error');
            return { success: false, message };
        }

        console.log(`🎯 Found positions: [${positions.join(', ')}]`);

        // Check if positions are available
        const unavailable = positions.filter(pos => this.cellStates.get(pos) !== 'empty');
        if (unavailable.length > 0)
        {
            console.log(`🎯 Unavailable cells: [${unavailable.join(', ')}]`);
            const message = `Cells ${unavailable.join(', ')} are not empty`;
            this.showFeedback(message, 'error');
            return { success: false, message };
        }

        console.log(`🎯 All cells available, proceeding to open program`);

        const successMessage = `Opening ${programName} in ${positions.join(', ')}`;

        // Highlight then execute
        this.highlightCells(positions, 'success');
        setTimeout(() =>
        {
            this.openProgram(program, positions);
            this.showFeedback(successMessage, 'success');
        }, 1000);

        return { success: true, message: successMessage };
    }

    /**
     * Handle MOVE commands
     */
    handleMoveCommand(cmd)
    {
        // Extract source and target
        const moveMatch = cmd.match(/move\s+(.+?)\s+to\s+(.+)/);
        if (!moveMatch) return false;

        const sourceText = moveMatch[1].trim();
        const targetText = moveMatch[2].trim();

        // Find source positions
        let sourcePositions;
        if (this.isPosition(sourceText))
        {
            sourcePositions = this.parseLocations(sourceText);
        } else
        {
            // Find by program name
            sourcePositions = this.findProgramPositions(sourceText);
        }

        if (sourcePositions.length === 0)
        {
            this.showFeedback(`Source "${sourceText}" not found`, 'error');
            return false;
        }

        const targetPositions = this.parseLocations(targetText);
        if (targetPositions.length === 0)
        {
            this.showFeedback(`Target "${targetText}" not recognized`, 'error');
            return false;
        }

        // Get the program being moved
        const program = this.cellContents.get(sourcePositions[0]);
        if (!program)
        {
            this.showFeedback(`No program found at ${sourcePositions[0]}`, 'error');
            return false;
        }

        // Check target availability
        const unavailable = targetPositions.filter(pos =>
            this.cellStates.get(pos) !== 'empty' && !sourcePositions.includes(pos)
        );
        if (unavailable.length > 0)
        {
            this.showFeedback(`Target cells ${unavailable.join(', ')} are not available`, 'error');
            return false;
        }

        // Highlight then execute
        this.highlightCells([...sourcePositions, ...targetPositions], 'info');
        setTimeout(() =>
        {
            this.moveProgram(sourcePositions, targetPositions);
            this.showFeedback(`Moved ${program} to ${targetPositions.join(', ')}`, 'success');
        }, 1000);

        return true;
    }

    /**
     * Handle EXPAND commands
     */
    handleExpandCommand(cmd)
    {
        // Extract source and target
        const expandMatch = cmd.match(/expand\s+(.+?)\s+to\s+(.+)/);
        if (!expandMatch) return false;

        const sourceText = expandMatch[1].trim();
        const targetText = expandMatch[2].trim();

        // Find source positions
        let sourcePositions;
        if (this.isPosition(sourceText))
        {
            sourcePositions = this.parseLocations(sourceText);
        } else
        {
            // Find by program name
            sourcePositions = this.findProgramPositions(sourceText);
        }

        if (sourcePositions.length === 0)
        {
            this.showFeedback(`Source "${sourceText}" not found`, 'error');
            return false;
        }

        const targetPositions = this.parseLocations(targetText);
        if (targetPositions.length !== 1)
        {
            this.showFeedback('Can only expand to one cell at a time', 'error');
            return false;
        }

        const sourcePosition = sourcePositions[0]; // Use first source position as reference
        const targetPosition = targetPositions[0];

        // Check if it's a direct neighbor
        if (!this.isDirectNeighbor(sourcePosition, targetPosition))
        {
            this.showFeedback(`${targetPosition} is not adjacent to ${sourcePosition}`, 'error');
            return false;
        }

        // Check if target is available
        if (this.cellContents.get(targetPosition))
        {
            this.showFeedback(`Target cell ${targetPosition} is not empty`, 'error');
            return false;
        }

        // Get the program being expanded
        const program = this.cellContents.get(sourcePosition);
        if (!program)
        {
            this.showFeedback(`No program found at ${sourcePosition}`, 'error');
            return false;
        }

        // Highlight then execute
        this.highlightCells([...sourcePositions, targetPosition], 'info');
        setTimeout(() =>
        {
            this.expandProgram(sourcePosition, targetPosition);
            this.showFeedback(`Expanded ${program} to include ${targetPosition}`, 'success');
        }, 1000);

        return true;
    }

    /**
     * Handle SWAP commands
     */
    handleSwapCommand(cmd)
    {
        const swapMatch = cmd.match(/swap\s+(.+?)\s+with\s+(.+)/);
        if (!swapMatch) return false;

        const pos1Text = swapMatch[1].trim();
        const pos2Text = swapMatch[2].trim();

        const pos1 = this.parseLocations(pos1Text);
        const pos2 = this.parseLocations(pos2Text);

        if (pos1.length !== 1 || pos2.length !== 1)
        {
            this.showFeedback('SWAP requires exactly two single positions', 'error');
            return false;
        }

        // Highlight then execute
        this.highlightCells([pos1[0], pos2[0]], 'info');
        setTimeout(() =>
        {
            this.swapCells(pos1[0], pos2[0]);
            this.showFeedback(`Swapped ${pos1[0]} with ${pos2[0]}`, 'success');
        }, 1000);

        return true;
    }

    /**
     * Handle CLOSE commands
     */
    handleCloseCommand(cmd)
    {
        if (cmd.includes('clear screen'))
        {
            this.highlightCells(this.gridPositions, 'warning');
            setTimeout(() =>
            {
                this.clearScreen();
                this.showFeedback('Screen cleared', 'success');
            }, 1000);
            return true;
        }

        // Extract what to close
        const closeMatch = cmd.match(/close\s+(.+)/);
        if (!closeMatch) return false;

        const targetText = closeMatch[1].trim();

        let positions;
        if (this.isPosition(targetText))
        {
            positions = this.parseLocations(targetText);
        } else
        {
            positions = this.findProgramPositions(targetText);
        }

        if (positions.length === 0)
        {
            this.showFeedback(`Target "${targetText}" not found`, 'error');
            return false;
        }

        // Highlight then execute
        this.highlightCells(positions, 'warning');
        setTimeout(() =>
        {
            positions.forEach(pos => this.closeCell(pos));
            this.showFeedback(`Closed ${targetText}`, 'success');
        }, 1000);

        return true;
    }

    /**
     * Handle SAVE LAYOUT commands
     */
    handleSaveLayoutCommand(cmd)
    {
        const nameMatch = cmd.match(/save\s+layout\s+as\s+(.+)/);
        if (!nameMatch)
        {
            this.showSaveLayoutDialog();
            return true;
        }

        const layoutName = nameMatch[1].trim();
        this.saveCurrentLayout(layoutName);
        this.showFeedback(`Layout saved as "${layoutName}"`, 'success');
        return true;
    }

    /**
     * Handle LOAD LAYOUT commands
     */
    handleLoadLayoutCommand(cmd)
    {
        const nameMatch = cmd.match(/load\s+layout\s+(.+)/);
        if (!nameMatch) return false;

        const layoutName = nameMatch[1].trim();
        if (this.loadLayoutByName(layoutName))
        {
            this.showFeedback(`Loaded layout "${layoutName}"`, 'success');
            return true;
        } else
        {
            this.showFeedback(`Layout "${layoutName}" not found`, 'error');
            return false;
        }
    }

    /**
     * Parse location text into grid positions
     */
    parseLocations(locationText)
    {
        const positions = [];
        const text = locationText.toLowerCase().replace(/\s+/g, ' ');

        // Handle specific positions like "A-Top", "B-Bottom"
        const positionRegex = /([abcd])[-\s]?(top|bottom)/gi;
        let match;
        while ((match = positionRegex.exec(text)) !== null)
        {
            const col = match[1].toUpperCase();
            const row = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
            positions.push(`${col}-${row}`);
        }

        // Handle variations like "dButton", "aTop", "cBottom", etc.
        const buttonVariations = [
            { pattern: /([abcd])button/gi, row: 'Bottom' },
            { pattern: /([abcd])top/gi, row: 'Top' },
            { pattern: /([abcd])bottom/gi, row: 'Bottom' },
            { pattern: /([abcd])btn/gi, row: 'Bottom' },
        ];

        buttonVariations.forEach(({ pattern, row }) =>
        {
            let variationMatch;
            while ((variationMatch = pattern.exec(text)) !== null)
            {
                const col = variationMatch[1].toUpperCase();
                const position = `${col}-${row}`;
                if (!positions.includes(position))
                {
                    positions.push(position);
                }
            }
        });

        // Handle sides: "left side" = A-Top and A-Bottom
        if (text.includes('left side'))
        {
            positions.push('A-Top', 'A-Bottom');
        }
        if (text.includes('right side'))
        {
            positions.push('D-Top', 'D-Bottom');
        }

        // Handle rows: "top row" = all top cells
        if (text.includes('top row'))
        {
            positions.push('A-Top', 'B-Top', 'C-Top', 'D-Top');
        }
        if (text.includes('bottom row'))
        {
            positions.push('A-Bottom', 'B-Bottom', 'C-Bottom', 'D-Bottom');
        }

        // Handle adjacent cells for "across" commands
        if (text.includes('across') && positions.length === 0)
        {
            if (text.includes('c') && text.includes('d'))
            {
                if (text.includes('top')) positions.push('C-Top', 'D-Top');
                if (text.includes('bottom')) positions.push('C-Bottom', 'D-Bottom');
            }
            if (text.includes('a') && text.includes('b'))
            {
                if (text.includes('top')) positions.push('A-Top', 'B-Top');
                if (text.includes('bottom')) positions.push('A-Bottom', 'B-Bottom');
            }
        }

        console.log(`🎯 parseLocations('${locationText}') -> [${positions.join(', ')}]`);
        return [...new Set(positions)]; // Remove duplicates
    }

    /**
     * Find program by name or alias
     */
    findProgram(programName)
    {
        console.log(`🎯 findProgram called with: "${programName}"`);

        const name = programName.toLowerCase().replace(/\s+/g, '');
        console.log(`🎯 Normalized name: "${name}"`);

        // Direct matches
        if (this.availablePrograms[name])
        {
            console.log(`🎯 Direct match found: ${this.availablePrograms[name]}`);
            return this.availablePrograms[name];
        }

        // Aliases
        const aliases = {
            'patient': ['patient-info', 'patient-data', 'patientinfo', 'patientinformation', 'patient-information'],
            'vitals': ['monitoring', 'monitor', 'vital-signs', 'vitalsigns', 'procedural-monitoring', 'proceduralmonitoring'],
            'dicom': ['imaging', 'images', 'medical-images', 'medicalimages', 'scan', 'scans'],
            '3d': ['vtk', '3d-model', '3dmodel', 'visualization', '3dvisualization', '3d-visualization'],
            'voice': ['commands', 'voice-commands', 'voicecommands', 'camera', 'camera-feed', 'voice-interface', 'voiceinterface']
        };

        // Check against program keys first
        for (const [key, programId] of Object.entries(this.availablePrograms))
        {
            if (name.includes(key) || key.includes(name))
            {
                console.log(`🎯 Program key match found: ${key} -> ${programId}`);
                return programId;
            }
        }

        // Then check aliases
        for (const [key, aliasList] of Object.entries(aliases))
        {
            if (aliasList.some(alias => name.includes(alias) || alias.includes(name)))
            {
                console.log(`🎯 Alias match found: ${key} -> ${this.availablePrograms[key]}`);
                return this.availablePrograms[key];
            }
        }

        // Fallback: check if any part of the name matches
        const words = programName.toLowerCase().split(/\s+/);
        console.log(`🎯 Checking individual words: [${words.join(', ')}]`);

        for (const word of words)
        {
            // Check exact matches with program keys
            if (this.availablePrograms[word])
            {
                console.log(`🎯 Word match found: ${word} -> ${this.availablePrograms[word]}`);
                return this.availablePrograms[word];
            }

            // Check if word is contained in any alias
            for (const [key, aliasList] of Object.entries(aliases))
            {
                if (aliasList.some(alias => alias.includes(word) || word.includes(alias)))
                {
                    console.log(`🎯 Word alias match found: ${word} via ${key} -> ${this.availablePrograms[key]}`);
                    return this.availablePrograms[key];
                }
            }
        }

        console.log(`🎯 findProgram('${programName}') -> null (not found)`);
        return null;
    }

    /**
     * Find positions where a program is currently located
     */
    findProgramPositions(programName)
    {
        const program = this.findProgram(programName);
        if (!program) return [];

        const positions = [];
        for (const [position, content] of this.cellContents.entries())
        {
            if (content === program)
            {
                positions.push(position);
            }
        }
        return positions;
    }

    /**
     * Check if text represents a grid position
     */
    isPosition(text)
    {
        const normalized = text.toLowerCase().replace(/\s+/g, '');
        return this.gridPositions.some(pos =>
            normalized.includes(pos.toLowerCase().replace('-', ''))
        );
    }

    /**
     * Open a program in specified positions
     */
    openProgram(program, positions)
    {


        if (positions.length === 1)
        {

            // Single cell - normal behavior
            const position = positions[0];
            this.cellContents.set(position, program);
            this.cellStates.set(position, 'occupied');
            this.loadContentIntoCell(position, program);
            this.updateCellAppearance(position);
        }
        else if (positions.length > 1)
        {

            // Multiple cells - span the component
            this.createSpanningComponent(program, positions);
        }
        else
        {
            console.error(`Invalid positions array for openProgram:`, positions);
        }
    }

    /**
 * Create a component that spans multiple cells
 */
    createSpanningComponent(program, positions)
    {


        // Mark all cells as occupied

        positions.forEach(position =>
        {

            this.cellContents.set(position, program);
            this.cellStates.set(position, 'occupied');
            this.updateCellAppearance(position);
            this.updateCellHeader(position, program);
        });

        // Load content into first cell
        const firstPosition = positions[0];

        this.loadContentIntoCell(firstPosition, program);

        // Make the first cell span across the required grid area
        const firstCell = document.getElementById(`cell-${firstPosition}`);
        if (firstCell)
        {

            const gridArea = this.calculateGridArea(positions);

            firstCell.style.gridArea = gridArea;
            firstCell.style.zIndex = '10';
            firstCell.style.position = 'relative';

        }
        else
        {
            console.error(`❌ Could not find first cell element: cell-${firstPosition}`);
        }

        // Hide other cells that are part of the span

        positions.slice(1).forEach(position =>
        {
            const cell = document.getElementById(`cell-${position}`);
            if (cell)
            {

                cell.style.display = 'none';
            }
            else
            {
                console.error(`❌ Could not find cell to hide: cell-${position}`);
            }
        });


    }

    /**
     * Calculate grid area string for spanning cells
     */
    calculateGridArea(positions)
    {
        // Convert positions to row/col numbers for CSS Grid
        const gridPositions = positions.map(pos =>
        {
            const [col, row] = pos.split('-');
            const colNum = col.charCodeAt(0) - 64; // A=1, B=2, C=3, D=4
            const rowNum = row === 'Top' ? 1 : 2;
            return { row: rowNum, col: colNum };
        });

        const minRow = Math.min(...gridPositions.map(p => p.row));
        const maxRow = Math.max(...gridPositions.map(p => p.row));
        const minCol = Math.min(...gridPositions.map(p => p.col));
        const maxCol = Math.max(...gridPositions.map(p => p.col));

        // CSS Grid area syntax: row-start / col-start / row-end / col-end
        // End values are exclusive, so we add 1
        const gridArea = `${minRow} / ${minCol} / ${maxRow + 1} / ${maxCol + 1}`;


        return gridArea;
    }



    /**
     * Move a program from source to target positions
     */
    moveProgram(sourcePositions, targetPositions)
    {
        const program = this.cellContents.get(sourcePositions[0]);

        // Clear source positions
        sourcePositions.forEach(pos =>
        {
            this.cellContents.set(pos, null);
            this.cellStates.set(pos, 'empty');
            this.clearCellContent(pos);
            this.updateCellAppearance(pos);
        });

        // Use openProgram to handle spanning properly
        this.openProgram(program, targetPositions);

        if (program === 'voice-interface')
        {
            if (window.orVoiceAssistant && window.orVoiceAssistant.voiceRecorder)
            {
                setTimeout(() =>
                {
                    window.orVoiceAssistant.voiceRecorder.initialize();
                }, 100);
            }
        }
    }

    /**
     * Swap contents of two cells
     */
    swapCells(pos1, pos2)
    {
        const content1 = this.cellContents.get(pos1);
        const content2 = this.cellContents.get(pos2);
        const state1 = this.cellStates.get(pos1);
        const state2 = this.cellStates.get(pos2);

        // Swap contents
        this.cellContents.set(pos1, content2);
        this.cellContents.set(pos2, content1);
        this.cellStates.set(pos1, state2);
        this.cellStates.set(pos2, state1);

        // Update displays
        if (content1) this.clearCellContent(pos1);
        if (content2) this.clearCellContent(pos2);

        if (content2) this.loadContentIntoCell(pos1, content2);
        if (content1) this.loadContentIntoCell(pos2, content1);

        this.updateCellAppearance(pos1);
        this.updateCellAppearance(pos2);
    }

    /**
     * Close a specific cell
     */
    closeCell(position)
    {
        // Find all positions with the same component (for spanning components)
        const component = this.cellContents.get(position);
        if (component)
        {
            const spanningPositions = this.gridPositions.filter(pos =>
                this.cellContents.get(pos) === component
            );

            // Add to closed programs list if not already there
            if (!this.closedPrograms.find(cp => cp.program === component))
            {
                this.closedPrograms.push({
                    program: component,
                    displayName: this.getComponentDisplayName(component),
                    previousPositions: [...spanningPositions]
                });
                this.updateReopenButtonState();
            }

            // Clear all positions of this component
            spanningPositions.forEach(pos =>
            {
                this.clearCellContent(pos);
            });
        }
        else
        {
            this.clearCellContent(position);
        }
    }

    /**
     * Clear all cells
     */
    clearScreen()
    {

        this.gridPositions.forEach(position =>
        {

            this.closeCell(position);
        });

    }

    /**
     * Load content into a grid cell
     */
    loadContentIntoCell(position, program)
    {
        console.log(`🎯 loadContentIntoCell: ${program} -> ${position}`);

        const cellContent = document.getElementById(`content-${position}`);
        if (!cellContent)
        {
            console.error(`❌ Cell content container not found: content-${position}`);
            return;
        }

        // Clear existing content first
        cellContent.innerHTML = '';

        // Find the corresponding component element
        const sourceComponent = document.getElementById(program);

        if (sourceComponent)
        {
            // Standard component cloning for all components
            const clone = sourceComponent.cloneNode(true);
            clone.id = `${program}-${position}`;

            // Make sure the cloned component is visible and fills the container
            clone.style.display = 'block';
            clone.style.position = 'static';
            clone.style.top = 'auto';
            clone.style.left = 'auto';
            clone.style.width = '100%';
            clone.style.height = '100%';
            clone.style.visibility = 'visible';
            clone.style.overflow = 'hidden';

            // Hide the component's internal panel header to avoid duplication
            const panelHeader = clone.querySelector('.panel-header');
            if (panelHeader)
            {
                panelHeader.style.display = 'none';
            }

            // Adjust the panel content to fill the space
            const panelContent = clone.querySelector('.panel-content');
            if (panelContent)
            {
                panelContent.style.height = '100%';
                panelContent.style.borderRadius = '0';
                panelContent.style.overflow = 'auto';
            }

            // Ensure the cell content container fills the available space
            cellContent.style.width = '100%';
            cellContent.style.height = '100%';
            cellContent.style.overflow = 'hidden';

            cellContent.appendChild(clone);

            // Initialize any component-specific functionality
            this.initializeComponentInCell(program, position);

            // Update cell header to show component name instead of grid position
            this.updateCellHeader(position, program);

            // Update cell state and appearance
            this.cellStates.set(position, 'occupied');
            this.cellContents.set(position, program);
            this.updateCellAppearance(position);
        } else
        {
            console.log(`🎯 Source component not found: ${program}, trying direct loading...`);
            // Try to load component content directly
            this.loadComponentDirectly(position, program);
        }
    }

    /**
     * Load component content directly when cloning fails
     */
    async loadComponentDirectly(position, program)
    {
        const cellContent = document.getElementById(`content-${position}`);
        if (!cellContent) return;

        // Map program names to component files
        const componentMap = {
            'patient-panel': 'patient-panel',
            'voice-interface': 'voice-interface',
            'monitoring-panel': 'monitoring-panel',
            'vtk-viewer': 'vtk-viewer',
            'image-viewer': 'image-viewer',
            'dicom-viewer': 'dicom-viewer'
        };

        const componentName = componentMap[program];
        if (componentName)
        {
            try
            {
                const response = await fetch(`/components/${componentName}.html`);
                if (response.ok)
                {
                    const html = await response.text();
                    cellContent.innerHTML = html;

                    // Initialize any component-specific functionality
                    this.initializeComponentInCell(program, position);

                    // Update cell header to show component name
                    this.updateCellHeader(position, program);

                    // Update cell state and appearance
                    this.cellStates.set(position, 'occupied');
                    this.cellContents.set(position, program);
                    this.updateCellAppearance(position);
                }
            } catch (error)
            {
                console.error(`Error loading component ${componentName}:`, error);
                this.createPlaceholderContent(cellContent, program);
            }
        } else
        {
            this.createPlaceholderContent(cellContent, program);

            // Update cell header and state even for placeholder content
            this.updateCellHeader(position, program);
            this.cellStates.set(position, 'occupied');
            this.cellContents.set(position, program);
            this.updateCellAppearance(position);
        }
    }



    /**
     * Update cell header to show component name instead of grid position
     */
    updateCellHeader(position, program)
    {
        const cell = document.getElementById(`cell-${position}`);
        if (!cell) return;

        const cellLabel = cell.querySelector('.cell-label');
        if (cellLabel)
        {
            const displayName = this.getComponentDisplayName(program);
            cellLabel.textContent = displayName;
        }
    }

    /**
     * Get display name for component
     */
    getComponentDisplayName(program)
    {
        const displayNames = {
            'patient-panel': 'Patient Information',
            'voice-interface': 'Voice Commands',
            'monitoring-panel': 'Procedural Monitoring',
            'vtk-viewer': '3D Visualization',
            'image-viewer': 'Image Viewer',
            'dicom-viewer': 'DICOM Viewer'
        };
        return displayNames[program] || program;
    }

    /**
     * Clear content from a grid cell
     */
    clearCellContent(position)
    {
        const cellContent = document.getElementById(`content-${position}`);
        if (cellContent)
        {
            cellContent.innerHTML = '';
            // Reset any spanning styles
            cellContent.style.position = '';
            cellContent.style.width = '';
            cellContent.style.height = '';
            cellContent.style.left = '';
            cellContent.style.top = '';
            cellContent.style.zIndex = '';
            cellContent.style.gridArea = '';
            cellContent.style.display = '';
        }

        // Reset cell styles and make it visible
        const cell = document.getElementById(`cell-${position}`);
        if (cell)
        {
            cell.style.gridArea = '';
            cell.style.zIndex = '';
            cell.style.display = '';
            cell.style.position = '';

            const cellLabel = cell.querySelector('.cell-label');
            if (cellLabel)
            {
                cellLabel.textContent = position;
            }
        }

        // Update cell state
        this.cellStates.set(position, 'empty');
        this.cellContents.set(position, null);
        this.updateCellAppearance(position);
    }

    /**
     * Initialize component-specific functionality in grid cells
     */
    initializeComponentInCell(program, position)
    {
        console.log(`🎯 Initializing ${program} functionality in position: ${position}`);

        switch (program)
        {
            case 'patient-panel':
                this.initializePatientPanelInCell(position);
                break;

            case 'voice-interface':
                this.initializeVoiceInterfaceInCell(position);
                break;

            case 'monitoring-panel':
                this.initializeMonitoringPanelInCell(position);
                break;

            case 'vtk-viewer':
                this.initializeVtkViewerInCell(position);
                break;

            case 'image-viewer':
                this.initializeImageViewerInCell(position);
                break;

            case 'dicom-viewer':
                this.initializeDicomViewerInCell(position);
                break;

            default:
                console.log(`No specific initialization needed for: ${program}`);
        }
    }

    /**
     * Initialize voice interface functionality in a grid cell
     * Set up chat functionality to work with the main chat interface
     */
    initializeVoiceInterfaceInCell(position)
    {
        console.log('🎯 Initializing voice interface functionality in position:', position);

        const cellContent = document.getElementById(`content-${position}`);
        if (!cellContent)
        {
            console.error('❌ Cell content not found for voice interface initialization:', position);
            return;
        }

        // Find the cloned elements in this specific cell
        const clonedSendBtn = cellContent.querySelector('.send-button');
        const clonedTextInput = cellContent.querySelector('.text-input');

        if (clonedSendBtn && clonedTextInput)
        {
            console.log('🎯 Setting up chat functionality for cloned voice interface');

            // Remove any existing event listeners to avoid duplicates
            const newSendBtn = clonedSendBtn.cloneNode(true);
            clonedSendBtn.parentNode.replaceChild(newSendBtn, clonedSendBtn);

            const newTextInput = clonedTextInput.cloneNode(true);
            clonedTextInput.parentNode.replaceChild(newTextInput, clonedTextInput);

            // Add event listeners that connect to the main application's chat interface
            newSendBtn.addEventListener('click', () =>
            {
                this.handleClonedChatSend(newTextInput, newSendBtn);
            });

            newTextInput.addEventListener('keypress', (e) =>
            {
                if (e.key === 'Enter' && !e.shiftKey)
                {
                    e.preventDefault();
                    this.handleClonedChatSend(newTextInput, newSendBtn);
                }
            });

            console.log('✅ Voice interface chat functionality initialized for position:', position);
        } else
        {
            console.error('❌ Could not find chat elements in cloned voice interface');
        }
    }

    /**
     * Handle send button click from cloned voice interface
     */
    async handleClonedChatSend(textInput, sendBtn)
    {
        const message = textInput.value.trim();
        if (!message) return;

        console.log('🎯 Handling cloned chat send:', message);

        // Disable button temporarily
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        try
        {
            // Find the chat history in this cloned interface
            const clonedChatHistory = textInput.closest('.voice-interface')?.querySelector('.chat-history');

            // Add user message to the cloned chat interface immediately
            if (clonedChatHistory)
            {
                this.addMessageToClonedChat(clonedChatHistory, 'user', message, 'Text');
            }

            // Get the main chat interface from the global application
            const mainApp = window.orVoiceAssistant;
            if (mainApp && mainApp.chatInterface)
            {
                // Add message through the main chat interface (for consistency)
                mainApp.chatInterface.addUserMessage(message, 'Text');

                // Clear the input
                textInput.value = '';

                // Process the command through the main application
                const result = await mainApp.processCommand(message);

                // If we got a result and have a cloned chat history, also update the cloned interface
                if (result && clonedChatHistory)
                {
                    // Handle different types of results
                    if (result.response)
                    {
                        // API result with response
                        this.addMessageToClonedChat(clonedChatHistory, 'assistant', result.response, 'Assistant');
                    }
                    else if (result.message)
                    {
                        // Grid command result
                        const source = result.success ? 'Surgical Grid' : 'Surgical Grid Error';
                        this.addMessageToClonedChat(clonedChatHistory, 'assistant', result.message, source);
                    }
                    else if (result.error)
                    {
                        // Error result
                        this.addMessageToClonedChat(clonedChatHistory, 'assistant', result.response || 'Error processing command.', 'System');
                    }
                }
            } else
            {
                console.error('❌ Main application or chat interface not found');
            }
        } catch (error)
        {
            console.error('Error sending message from cloned interface:', error);

            // Add error message to cloned chat if possible
            const clonedChatHistory = textInput.closest('.voice-interface')?.querySelector('.chat-history');
            if (clonedChatHistory)
            {
                this.addMessageToClonedChat(clonedChatHistory, 'assistant', 'Sorry, there was an error processing your message. Please try again.', 'System');
            }
        } finally
        {
            // Re-enable button
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
        }
    }

    /**
     * Add a message to a cloned chat interface
     */
    addMessageToClonedChat(chatHistory, sender, message, source = 'System')
    {
        if (!chatHistory) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Escape HTML to prevent XSS
        const escapeHtml = (text) =>
        {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${escapeHtml(message)}</div>
                <div class="message-time">${source} • ${timeString}</div>
            </div>
        `;

        chatHistory.appendChild(messageDiv);

        // Scroll to bottom
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    /**
     * Initialize patient panel functionality in a grid cell
     * Re-adds event listeners for collapsible sections that are lost during cloning
     */
    initializePatientPanelInCell(position)
    {
        console.log('🎯 Initializing patient panel functionality in position:', position);

        // Find all collapsible headers in this specific cell
        const cellContent = document.getElementById(`content-${position}`);
        if (!cellContent)
        {
            console.error('❌ Cell content not found for patient panel initialization:', position);
            return;
        }

        const collapsibleHeaders = cellContent.querySelectorAll('.collapsible-header');
        console.log('🎯 Found', collapsibleHeaders.length, 'collapsible headers in position:', position);

        collapsibleHeaders.forEach((header, index) =>
        {
            // Remove any existing event listeners to avoid duplicates
            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);

            // Add the click event listener
            newHeader.addEventListener('click', () =>
            {
                console.log('🎯 Collapsible header clicked in position:', position, 'header index:', index);

                const isCollapsed = newHeader.classList.contains('collapsed');
                const contentDiv = newHeader.nextElementSibling;

                if (contentDiv && contentDiv.classList.contains('collapsible-content'))
                {
                    // Toggle collapsed state
                    newHeader.classList.toggle('collapsed', !isCollapsed);
                    contentDiv.classList.toggle('collapsed', !isCollapsed);

                    console.log('🎯 Toggled section to:', !isCollapsed ? 'collapsed' : 'expanded');
                }
                else
                {
                    console.error('❌ Could not find corresponding content div for header');
                }
            });
        });

        console.log('✅ Patient panel collapsible functionality initialized for position:', position);
    }

    /**
     * Update cell visual appearance based on state
     */
    updateCellAppearance(position)
    {
        const cell = document.getElementById(`cell-${position}`);
        if (!cell) return;

        const state = this.cellStates.get(position);
        const content = this.cellContents.get(position);

        // Remove all state classes
        cell.classList.remove('empty', 'occupied', 'highlighted-success', 'highlighted-info', 'highlighted-warning', 'highlighted-error');

        // Add current state class
        cell.classList.add(state);

        // Show/hide header based on content
        const header = cell.querySelector('.cell-header');
        if (header)
        {
            header.style.display = content ? 'flex' : 'none';
        }
    }

    /**
     * Highlight cells with visual feedback
     */
    highlightCells(positions, type = 'info')
    {
        // Clear existing highlights
        this.clearHighlights();

        positions.forEach(position =>
        {
            const cell = document.getElementById(`cell-${position}`);
            if (cell)
            {
                cell.classList.add(`highlighted-${type}`);
            }
        });

        // Auto-clear highlights after delay
        if (this.highlightTimeout)
        {
            clearTimeout(this.highlightTimeout);
        }
        this.highlightTimeout = setTimeout(() =>
        {
            this.clearHighlights();
        }, 2000);
    }

    /**
     * Clear all highlights
     */
    clearHighlights()
    {
        this.gridPositions.forEach(position =>
        {
            const cell = document.getElementById(`cell-${position}`);
            if (cell)
            {
                cell.classList.remove('highlighted-success', 'highlighted-info', 'highlighted-warning', 'highlighted-error');
            }
        });
    }

    /**
     * Show command feedback
     */
    showFeedback(message, type = 'info')
    {
        const overlay = document.getElementById('command-feedback-overlay');
        const messageEl = document.getElementById('feedback-message');

        if (overlay && messageEl)
        {
            messageEl.textContent = message;
            overlay.className = `command-feedback-overlay ${type}`;
            overlay.style.display = 'block';

            setTimeout(() =>
            {
                overlay.style.display = 'none';
            }, 3000);
        }

        // Also show in alert manager if available
        if (this.alertManager)
        {
            switch (type)
            {
                case 'success':
                    this.alertManager.showSuccess(message);
                    break;
                case 'error':
                    this.alertManager.showCritical(message);
                    break;
                case 'warning':
                    this.alertManager.showWarning(message);
                    break;
                default:
                    this.alertManager.showInfo(message);
                    break;
            }
        }
    }

    /**
     * Save current layout
     */
    saveCurrentLayout(name)
    {
        const layout = {
            name: name,
            timestamp: new Date().toISOString(),
            cells: {}
        };

        this.gridPositions.forEach(position =>
        {
            const content = this.cellContents.get(position);
            const state = this.cellStates.get(position);
            layout.cells[position] = { content, state };
        });

        // Remove existing layout with same name
        this.savedLayouts = this.savedLayouts.filter(l => l.name !== name);

        // Add new layout
        this.savedLayouts.push(layout);

        // Save to localStorage
        this.saveSavedLayouts();

        // Update presets display
        this.updatePresetsDisplay();
    }

    /**
     * Load layout by name
     */
    loadLayoutByName(name)
    {
        const layout = this.savedLayouts.find(l => l.name === name);
        if (!layout) return false;

        this.loadLayout(layout);
        return true;
    }

    /**
     * Load a layout configuration
     */
    loadLayout(layout)
    {



        // Clear current layout
        this.clearScreen();

        // Group cells by component to handle spanning components properly
        const componentGroups = new Map();

        for (const [position, cellData] of Object.entries(layout.cells))
        {
            if (cellData.content)
            {
                if (!componentGroups.has(cellData.content))
                {
                    componentGroups.set(cellData.content, []);
                }
                componentGroups.get(cellData.content).push(position);
            }
        }



        // Load each component group using openProgram to handle spanning properly
        for (const [component, positions] of componentGroups.entries())
        {

            this.openProgram(component, positions);
        }

        // After loading layout, check if voice-interface is present and re-initialize
        const voiceInterfacePositions = componentGroups.get('voice-interface');
        if (voiceInterfacePositions && voiceInterfacePositions.length > 0) {
            if (window.orVoiceAssistant && window.orVoiceAssistant.voiceRecorder) {
                setTimeout(() => {
                    window.orVoiceAssistant.voiceRecorder.initialize();
                }, 100);
            }
        }


    }

    /**
     * Delete a saved layout
     */
    deleteLayout(name)
    {
        this.savedLayouts = this.savedLayouts.filter(l => l.name !== name);
        this.saveSavedLayouts();
        this.updatePresetsDisplay();
        this.showFeedback(`Layout "${name}" deleted`, 'info');
    }

    /**
     * Show save layout dialog
     */
    showSaveLayoutDialog()
    {
        const name = prompt('Enter layout name:');
        if (name && name.trim())
        {
            this.saveCurrentLayout(name.trim());
            this.showFeedback(`Layout saved as "${name}"`, 'success');
        }
    }

    /**
     * Toggle presets panel
     */
    togglePresetsPanel()
    {
        const panel = document.getElementById('layout-presets-panel');
        if (panel)
        {
            panel.classList.toggle('expanded');
        }
    }

    /**
     * Update presets display
     */
    updatePresetsDisplay()
    {
        const presetsContainer = document.getElementById('saved-presets');
        if (!presetsContainer) return;

        presetsContainer.innerHTML = '';

        this.savedLayouts.forEach(layout =>
        {
            const presetEl = document.createElement('div');
            presetEl.className = 'saved-preset';
            presetEl.innerHTML = `
                <div class="preset-info">
                    <div class="preset-name">${layout.name}</div>
                    <div class="preset-date">${new Date(layout.timestamp).toLocaleDateString()}</div>
                </div>
                <div class="preset-actions">
                    <button class="load-preset-btn" data-layout-name="${layout.name}">Load</button>
                    <button class="delete-preset-btn" data-layout-name="${layout.name}">×</button>
                </div>
            `;
            presetsContainer.appendChild(presetEl);
        });
    }

    /**
     * Load saved layouts from localStorage
     */
    loadSavedLayouts()
    {
        try
        {
            const saved = localStorage.getItem('surgicalGridLayouts');
            return saved ? JSON.parse(saved) : [];
        } catch (error)
        {
            console.error('Error loading saved layouts:', error);
            return [];
        }
    }

    /**
     * Save layouts to localStorage
     */
    saveSavedLayouts()
    {
        try
        {
            localStorage.setItem('surgicalGridLayouts', JSON.stringify(this.savedLayouts));
        } catch (error)
        {
            console.error('Error saving layouts:', error);
        }
    }

    /**
 * Show reorder overlay for selecting target position(s)
 */
    showReorderOverlay(sourcePosition)
    {
        // Check if source cell has content
        const sourceContent = this.cellContents.get(sourcePosition);
        if (!sourceContent)
        {
            this.showFeedback('No content to reorder in this cell', 'warning');
            return;
        }

        this.currentReorderSource = sourcePosition;
        this.selectedReorderCells.clear();
        this.updateReorderOverlay(sourcePosition);
        this.updateConfirmButton();

        const overlay = document.getElementById('reorder-overlay');
        if (overlay)
        {
            overlay.classList.add('show');
        }
    }

    /**
     * Hide reorder overlay
     */
    hideReorderOverlay()
    {
        const overlay = document.getElementById('reorder-overlay');
        if (overlay)
        {
            overlay.classList.remove('show');
        }
        this.currentReorderSource = null;
        this.selectedReorderCells.clear();
        this.clearReorderCellStates();
    }

    /**
 * Update reorder overlay to show current cell states
 */
    updateReorderOverlay(sourcePosition)
    {
        const reorderCells = document.querySelectorAll('.reorder-cell');
        const directNeighbors = this.getDirectNeighbors(sourcePosition);

        reorderCells.forEach(cell =>
        {
            const position = cell.dataset.target;

            // Clear previous states
            cell.classList.remove('occupied', 'source', 'selected', 'expandable');

            // Mark source cell
            if (position === sourcePosition)
            {
                cell.classList.add('source');
            }
            // Mark occupied cells
            else if (this.cellContents.get(position))
            {
                cell.classList.add('occupied');
            }
            // Mark selected cells
            else if (this.selectedReorderCells.has(position))
            {
                cell.classList.add('selected');
            }
            // Mark expandable neighbors (empty direct neighbors)
            else if (directNeighbors.includes(position) && !this.cellContents.get(position))
            {
                cell.classList.add('expandable');
            }
        });
    }

    /**
     * Clear reorder cell visual states
     */
    clearReorderCellStates()
    {
        const reorderCells = document.querySelectorAll('.reorder-cell');
        reorderCells.forEach(cell =>
        {
            cell.classList.remove('occupied', 'source', 'selected');
        });
    }

    /**
 * Toggle selection of a cell in the reorder overlay
 */
    toggleReorderCellSelection(targetPosition)
    {
        if (!this.currentReorderSource)
        {
            console.error('No source position set for reorder');
            return;
        }

        const sourcePosition = this.currentReorderSource;

        // Can't select the source position
        if (sourcePosition === targetPosition)
        {
            return;
        }

        // Can't select occupied cells
        if (this.cellContents.get(targetPosition))
        {
            return;
        }

        // Toggle selection
        if (this.selectedReorderCells.has(targetPosition))
        {
            this.selectedReorderCells.delete(targetPosition);
        }
        else
        {
            this.selectedReorderCells.add(targetPosition);
        }

        // Update visual state and confirm button
        this.updateReorderOverlay(sourcePosition);
        this.updateConfirmButton();
    }

    /**
     * Update the confirm button state based on selection
     */
    updateConfirmButton()
    {
        const confirmBtn = document.getElementById('reorder-confirm-btn');
        const expandBtn = document.getElementById('reorder-expand-btn');

        if (confirmBtn)
        {
            const hasSelection = this.selectedReorderCells.size > 0;
            confirmBtn.disabled = !hasSelection;

            if (hasSelection)
            {
                const cellCount = this.selectedReorderCells.size;
                confirmBtn.textContent = `Move Here (${cellCount} cell${cellCount > 1 ? 's' : ''})`;
            }
            else
            {
                confirmBtn.textContent = 'Move Here';
            }
        }

        if (expandBtn)
        {
            // Only enable expand button if exactly one cell is selected and it's a direct neighbor
            const hasSelection = this.selectedReorderCells.size === 1;
            const selectedPosition = Array.from(this.selectedReorderCells)[0];
            const isNeighbor = hasSelection && this.isDirectNeighbor(this.currentReorderSource, selectedPosition);

            expandBtn.disabled = !isNeighbor;

            if (isNeighbor)
            {
                expandBtn.textContent = 'Expand to Here';
            }
            else
            {
                expandBtn.textContent = 'Expand to Here';
            }
        }
    }

    /**
     * Confirm and execute the reorder operation
     */
    confirmReorder()
    {
        if (!this.currentReorderSource || this.selectedReorderCells.size === 0)
        {
            return;
        }

        const sourcePosition = this.currentReorderSource;
        const targetPositions = Array.from(this.selectedReorderCells);

        try
        {
            // Use existing moveProgram functionality for multi-cell spanning
            this.moveProgram([sourcePosition], targetPositions);

            const cellText = targetPositions.length === 1 ? 'cell' : 'cells';
            this.showFeedback(
                `Moved content from ${sourcePosition} to ${targetPositions.length} ${cellText}`,
                'success'
            );
        }
        catch (error)
        {
            console.error('Error executing reorder:', error);
            this.showFeedback('Error moving content', 'error');
        }

        this.hideReorderOverlay();
    }

    /**
     * Confirm and execute the expand operation
     */
    confirmExpand()
    {
        if (!this.currentReorderSource || this.selectedReorderCells.size !== 1)
        {
            return;
        }

        const sourcePosition = this.currentReorderSource;
        const targetPosition = Array.from(this.selectedReorderCells)[0];

        // Verify it's a direct neighbor
        if (!this.isDirectNeighbor(sourcePosition, targetPosition))
        {
            this.showFeedback('Can only expand to direct neighbors', 'error');
            return;
        }

        try
        {
            this.expandProgram(sourcePosition, targetPosition);
            this.showFeedback(
                `Expanded content from ${sourcePosition} to include ${targetPosition}`,
                'success'
            );
        }
        catch (error)
        {
            console.error('Error executing expand:', error);
            this.showFeedback('Error expanding content', 'error');
        }

        this.hideReorderOverlay();

        // If voice interface was expanded, re-initialize it
        if (this.cellContents.get(sourcePosition) === 'voice-interface') {
            if (window.orVoiceAssistant && window.orVoiceAssistant.voiceRecorder) {
                setTimeout(() => {
                    window.orVoiceAssistant.voiceRecorder.initialize();
                }, 100);
            }
        }
    }

    /**
     * Expand a program from its current positions to include a new position
     */
    expandProgram(sourcePosition, targetPosition)
    {
        const component = this.cellContents.get(sourcePosition);
        if (!component)
        {
            throw new Error('No component found at source position');
        }

        // Check if target position is available
        if (this.cellContents.get(targetPosition))
        {
            throw new Error('Target position is not empty');
        }

        // Get all current positions of this component
        const currentPositions = this.getSourceComponentPositions(sourcePosition);

        // Add the new position to the spanning
        const newPositions = [...currentPositions, targetPosition];

        // Clear the current spanning first
        this.clearSpanningComponent(component, currentPositions);

        // Create new spanning with expanded positions
        this.createSpanningComponent(component, newPositions);
    }

    /**
     * Clear a spanning component from all its positions
     */
    clearSpanningComponent(component, positions)
    {
        positions.forEach(pos =>
        {
            this.cellContents.set(pos, null);
            this.cellStates.set(pos, 'empty');
            this.clearCellContent(pos);
            this.updateCellAppearance(pos);
        });
    }

    /**
     * Get direct neighbors of a grid position
     */
    getDirectNeighbors(position)
    {
        const neighbors = [];
        const [col, row] = position.split('-');

        // Define column and row mappings
        const colMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
        const rowMap = { 'Top': 0, 'Bottom': 1 };
        const colNames = ['A', 'B', 'C', 'D'];
        const rowNames = ['Top', 'Bottom'];

        const currentCol = colMap[col];
        const currentRow = rowMap[row];

        // Check all 4 directions (up, down, left, right)
        const directions = [
            { col: currentCol, row: currentRow - 1 }, // up
            { col: currentCol, row: currentRow + 1 }, // down
            { col: currentCol - 1, row: currentRow }, // left
            { col: currentCol + 1, row: currentRow }  // right
        ];

        directions.forEach(dir =>
        {
            if (dir.col >= 0 && dir.col < 4 && dir.row >= 0 && dir.row < 2)
            {
                const neighborPos = `${colNames[dir.col]}-${rowNames[dir.row]}`;
                neighbors.push(neighborPos);
            }
        });

        return neighbors;
    }

    /**
     * Check if a position is a direct neighbor of the source position
     */
    isDirectNeighbor(sourcePosition, targetPosition)
    {
        const neighbors = this.getDirectNeighbors(sourcePosition);
        return neighbors.includes(targetPosition);
    }

    /**
     * Get all positions currently occupied by the same component as the source
     */
    getSourceComponentPositions(sourcePosition)
    {
        const component = this.cellContents.get(sourcePosition);
        if (!component) return [sourcePosition];

        const positions = [];
        for (const [position, content] of this.cellContents.entries())
        {
            if (content === component)
            {
                positions.push(position);
            }
        }
        return positions;
    }


    /**
     * Get current grid state for external access
     */
    getGridState()
    {
        const state = {};
        this.gridPositions.forEach(position =>
        {
            state[position] = {
                content: this.cellContents.get(position),
                state: this.cellStates.get(position)
            };
        });
        return state;
    }

    /**
     * Create a demonstration layout to show the surgical grid capabilities
     */
    createDemoLayout()
    {
        // Check what components are available
        this.logAvailableComponents();

        // Clear any existing demo layouts first
        this.clearOldDemoLayouts();

        // Clear current screen first
        this.clearScreen();

        // Use the procedure-specific layout instead of generic one
        this.loadProcedureLayout(this.currentProcedure);

        setTimeout(() =>
        {
            this.showFeedback('OR layout ready! Try: "Move vitals to C-Top" or "Swap A-Top with D-Bottom"', 'success');
        }, 2000);
    }

    /**
     * Create PAD Angioplasty specific layout
     * Image Viewer: A-Top, A-Bottom, B-Top, B-Bottom (spanning over 4)
     * Patient Information: D-Bottom
     * DICOM Viewer: C-Top, C-Bottom
     * Voice Commands: D-Top
     * (Don't show Procedural Monitoring)
     */
    createPadAngioplastyLayout()
    {
        console.log('Creating PAD Angioplasty layout');

        // Image Viewer spanning 4 cells (A-Top, A-Bottom, B-Top, B-Bottom)
        this.openProgram('image-viewer', ['A-Top', 'A-Bottom', 'B-Top', 'B-Bottom']);

        // DICOM Viewer spanning C-Top and C-Bottom
        this.openProgram('dicom-viewer', ['C-Top', 'C-Bottom']);

        // Voice Commands in D-Top
        this.openProgram('voice-interface', ['D-Top']);

        // Patient Information in D-Bottom
        this.openProgram('patient-panel', ['D-Bottom']);

        // Save as PAD Angioplasty default layout
        this.saveCurrentLayout('PAD Angioplasty Default');
        const savedLayouts = this.loadSavedLayouts();
        const layoutObj = savedLayouts.find(l => l.name === 'PAD Angioplasty Default');
        if (layoutObj)
        {
            layoutObj.isDefault = true;
            layoutObj.procedureType = 'pad_angioplasty';
            this.savedLayouts = savedLayouts;
            this.saveSavedLayouts();
        }

        this.updatePresetsDisplay();
        console.log('PAD Angioplasty layout created successfully');
    }

    /**
     * Create EP Ablation specific layout
     * 3D Visualization: A-Bottom, B-Bottom
     * DICOM Viewer: C-Top, D-Top
     * Patient Information: C-Bottom
     * Voice Commands: D-Bottom
     * Procedural Monitoring: A-Top, B-Top
     */
    createEpAblationLayout()
    {
        console.log('Creating EP Ablation layout');

        // 3D Visualization spanning A-Bottom and B-Bottom
        this.openProgram('vtk-viewer', ['A-Bottom', 'B-Bottom']);

        // DICOM Viewer spanning C-Top and D-Top
        this.openProgram('dicom-viewer', ['C-Top', 'D-Top']);

        // Patient Information in C-Bottom
        this.openProgram('patient-panel', ['C-Bottom']);

        // Voice Commands in D-Bottom
        this.openProgram('voice-interface', ['D-Bottom']);

        // Procedural Monitoring spanning A-Top and B-Top
        this.openProgram('monitoring-panel', ['A-Top', 'B-Top']);

        // Save as EP Ablation default layout
        this.saveCurrentLayout('EP Ablation Default');
        const savedLayouts = this.loadSavedLayouts();
        const layoutObj = savedLayouts.find(l => l.name === 'EP Ablation Default');
        if (layoutObj)
        {
            layoutObj.isDefault = true;
            layoutObj.procedureType = 'ep_ablation';
            this.savedLayouts = savedLayouts;
            this.saveSavedLayouts();
        }

        this.updatePresetsDisplay();
        console.log('EP Ablation layout created successfully');
    }

    /**
     * Create default/fallback layout (original demo layout)
     */
    createDefaultLayout()
    {
        console.log('Creating default layout');

        // Use the openProgram method to properly span components across multiple cells
        this.openProgram('patient-panel', ['A-Top', 'A-Bottom']);
        this.openProgram('vtk-viewer', ['B-Top', 'B-Bottom']);
        this.openProgram('dicom-viewer', ['C-Top', 'C-Bottom']);
        this.openProgram('voice-interface', ['D-Top']);
        this.openProgram('monitoring-panel', ['D-Bottom']);

        // Save as default demo layout
        this.saveCurrentLayout('OR Default Layout');
        const savedLayouts = this.loadSavedLayouts();
        const demoLayoutObj = savedLayouts.find(l => l.name === 'OR Default Layout');
        if (demoLayoutObj)
        {
            demoLayoutObj.isDefault = true;
            this.savedLayouts = savedLayouts;
            this.saveSavedLayouts();
        }

        this.updatePresetsDisplay();
        console.log('Default layout created successfully');
    }

    /**
     * Clear old demo layouts to ensure clean setup
     */
    clearOldDemoLayouts()
    {


        // Remove any existing demo layouts and clear all saved layouts to start fresh
        // This ensures old layouts with individual cell data don't interfere with spanning
        this.savedLayouts = [];
        this.saveSavedLayouts();


    }

    /**
     * Log all available components in the DOM for debugging
     */
    logAvailableComponents()
    {


        // Check for each expected component
        const expectedComponents = ['patient-panel', 'voice-interface', 'monitoring-panel', 'vtk-viewer', 'image-viewer', 'dicom-viewer'];

        expectedComponents.forEach(componentId =>
        {
            const element = document.getElementById(componentId);
            if (element)
            {

            } else
            {

            }
        });

        // Check all elements with relevant IDs
        const allElements = document.querySelectorAll('[id]');
        const relevantElements = Array.from(allElements).filter(el =>
            el.id.includes('panel') ||
            el.id.includes('viewer') ||
            el.id.includes('interface') ||
            el.id.includes('monitoring')
        );



    }

    /**
     * Update the reopen button state based on available closed programs
     */
    updateReopenButtonState()
    {
        const reopenBtn = document.getElementById('reopen-btn');
        if (reopenBtn)
        {
            reopenBtn.disabled = this.closedPrograms.length === 0;
        }
    }

    /**
     * Show reopen overlay for selecting closed programs and target positions
     */
    showReopenOverlay()
    {
        if (this.closedPrograms.length === 0)
        {
            this.showFeedback('No closed programs to reopen', 'warning');
            return;
        }

        this.selectedClosedProgram = null;
        this.selectedReopenCells.clear();
        this.updateReopenOverlay();
        this.updateReopenConfirmButton();

        const overlay = document.getElementById('reopen-overlay');
        if (overlay)
        {
            overlay.classList.add('show');
        }
    }

    /**
     * Hide reopen overlay
     */
    hideReopenOverlay()
    {
        const overlay = document.getElementById('reopen-overlay');
        if (overlay)
        {
            overlay.classList.remove('show');
        }
        this.selectedClosedProgram = null;
        this.selectedReopenCells.clear();
    }

    /**
     * Update reopen overlay to show current state
     */
    updateReopenOverlay()
    {
        this.updateClosedProgramsList();
        this.updateReopenCells();
    }

    /**
     * Update the list of closed programs
     */
    updateClosedProgramsList()
    {
        const closedProgramsList = document.getElementById('closed-programs-list');
        if (!closedProgramsList) return;

        closedProgramsList.innerHTML = '';

        if (this.closedPrograms.length === 0)
        {
            closedProgramsList.innerHTML = '<p style="color: #94a3b8; margin: 0;">No closed programs</p>';
            return;
        }

        this.closedPrograms.forEach(closedProgram =>
        {
            const item = document.createElement('div');
            item.className = 'closed-program-item';
            item.dataset.program = closedProgram.program;
            item.textContent = closedProgram.displayName;

            if (this.selectedClosedProgram === closedProgram.program)
            {
                item.classList.add('selected');
            }

            closedProgramsList.appendChild(item);
        });
    }

    /**
     * Update reopen cells to show current cell states
     */
    updateReopenCells()
    {
        const reopenCells = document.querySelectorAll('.reopen-cell');

        reopenCells.forEach(cell =>
        {
            const position = cell.dataset.target;

            // Clear previous states
            cell.classList.remove('occupied', 'selected');

            // Mark occupied cells
            if (this.cellContents.get(position))
            {
                cell.classList.add('occupied');
            }
            // Mark selected cells
            else if (this.selectedReopenCells.has(position))
            {
                cell.classList.add('selected');
            }
        });
    }

    /**
     * Select a closed program
     */
    selectClosedProgram(programName)
    {
        this.selectedClosedProgram = programName;
        this.selectedReopenCells.clear(); // Clear cell selection when changing program
        this.updateReopenOverlay();
        this.updateReopenConfirmButton();
    }

    /**
     * Toggle selection of a cell in the reopen overlay
     */
    toggleReopenCellSelection(targetPosition)
    {
        // Can't select occupied cells
        if (this.cellContents.get(targetPosition))
        {
            return;
        }

        // Toggle selection
        if (this.selectedReopenCells.has(targetPosition))
        {
            this.selectedReopenCells.delete(targetPosition);
        }
        else
        {
            this.selectedReopenCells.add(targetPosition);
        }

        // Update visual state and confirm button
        this.updateReopenCells();
        this.updateReopenConfirmButton();
    }

    /**
     * Update the confirm button state based on selection
     */
    updateReopenConfirmButton()
    {
        const confirmBtn = document.getElementById('reopen-confirm-btn');
        if (confirmBtn)
        {
            const hasProgram = this.selectedClosedProgram !== null;
            const hasCells = this.selectedReopenCells.size > 0;
            confirmBtn.disabled = !hasProgram || !hasCells;

            if (hasProgram && hasCells)
            {
                const cellCount = this.selectedReopenCells.size;
                const programName = this.closedPrograms.find(cp => cp.program === this.selectedClosedProgram)?.displayName || this.selectedClosedProgram;
                confirmBtn.textContent = `Reopen ${programName} (${cellCount} cell${cellCount > 1 ? 's' : ''})`;
            }
            else
            {
                confirmBtn.textContent = 'Reopen Here';
            }
        }
    }

    /**
     * Confirm and execute the reopen operation
     */
    confirmReopen()
    {
        if (!this.selectedClosedProgram || this.selectedReopenCells.size === 0)
        {
            return;
        }

        const targetPositions = Array.from(this.selectedReopenCells);
        const closedProgramData = this.closedPrograms.find(cp => cp.program === this.selectedClosedProgram);

        if (!closedProgramData)
        {
            this.showFeedback('Selected program not found in closed programs list', 'error');
            return;
        }

        try
        {
            // Reopen the program
            this.openProgram(closedProgramData.program, targetPositions);

            // Remove from closed programs list
            this.closedPrograms = this.closedPrograms.filter(cp => cp.program !== this.selectedClosedProgram);
            this.updateReopenButtonState();

            const cellText = targetPositions.length === 1 ? 'cell' : 'cells';
            this.showFeedback(
                `Reopened ${closedProgramData.displayName} in ${targetPositions.length} ${cellText}`,
                'success'
            );
        }
        catch (error)
        {
            console.error('Error executing reopen:', error);
            this.showFeedback('Error reopening program', 'error');
        }

        this.hideReopenOverlay();
    }

    /**
     * Initialize VTK viewer functionality in a grid cell
     */
    initializeVtkViewerInCell(position)
    {
        console.log('🎯 Initializing VTK viewer functionality in position:', position);

        // Initialize VTK viewer and load CPO_ist.vtk by default
        setTimeout(() =>
        {
            const vtkContainer = document.querySelector(`#content-${position} .vtk-viewer`);
            if (vtkContainer)
            {
                // Ensure the VTK container has proper dimensions
                vtkContainer.style.width = '100%';
                vtkContainer.style.height = '100%';
                vtkContainer.style.minHeight = '400px';
                vtkContainer.style.position = 'relative';

                console.log('🎯 VTK container setup for position:', position);
                console.log('🎯 Container dimensions before init:', {
                    width: vtkContainer.offsetWidth,
                    height: vtkContainer.offsetHeight
                });

                // Initialize VTK viewer in this cell
                const vtkViewer = new VtkViewer(
                    vtkContainer,
                    (message, level) => this.alertManager?.showAlert(message, level)
                );

                // Store reference globally so main app can access it
                window.activeVtkViewer = vtkViewer;
                console.log('🎯 VtkViewer instance stored globally:', vtkViewer);

                // Force a resize after a brief delay to ensure proper container sizing
                setTimeout(() =>
                {
                    if (vtkViewer && vtkViewer.resize)
                    {
                        vtkViewer.resize();
                        console.log('🎯 VTK viewer resized for grid cell');
                    }
                }, 100);

                // The VTK viewer will automatically load CPO_ist.vtk due to our earlier changes
            } else
            {
                console.error('Could not find .vtk-viewer for VTK viewer in position:', position);
            }
        }, 500);
    }

    /**
     * Initialize Image viewer functionality in a grid cell
     */
    initializeImageViewerInCell(position)
    {
        console.log(`Initializing Image viewer in cell: ${position}`);

        // Initialize Image viewer and load first image by default
        setTimeout(() =>
        {
            const imageContainer = document.querySelector(`#content-${position} .image-viewer-container`);
            if (imageContainer)
            {
                // Ensure the Image container has proper dimensions
                imageContainer.style.width = '100%';
                imageContainer.style.height = '100%';
                imageContainer.style.minHeight = '400px';
                imageContainer.style.position = 'relative';
                imageContainer.style.overflow = 'hidden';

                // Initialize the Image viewer
                const imageViewer = new ImageViewer(
                    imageContainer,
                    (message, level) => this.alertManager?.showAlert(message, level)
                );
                window.activeImageViewer = imageViewer;

                // Wait for initialization to complete
                setTimeout(() =>
                {
                    if (imageViewer && imageViewer.refreshImageList)
                    {
                        imageViewer.refreshImageList();
                        console.log('🎯 Image viewer refreshed for grid cell');
                    }
                }, 100);

                // The Image viewer will automatically load first image after refresh
            } else
            {
                console.error('Could not find .image-viewer-container for Image viewer in position:', position);
            }
        }, 500);
    }

    /**
     * Initialize DICOM viewer functionality in a grid cell
     */
    initializeDicomViewerInCell(position)
    {
        console.log('🎯 Initializing DICOM viewer functionality in position:', position);

        // Initialize DICOM viewer if needed
        setTimeout(() =>
        {
            // Find the panel content container which contains the .dicom-viewer element
            const panelContent = document.querySelector(`#content-${position} .panel-content`);
            if (panelContent)
            {
                // Initialize DICOM viewer in this cell, passing the panel-content container
                const dicomViewer = new DicomViewer(
                    panelContent,
                    (message, level) => this.alertManager?.showAlert(message, level)
                );
            } else
            {
                console.error('Could not find .panel-content for DICOM viewer in position:', position);
            }
        }, 500);
    }

    /**
     * Initialize monitoring panel functionality in a grid cell
     */
    initializeMonitoringPanelInCell(position)
    {
        console.log('🎯 Initializing monitoring panel functionality in position:', position);

        // Initialize charts in this cell
        setTimeout(() =>
        {
            const cellContent = document.querySelector(`#content-${position}`);
            if (cellContent)
            {
                const chartCanvas = cellContent.querySelector('#vitalsChart');
                if (chartCanvas && window.vitalsChartManager)
                {
                    // Reinitialize the chart for this specific cell
                    window.vitalsChartManager.initializeInCell(cellContent);
                } else
                {
                    console.log('Chart canvas or vitals chart manager not found in cell:', position);
                }
            }
        }, 100);
    }
} 