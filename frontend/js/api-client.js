/**
 * Centralized API Client for all backend communication
 */

// Backend API base URL
const API_BASE_URL = window.API_BASE_URL || (import.meta.env?.VITE_API_URL || 'http://localhost:8000');

export class ApiClient
{
    constructor()
    {
        this.baseUrl = API_BASE_URL;
    }

    /**
     * Transcribe audio to text
     */
    async transcribeAudio(audioBlob, procedureType)
    {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('procedure_type', procedureType);

        const response = await fetch(`${this.baseUrl}/transcribe`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok)
        {
            throw new Error('Transcription failed');
        }

        return await response.json();
    }

    /**
     * Process voice command or text query
     */
    async processCommand(transcript, procedureType, commandType = 'query')
    {
        const response = await fetch(`${this.baseUrl}/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transcript: transcript,
                procedure_type: procedureType,
                command_type: commandType
            })
        });

        if (!response.ok)
        {
            throw new Error('Command processing failed');
        }

        return await response.json();
    }

    /**
     * Load procedure-specific data
     */
    async loadProcedureData(procedureType)
    {
        const response = await fetch(`${this.baseUrl}/procedures/${procedureType}`);

        if (!response.ok)
        {
            throw new Error('Failed to load procedure data');
        }

        return await response.json();
    }

    /**
     * Load mock data for fallback
     */
    async loadMockData()
    {
        const response = await fetch(`${this.baseUrl}/mock-data`);

        if (!response.ok)
        {
            throw new Error('Failed to load mock data');
        }

        return await response.json();
    }

    /**
     * Get VTK file list
     */
    async getVtkFileList()
    {
        const response = await fetch(`${this.baseUrl}/vtk-files`);

        if (!response.ok)
        {
            throw new Error('Failed to get VTK file list');
        }

        return await response.json();
    }

    /**
     * Get DICOM series list
     */
    async getDicomSeriesList()
    {
        const response = await fetch(`${this.baseUrl}/dicom-series`);

        if (!response.ok)
        {
            throw new Error('Failed to get DICOM series list');
        }

        return await response.json();
    }

    /**
     * Generic GET request
     */
    async get(endpoint)
    {
        const response = await fetch(`${this.baseUrl}${endpoint}`);

        if (!response.ok)
        {
            throw new Error(`GET request failed: ${endpoint}`);
        }

        return await response.json();
    }

    /**
     * Generic POST request
     */
    async post(endpoint, data)
    {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok)
        {
            throw new Error(`POST request failed: ${endpoint}`);
        }

        return await response.json();
    }
} 