import os
import json
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager
import uvicorn

# Audio processing
import soundfile as sf
import numpy as np
from io import BytesIO

# LLM options
import google.generativeai as genai

# Text-to-Speech and Speech-to-Text via OpenAI APIs
from openai import OpenAI

# Optional Whisper import for local STT (not required on Railway)
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    whisper = None  # type: ignore
    from loguru import logger
    logger.warning("Whisper package not found – falling back to OpenAI Whisper API")

# Logging
from loguru import logger

# Load environment variables
from dotenv import load_dotenv

# Load .env file from the current directory - force override
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path, override=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting OR Voice Assistant...")
    load_mock_data()
    initialize_whisper()
    initialize_llm()
    initialize_tts()
    logger.info("OR Voice Assistant ready!")
    yield
    # Shutdown (if needed)
    logger.info("Shutting down OR Voice Assistant...")

app = FastAPI(title="OR Voice Assistant", version="1.0.0", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models (Railway-optimized)
whisper_model = None
gemini_model = None
openai_client = None
mock_data = None

class VoiceRequest(BaseModel):
    transcript: Optional[str] = None
    procedure_type: str
    command_type: str = "query"  # query, control, alert

class VoiceResponse(BaseModel):
    transcript: str
    response: str
    visual_data: Optional[Dict] = None
    display_commands: Optional[List[str]] = None
    alert_level: str = "info"  # info, warning, critical
    audio_url: Optional[str] = None  # URL to generated speech audio

class DisplayCommand(BaseModel):
    action: str  # show, hide, move, zoom, highlight
    target: str  # lab_results, imaging, vitals, etc.
    position: Optional[str] = None  # left, right, center
    data: Optional[Dict] = None

# Load mock data
def load_mock_data():
    global mock_data
    try:
        with open("mock_data.json", "r") as f:
            mock_data = json.load(f)
        logger.info("Mock data loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load mock data: {e}")
        mock_data = {}

# Initialize Whisper (prefer OpenAI API, fallback to local)
def initialize_whisper():
    global whisper_model
    
    # Check if OpenAI API is available (preferred for cloud deployment)
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key and openai_key != "your_openai_api_key_here":
        logger.info("Using OpenAI Whisper API for speech-to-text")
        whisper_model = "openai_api"
        return
    
    # Fallback to local Whisper if available
    if WHISPER_AVAILABLE:
        try:
            whisper_model = whisper.load_model("base")
            logger.info("Local Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load local Whisper model: {e}")
            whisper_model = None
    else:
        logger.warning("No speech-to-text available - Whisper disabled")
        whisper_model = None

# Initialize LLM (Gemini cloud API only - Railway optimized)
def initialize_llm():
    global gemini_model
    
    # Try Gemini (cloud API - preferred for production)
    try:
        # Force reload environment variables
        from dotenv import load_dotenv
        env_path = os.path.join(os.path.dirname(__file__), '.env')
        load_dotenv(dotenv_path=env_path, override=True)
        
        api_key = os.getenv("GEMINI_API_KEY")
        
        # Debug: Check if .env file exists and what we're loading
        print(f"Loading .env from: {env_path}")
        print(f"File exists: {os.path.exists(env_path)}")
        print(f"Raw API key value: {repr(api_key)}")
        print(f"API key starts with: {api_key[:10] + '...' if api_key and len(api_key) > 10 else api_key}")
        
        if api_key and api_key.strip() and api_key != "your_gemini_api_key_here":
            genai.configure(api_key=api_key)
            gemini_model = genai.GenerativeModel('gemini-2.5-flash')
            logger.info("Gemini model initialized successfully")
            return
        else:
            logger.warning("GEMINI_API_KEY not found - using rule-based fallback")
    except Exception as e:
        logger.warning(f"Gemini not available: {e} - using rule-based fallback")

# Initialize OpenAI TTS
def initialize_tts():
    global openai_client
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key and api_key != "your_openai_api_key_here":
            openai_client = OpenAI(api_key=api_key)
            logger.info("OpenAI TTS initialized successfully")
        else:
            logger.warning("OPENAI_API_KEY not found - TTS disabled")
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI TTS: {e}")
        openai_client = None

# Generate speech from text
async def generate_speech(text: str, voice: str = "nova") -> Optional[str]:
    """Generate speech audio from text using OpenAI TTS"""
    if not openai_client:
        print("OpenAI TTS client is not initialized. Cannot generate speech.")
        return None

    try:
        print(f"Generating speech for text: {text[:100]}... (truncated)" if len(text) > 100 else f"Generating speech for text: {text}")
        print(f"Using voice: {voice}")

        # Create a temporary file for the audio
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            temp_path = temp_file.name
        logger.debug(f"Temporary audio file created at: {temp_path}")

        # Generate speech
        response = openai_client.audio.speech.create(
            model="gpt-4o-mini-tts", 
            voice=voice,  # nova, alloy, echo, fable, onyx, shimmer
            input=text,
            response_format="mp3"
        )
        print("Speech synthesis request sent to OpenAI TTS API.")

        # Save audio to file
        response.stream_to_file(temp_path)
        print(f"Audio file saved to: {temp_path}")

        # Return path to the audio file
        return temp_path

    except Exception as e:
        logger.error(f"TTS generation error: {e}")
        return None

# System prompts for different procedures
SYSTEM_PROMPTS = {
    "pad_angioplasty": """
    You are a sterile-field OR voice assistant for Peripheral Arterial Disease (PAD) angioplasty procedures.
    Your role is to provide concise, accurate information about patient data, procedural parameters, and safety alerts.
    
    Key responsibilities:
    - Provide patient lab values, imaging results, and vital signs
    - Monitor contrast usage and radiation exposure
    - Alert about contraindications and allergies
    - Support procedural decision-making with relevant data
    - Execute display commands for visual information
    - Control 3D visualization of VTK models and anatomical structures
    
    Available VTK/3D commands:
    - "Open VTK file" or "Load CPO model" - loads 3D visualization
    - "Zoom 3D model" - magnifies the 3D view
    - "Reset 3D view" - returns to default camera position
    - "Rotate view" - adjusts 3D orientation
    
    Available DICOM commands:
    - "Show DICOM images" or "Load medical scan" - displays medical images
    - "Next image" or "Previous image" - navigates through image series
    - "Load series [ID]" - loads specific DICOM series by ID
    
    Available Panel Control commands:
    - "Close patient panel" or "Hide patient" - closes patient information panel
    - "Close monitoring" or "Hide vitals" - closes procedural monitoring panel
    - "Close 3D panel" or "Hide VTK" - closes 3D visualization panel
    - "Close DICOM" or "Hide image panel" - closes DICOM viewer panel
    - "Open patient panel" or "Open monitoring" - reopens closed panels
    
    Always respond with short, clear medical language appropriate for the sterile field.
    Include relevant safety considerations in your responses.
    """,
    
    "ep_ablation": """
    You are a sterile-field OR voice assistant for Electrophysiology (EP) ablation procedures.
    Your role is to provide critical electrophysiology data, procedural parameters, and safety information.
    
    Key responsibilities:
    - Provide cardiac history, ECG data, and electrolyte levels
    - Monitor ablation parameters and mapping progress
    - Alert about anticoagulation status and bleeding risks
    - Support procedural milestones and endpoint assessment
    - Execute display commands for cardiac data visualization
    - Control 3D visualization of cardiac structures and mapping data
    
    Available VTK/3D commands:
    - "Show 3D heart model" - displays cardiac anatomy
    - "Zoom ablation sites" - focuses on specific regions
    - "Reset cardiac view" - returns to standard orientation
    
    Available DICOM commands:
    - "Show cardiac images" or "Load heart scan" - displays cardiac imaging
    - "Next slice" or "Previous slice" - navigates through cardiac series
    - "Load cardiac CT" - loads specific cardiac imaging series
    
    Available Panel Control commands:
    - "Close patient panel" or "Hide patient" - closes patient information panel
    - "Close monitoring" or "Hide vitals" - closes procedural monitoring panel
    - "Close 3D panel" or "Hide VTK" - closes 3D visualization panel
    - "Close DICOM" or "Hide image panel" - closes DICOM viewer panel
    - "Open patient panel" or "Open monitoring" - reopens closed panels
    
    Always respond with precise EP terminology and include procedural safety considerations.
    """
}

# Parse voice commands and queries
def parse_command(transcript: str, procedure_type: str) -> Dict[str, Any]:
    transcript_lower = transcript.lower()
    
    # Display control commands
    display_commands = []
    
    if "show" in transcript_lower or "display" in transcript_lower:
        if "lab" in transcript_lower:
            display_commands.append({
                "action": "show",
                "target": "lab_results",
                "position": "left" if "left" in transcript_lower else "right" if "right" in transcript_lower else "center"
            })
        if "imaging" in transcript_lower or "image" in transcript_lower:
            display_commands.append({
                "action": "show", 
                "target": "imaging",
                "position": "center"
            })
        if "vital" in transcript_lower:
            display_commands.append({
                "action": "show",
                "target": "vitals", 
                "position": "right"
            })
        # VTK file commands
        if "vtk" in transcript_lower or "3d" in transcript_lower or "cpo" in transcript_lower:
            filename = "CPO_ist.vtk"
            if "cpo" in transcript_lower:
                filename = "CPO_ist.vtk"
            display_commands.append({
                "action": "show",
                "target": "vtk",
                "data": {"filename": filename}
            })
        # DICOM file commands
        if "dicom" in transcript_lower or "scan" in transcript_lower or ("image" in transcript_lower and "medical" in transcript_lower):
            # Extract series ID if mentioned, otherwise use default
            import re
            series_match = re.search(r'(\d{8})', transcript_lower)
            series_id = series_match.group(1) if series_match else "17155540"
            display_commands.append({
                "action": "show",
                "target": "dicom",
                "data": {"seriesId": series_id}
            })
    
    if "zoom" in transcript_lower:
        if "aorta" in transcript_lower:
            display_commands.append({
                "action": "zoom",
                "target": "aorta",
                "data": {"zoom_level": 2.0}
            })
        # 3D model zoom (in / out / factor)
        if "3d" in transcript_lower or "model" in transcript_lower:
            # Default zoom in factor
            zoom_level = 1.5
            if "2x" in transcript_lower:
                zoom_level = 2.0
            elif "3x" in transcript_lower:
                zoom_level = 3.0
            elif "zoom out" in transcript_lower or "out" in transcript_lower:
                # Factor <1 zooms out. Choose reciprocal of default 1.5
                zoom_level = 1/1.5
            display_commands.append({
                "action": "zoom",
                "target": "3d",
                "data": {"zoom_level": zoom_level}
            })
    
    if "reset" in transcript_lower and ("view" in transcript_lower or "3d" in transcript_lower):
        display_commands.append({
            "action": "reset",
            "target": "3d"
        })
    
    # DICOM navigation commands
    if "next" in transcript_lower and ("image" in transcript_lower or "slice" in transcript_lower):
        display_commands.append({
            "action": "next",
            "target": "dicom"
        })
    
    if "previous" in transcript_lower and ("image" in transcript_lower or "slice" in transcript_lower):
        display_commands.append({
            "action": "previous", 
            "target": "dicom"
        })
    
    # New: rotate 3D model left / right
    if "rotate" in transcript_lower and ("view" in transcript_lower or "3d" in transcript_lower or "model" in transcript_lower):
        direction = "left" if "left" in transcript_lower else "right" if "right" in transcript_lower else "left"
        angle = 15  # degrees per command
        display_commands.append({
            "action": "rotate",
            "target": "3d",
            "data": {"direction": direction, "angle": angle}
        })
    
    # Close/Hide panel commands
    if "close" in transcript_lower or "hide" in transcript_lower:
        if "patient" in transcript_lower:
            display_commands.append({
                "action": "close",
                "target": "patient"
            })
        elif "monitoring" in transcript_lower or "vitals" in transcript_lower:
            display_commands.append({
                "action": "close",
                "target": "monitoring"
            })
        elif "3d" in transcript_lower or "vtk" in transcript_lower:
            display_commands.append({
                "action": "close",
                "target": "3d"
            })
        elif "dicom" in transcript_lower or "image" in transcript_lower:
            display_commands.append({
                "action": "close",
                "target": "dicom"
            })
        elif "voice" in transcript_lower or "command" in transcript_lower:
            display_commands.append({
                "action": "close",
                "target": "voice"
            })
    
    # Open/Show panel commands
    if "open" in transcript_lower and "panel" in transcript_lower:
        if "patient" in transcript_lower:
            display_commands.append({
                "action": "open",
                "target": "patient"
            })
        elif "monitoring" in transcript_lower or "vitals" in transcript_lower:
            display_commands.append({
                "action": "open",
                "target": "monitoring"
            })
        elif "3d" in transcript_lower or "vtk" in transcript_lower:
            display_commands.append({
                "action": "open",
                "target": "3d"
            })
        elif "dicom" in transcript_lower or "image" in transcript_lower:
            display_commands.append({
                "action": "open",
                "target": "dicom"
            })
        elif "voice" in transcript_lower or "command" in transcript_lower:
            display_commands.append({
                "action": "open",
                "target": "voice"
            })
    
    # Determine command type
    command_type = "query"
    if display_commands:
        command_type = "control"
    if "alert" in transcript_lower or "warning" in transcript_lower:
        command_type = "alert"
    
    return {
        "command_type": command_type,
        "display_commands": display_commands,
        "query": transcript
    }

# Get LLM response using available model
async def get_llm_response(prompt: str) -> str:
    try:
        # Try Gemini (cloud API)
        if gemini_model:
            try:
                response = gemini_model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                logger.warning(f"Gemini error: {e}")
        
        # Fallback to rule-based responses (no local ML models for Railway)
        logger.info("Using rule-based fallback response")
        return generate_rule_based_response(prompt)
        
    except Exception as e:
        logger.error(f"LLM response error: {e}")
        return generate_rule_based_response(prompt)

# Rule-based response system as fallback
def generate_rule_based_response(query: str) -> str:
    query_lower = query.lower()
    
    if not mock_data:
        return "Medical data is not available at this time."
    
    # VTK and 3D visualization queries
    if "vtk" in query_lower or "3d" in query_lower or "cpo" in query_lower:
        if "open" in query_lower or "load" in query_lower or "show" in query_lower:
            return "Loading VTK file for 3D visualization. The model will appear in the 3D viewer panel."
        elif "zoom" in query_lower:
            return "Zooming 3D model view. Use voice commands to control the visualization."
        elif "reset" in query_lower:
            return "Resetting 3D view orientation to default position."
        elif "rotate" in query_lower:
            return "Rotating 3D model view. Use voice commands to control the orientation."
    
    # DICOM medical imaging queries
    if "dicom" in query_lower or "scan" in query_lower or ("image" in query_lower and any(word in query_lower for word in ["medical", "ct", "mri", "xray", "x-ray"])):
        if "open" in query_lower or "load" in query_lower or "show" in query_lower:
            return "Loading DICOM medical images. The images will appear in the DICOM viewer panel. Use mouse wheel or voice commands to navigate through the series."
        elif "next" in query_lower:
            return "Moving to next DICOM image in the series."
        elif "previous" in query_lower or "prev" in query_lower:
            return "Moving to previous DICOM image in the series."
        elif "series" in query_lower:
            return "DICOM series contains multiple medical images. Use navigation commands to scroll through them."
    
    # Panel close/hide commands
    if "close" in query_lower or "hide" in query_lower:
        if "patient" in query_lower:
            return "Closing patient information panel."
        elif "monitoring" in query_lower or "vitals" in query_lower:
            return "Closing procedural monitoring panel."
        elif "3d" in query_lower or "vtk" in query_lower:
            return "Closing 3D visualization panel."
        elif "dicom" in query_lower or "image" in query_lower:
            return "Closing DICOM viewer panel."
        elif "voice" in query_lower or "command" in query_lower:
            return "Closing voice command panel."
        else:
            return "Please specify which panel to close: patient, monitoring, 3D, DICOM, or voice."
    
    # Panel open commands
    if "open" in query_lower and "panel" in query_lower:
        if "patient" in query_lower:
            return "Opening patient information panel."
        elif "monitoring" in query_lower or "vitals" in query_lower:
            return "Opening procedural monitoring panel."
        elif "3d" in query_lower or "vtk" in query_lower:
            return "Opening 3D visualization panel."
        elif "dicom" in query_lower or "image" in query_lower:
            return "Opening DICOM viewer panel."
        elif "voice" in query_lower or "command" in query_lower:
            return "Opening voice command panel."
        else:
            return "Please specify which panel to open: patient, monitoring, 3D, DICOM, or voice."
    
    # PAD-specific queries
    if "creatinine" in query_lower:
        for procedure in mock_data.get("procedures", {}).values():
            if "labs" in procedure.get("patient", {}):
                creat = procedure["patient"]["labs"].get("creatinine")
                if creat:
                    return f"Creatinine is {creat['value']} {creat['unit']}, eGFR {creat.get('egfr', 'not available')}. Consider contrast nephropathy risk."
    
    if "contrast" in query_lower:
        pad_data = mock_data.get("procedures", {}).get("pad_angioplasty", {})
        if pad_data:
            intraop = pad_data.get("intraopData", {})
            used = intraop.get("contrastUsed", 0)
            max_contrast = intraop.get("maxContrast", 100)
            return f"Contrast used: {used}mL of maximum {max_contrast}mL. {max_contrast - used}mL remaining."
    
    if "allerg" in query_lower:
        for procedure in mock_data.get("procedures", {}).values():
            allergies = procedure.get("patient", {}).get("allergies", [])
            if allergies:
                return f"Patient allergies: {', '.join(allergies)}. Use with caution."
    
    # EP-specific queries
    if "inr" in query_lower or "anticoag" in query_lower:
        for procedure in mock_data.get("procedures", {}).values():
            if "labs" in procedure.get("patient", {}):
                inr = procedure["patient"]["labs"].get("inr")
                if inr:
                    return f"INR is {inr['value']} on {inr['date']}. Patient is adequately anticoagulated."
    
    if "potassium" in query_lower or "electrolyte" in query_lower:
        ep_data = mock_data.get("procedures", {}).get("ep_ablation", {})
        if ep_data:
            labs = ep_data.get("patient", {}).get("labs", {})
            k = labs.get("potassium", {})
            mg = labs.get("magnesium", {})
            return f"Potassium: {k.get('value', 'N/A')} {k.get('unit', '')}, Magnesium: {mg.get('value', 'N/A')} {mg.get('unit', '')}. Electrolytes are within normal range."
    
    return "I can help you with patient data, lab values, procedural parameters, display controls, 3D visualization, and DICOM medical imaging. Please specify what information you need."



@app.get("/")
async def root():
    return {"message": "OR Voice Assistant API", "status": "running"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "whisper_loaded": whisper_model is not None,
        "gemini_loaded": gemini_model is not None,
        "llm_loaded": gemini_model is not None,
        "mock_data_loaded": mock_data is not None
    }

@app.post("/transcribe", response_model=VoiceResponse)
async def transcribe_audio(audio: UploadFile = File(...), procedure_type: str = "pad_angioplasty"):
    """Transcribe audio file using OpenAI Whisper API (preferred) or local Whisper"""
    try:
        if not whisper_model:
            raise Exception("Whisper not available")
        
        # Log the received file info
        logger.info(f"Received audio file: {audio.filename}, content_type: {audio.content_type}")
        
        # Read the uploaded audio file
        audio_bytes = await audio.read()
        
        # Use OpenAI Whisper API if available (preferred for cloud)
        if whisper_model == "openai_api" and openai_client:
            try:
                # Create a temporary file for OpenAI API
                import tempfile
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
                    temp_file.write(audio_bytes)
                    temp_file_path = temp_file.name
                
                try:
                    with open(temp_file_path, "rb") as audio_file:
                        transcript = openai_client.audio.transcriptions.create(
                            model="whisper-1",
                            file=audio_file
                        )
                    
                    transcript_text = transcript.text.strip()
                    print(f"🎤 TRANSCRIBED (OpenAI): {transcript_text}")
                    logger.info(f"OpenAI transcribed text: {transcript_text}")
                    
                    return VoiceResponse(
                        transcript=transcript_text,
                        response="Audio transcribed successfully",
                        alert_level="info"
                    )
                    
                finally:
                    # Clean up the temporary file
                    import os
                    if os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                        
            except Exception as e:
                logger.error(f"OpenAI Whisper API error: {e}")
                # Continue to local fallback
        
        # Local Whisper fallback (if available)
        if WHISPER_AVAILABLE and whisper_model != "openai_api":
            import tempfile
            import os
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name
            
            try:
                # Transcribe audio using local Whisper
                result = whisper_model.transcribe(temp_file_path)
                transcript = result["text"].strip()
                
                # Print the transcribed text
                print(f"🎤 TRANSCRIBED (Local): {transcript}")
                logger.info(f"Local transcribed text: {transcript}")
                
                return VoiceResponse(
                    transcript=transcript,
                    response="Audio transcribed successfully",
                    alert_level="info"
                )
                
            finally:
                # Clean up the temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
        
        # If we get here, no transcription method worked
        raise Exception("No transcription method available")
        
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        fallback_transcript = "What is the patient's creatinine level?"
        print(f"🎤 TRANSCRIBED (FALLBACK): {fallback_transcript}")
        logger.info(f"Fallback transcribed text: {fallback_transcript}")
        return VoiceResponse(
            transcript=fallback_transcript,
            response="Transcription service unavailable, using fallback",
            alert_level="warning"
        )

@app.post("/ask", response_model=VoiceResponse)
async def process_voice_command(request: VoiceRequest):
    """Process voice command and return response with visual data"""
    try:
        # Parse the command
        parsed = parse_command(request.transcript or "", request.procedure_type)
        
        # Build context-aware prompt
        system_prompt = SYSTEM_PROMPTS.get(request.procedure_type, SYSTEM_PROMPTS["pad_angioplasty"])
        
        # Add relevant patient data to context
        context_data = ""
        if mock_data and request.procedure_type in mock_data.get("procedures", {}):
            procedure_data = mock_data["procedures"][request.procedure_type]
            context_data = f"Current patient: {json.dumps(procedure_data, indent=2)}"
        
        full_prompt = f"{system_prompt}\n\nPatient Data:\n{context_data}\n\nQuery: {request.transcript}\n\nResponse:"
        print(f"🎤 FULL PROMPT: {full_prompt}")
        
        # Get LLM response
        llm_response = await get_llm_response(full_prompt)

        print(f"🎤 LLM RESPONSE: {llm_response}")
        
        print(f"🎤 AUDIO:")
        # Generate speech audio for the response
        audio_path = await generate_speech(llm_response, voice="alloy")
        
        # Prepare visual data based on query
        visual_data = None
        if "lab" in request.transcript.lower():
            if mock_data and request.procedure_type in mock_data.get("procedures", {}):
                visual_data = mock_data["procedures"][request.procedure_type].get("patient", {}).get("labs", {})
        
        # Determine alert level
        alert_level = "info"
        if "allerg" in request.transcript.lower() or "contraindic" in request.transcript.lower():
            alert_level = "warning"
        if "critical" in llm_response.lower() or "emergency" in llm_response.lower():
            alert_level = "critical"
        
        return VoiceResponse(
            transcript=request.transcript or "",
            response=llm_response,
            visual_data=visual_data,
            display_commands=parsed.get("display_commands"),
            alert_level=alert_level,
            audio_url=f"/audio/{os.path.basename(audio_path)}" if audio_path else None
        )
        
    except Exception as e:
        logger.error(f"Voice command processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Command processing failed: {str(e)}")

@app.get("/procedures/{procedure_type}")
async def get_procedure_data(procedure_type: str):
    """Get all data for a specific procedure"""
    if not mock_data or procedure_type not in mock_data.get("procedures", {}):
        raise HTTPException(status_code=404, detail="Procedure not found")
    
    return mock_data["procedures"][procedure_type]

@app.get("/mock-data")
async def get_mock_data():
    """Get all mock data"""
    if not mock_data:
        raise HTTPException(status_code=500, detail="Mock data not available")
    
    return mock_data

@app.get("/schedule")
async def get_or_schedule():
    """Get OR schedule information"""
    if not mock_data:
        raise HTTPException(status_code=500, detail="Schedule data not available")
    
    return mock_data.get("orSchedule", {})

@app.get("/audio/{filename}")
async def get_audio_file(filename: str):
    """Serve generated audio files"""
    import tempfile
    temp_dir = tempfile.gettempdir()
    file_path = os.path.join(temp_dir, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        file_path,
        media_type="audio/mpeg",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )

@app.get("/vtk/{filename}")
async def get_vtk_file(filename: str):
    """Serve VTK files for 3D visualization"""
    data_dir = os.path.join(os.path.dirname(__file__), "data", "vtk")
    file_path = os.path.join(data_dir, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="VTK file not found")
    
    # Validate file extension
    if not filename.lower().endswith(('.vtk', '.vtp', '.vtu')):
        raise HTTPException(status_code=400, detail="Invalid VTK file type")
    
    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )

@app.get("/vtk")
async def list_vtk_files():
    """List available VTK files"""
    data_dir = os.path.join(os.path.dirname(__file__), "data", "vtk")
    
    if not os.path.exists(data_dir):
        return {"files": []}
    
    vtk_files = []
    for file in os.listdir(data_dir):
        if file.lower().endswith(('.vtk', '.vtp', '.vtu')):
            vtk_files.append(file)
    
    return {"files": vtk_files}

@app.get("/dicom/file/{filename}")
async def get_dicom_file(filename: str):
    """Serve DICOM files for medical image viewing"""
    data_dir = os.path.join(os.path.dirname(__file__), "data", "dicom")
    file_path = os.path.join(data_dir, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="DICOM file not found")
    
    # DICOM files can have various extensions or no extension at all
    # We'll be more permissive here since DICOM files often just use numeric IDs
    
    return FileResponse(
        file_path,
        media_type="application/dicom",
        headers={
            "Content-Disposition": f"inline; filename={filename}",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Cache-Control": "no-cache"
        }
    )

@app.get("/dicom/series/{series_id}")
async def get_dicom_series(series_id: str):
    """Get list of DICOM files in a series"""
    data_dir = os.path.join(os.path.dirname(__file__), "data", "dicom")
    
    if not os.path.exists(data_dir):
        return {"files": [], "series_id": series_id}
    
    dicom_files = []
    all_files = [f for f in os.listdir(data_dir) if not f.startswith('.')]
    
    for file in all_files:
        # Include files based on series matching
        include_file = False
        
        if series_id == "general":
            # For general series, include all valid files
            if (file.lower().endswith(('.dicom', '.dcm')) or 
                file.isdigit() or
                any(char.isdigit() for char in file)):
                include_file = True
        else:
            # For specific series, match by series_id
            if (series_id in file or
                (file.isdigit() and file.startswith(series_id)) or
                file.lower().endswith(('.dicom', '.dcm'))):
                include_file = True
        
        if include_file:
            dicom_files.append(file)
    
    # Sort files numerically if they contain numbers
    try:
        dicom_files.sort(key=lambda x: int(''.join(filter(str.isdigit, x))))
    except:
        dicom_files.sort()
    
    return {"files": dicom_files, "series_id": series_id}

@app.get("/dicom")
async def list_dicom_series():
    """List available DICOM series"""
    data_dir = os.path.join(os.path.dirname(__file__), "data", "dicom")
    
    if not os.path.exists(data_dir):
        return {"series": []}
    
    files = [f for f in os.listdir(data_dir) if not f.startswith('.')]
    
    if not files:
        return {"series": []}
    
    series_set = set()
    
    for file in files:
        # Handle files with or without extensions
        if (file.lower().endswith(('.dicom', '.dcm')) or 
            file.isdigit() or
            any(char.isdigit() for char in file)):
            
            # Try to extract 8-digit series ID first
            import re
            series_match = re.search(r'(\d{8})', file)
            if series_match:
                series_set.add(series_match.group(1))
            elif file.isdigit():
                # For pure numeric files, group by first digits or use individual files
                if len(file) >= 8:
                    series_set.add(file[:8])
                else:
                    # For shorter numeric files, create a general series
                    series_set.add("general")
            else:
                # For files with mixed characters, try to extract any digit sequence
                digit_match = re.search(r'(\d+)', file)
                if digit_match:
                    digits = digit_match.group(1)
                    if len(digits) >= 8:
                        series_set.add(digits[:8])
                    else:
                        series_set.add("general")
    
    series_list = list(series_set)
    
    # If no series found, create a general series for all files
    if not series_list and files:
        series_list = ["general"]
    
    return {"series": series_list}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 