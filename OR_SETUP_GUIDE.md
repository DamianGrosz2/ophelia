# OR Voice Assistant - Complete Setup Guide

## 🏥 Overview

This voice assistant is specifically designed for operating room environments, focusing on:
- **PAD Angioplasty** (Peripheral Arterial Disease) procedures using mobile C-arm
- **EP Ablation** (Electrophysiology) procedures in catheterization labs

## 📋 Prerequisites

### Required Software
- **Python 3.9+** - Backend processing
- **Node.js 18+** - Frontend development
- **Git** - Version control

### Recommended Free LLM Option
- **Ollama** - Local LLM runtime (best performance, completely free)
  - Install from: https://ollama.ai
  - Run: `ollama pull llama2` (or other models)

## 🚀 Quick Start

### 1. Project Setup
```bash
# Clone or initialize project
cd your-project-directory

# Create virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate     # Windows

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Configuration
```bash
# Copy environment template
cp env_example.txt .env

# Edit .env with your preferences:
# - Use Ollama for free local LLM
# - Configure Brainlab endpoints when available
# - Set procedure preferences
```

### 3. Start the System
```bash
# Terminal 1: Start backend
cd backend
uvicorn app:app --reload --port 8000

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### 4. Access the Application
- Open: http://localhost:5173
- Grant microphone permissions when prompted
- Select procedure type (PAD Angioplasty or EP Ablation)

## 🎤 Voice Commands

### Data Queries
- "What is the patient's creatinine level?"
- "Show me the contrast usage"
- "What are the patient allergies?"
- "What is the current INR value?"
- "Tell me about the patient's medical history"

### Display Controls
- "Show lab results on the left screen"
- "Display imaging on center display"
- "Show vitals on the right screen"
- "Zoom into the aorta"
- "Place contrast data on left panel"

### Procedure-Specific Commands

#### PAD Angioplasty
- "How much contrast have we used?"
- "What's the fluoroscopy time?"
- "Show me the vessel anatomy"
- "What's the radiation dose?"

#### EP Ablation
- "What are the electrolyte levels?"
- "Show me the ablation parameters"
- "What's the mapping status?"
- "Display the ECG rhythm"

## 📊 Critical Data Integration

### PAD Angioplasty Data
#### Pre-operative
- Patient demographics and medical history
- Laboratory values (creatinine, platelets, INR)
- Imaging results (CT angiography, ABI)
- Medications and allergies

#### Intra-operative
- Real-time vitals monitoring
- Contrast usage tracking
- Fluoroscopy time and radiation dose
- Device specifications and procedural notes

### EP Ablation Data
#### Pre-operative
- Cardiac history and arrhythmia details
- ECG data and electrolyte levels
- Imaging (echo, cardiac CT)
- Anticoagulation status

#### Intra-operative
- Electrophysiology mapping data
- Ablation parameters (power, temperature, contact force)
- Real-time cardiac monitoring
- Procedural milestones tracking

## 🔧 LLM Configuration

### Free Options (Recommended)

#### 1. Ollama (Best)
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull models
ollama pull llama2        # General purpose
ollama pull codellama     # Code understanding
ollama pull mistral       # Alternative option

# The app will automatically detect and use Ollama
```

#### 2. HuggingFace Transformers (Fallback)
- Automatically downloads lightweight models
- Runs on CPU (no GPU required)
- Good for basic queries

### Paid Options

#### Google Gemini
```bash
# Set in .env
GEMINI_API_KEY=your_api_key_here
```

## 🔗 Brainlab Integration

When Brainlab data becomes available:

### API Configuration
```bash
# In .env file
BRAINLAB_API_ENDPOINT=https://your-brainlab-instance/api
BRAINLAB_API_KEY=your_api_key
```

### Data Mapping
The system supports direct integration with:
- Patient data from Brainlab patient management
- OR schedule from Brainlab planning system
- Real-time procedural data from compatible devices

## 🖥️ Display Control System

### Voice-Activated Commands
The system supports multi-screen OR environments:

```javascript
// Example display commands
"Show lab results on left screen"     → Left monitor displays labs
"Display imaging on center"           → Center screen shows images  
"Move vitals to right panel"          → Right monitor shows vitals
"Zoom into aorta 2x"                 → Magnify specific anatomy
```

### Mixed Reality (MR) Support
Framework ready for MR headset integration:
- HoloLens 2 compatibility planned
- Voice commands for 3D data visualization
- Hands-free interaction in sterile field

## 🚨 Safety Features

### Alert System
- **Info**: Normal data queries and confirmations
- **Warning**: Allergies, contraindications, dose limits
- **Critical**: Emergency situations, equipment failures

### Medical Safeguards
- Allergy checking before procedures
- Contrast dose monitoring with automatic alerts
- Radiation exposure tracking
- Anticoagulation status verification

## 📱 User Interface

### Three-Panel Layout
1. **Left Panel**: Patient data, labs, allergies
2. **Center Panel**: Voice interface and commands
3. **Right Panel**: Real-time monitoring and charts

### Voice Interaction
- Large microphone button for easy activation
- Real-time transcript display
- Audio feedback with text-to-speech
- Visual alerts and confirmations

## 🔧 Troubleshooting

### Common Issues

#### Microphone Not Working
- Check browser permissions for microphone access
- Ensure HTTPS or localhost (required for Web Audio API)
- Test with different browsers (Chrome/Edge recommended)

#### Backend Connection Issues
- Verify backend is running on port 8000
- Check CORS settings if accessing from different domain
- Ensure Python dependencies are installed correctly

#### LLM Not Responding
- For Ollama: Check if service is running (`ollama list`)
- For HuggingFace: Verify internet connection for model downloads
- Check backend logs for error messages

#### Audio Processing Slow
- Consider using smaller Whisper model for faster processing
- Ensure adequate CPU resources
- Use local Ollama instead of cloud APIs

### Performance Optimization

#### For Low-Resource Environments
```python
# In backend/app.py, use smaller models:
WHISPER_MODEL = "tiny"  # Instead of "base"
LLM_MODEL = "mistral:7b"  # Smaller Ollama model
```

#### For High-Performance Setups
```python
# Use larger, more accurate models:
WHISPER_MODEL = "medium"
LLM_MODEL = "llama2:70b"  # Larger Ollama model
```

## 📈 Future Enhancements

### Planned Features
1. **Real-time Device Integration**
   - C-arm image overlay with voice annotations
   - EP mapping system direct integration
   - Vital signs monitor data feeds

2. **Advanced Voice Processing**
   - Continuous listening mode
   - Multi-language support
   - Background noise filtering for OR environment

3. **Enhanced Medical Intelligence**
   - Clinical decision support
   - Drug interaction checking
   - Procedure-specific guidance protocols

4. **Extended Hardware Support**
   - Mixed reality headset integration
   - Foot pedal controls for hands-free operation
   - Integration with OR lighting and positioning systems

## 📞 Support

For technical support or feature requests:
- Review the troubleshooting section above
- Check backend logs for detailed error messages
- Ensure all dependencies are properly installed
- Test with demo data before connecting live medical systems

## ⚠️ Medical Disclaimer

This system is designed for surgical assistance and information display. Always verify critical medical data through primary sources and follow established medical protocols. This tool should supplement, not replace, clinical judgment and standard operating procedures. 