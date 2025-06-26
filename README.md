✨ OR Voice‑Agent MVP – Quick Start

This README.md gets you from zero to a working voice loop demo that answers:

“What is the patient’s most recent creatinine level ?”

Everything runs locally on a laptop (macOS, Windows, or Linux) with no external OR hardware.

0. Feature snapshot

What works

How it’s done

👉 Record voice → text

MediaRecorder API in the browser

✍️ Whisper speech‑to‑text

whispercpp base model (CPU) inside FastAPI

🧠 LLM reasoning

Google Gemini 1.5 Pro via REST

🔊 Speak the answer

speechSynthesis browser API

🖥️ Visual feedback

Simple HTML page shows transcript + answer

🔗 Data

Local mock_data.json file

1. Prerequisites

Tool

Min version

Install

Python

3.9

https://www.python.org/downloads/

Node.js

18 LTS

https://nodejs.org/

Git

any

https://git-scm.com/

💡 No GPU required – Whisper base runs ~real‑time on modern CPUs.

2. Project structure

voice‑agent‑mvp/
├─ backend/
│  ├─ app.py           # FastAPI server
│  ├─ requirements.txt # Python deps
│  └─ mock_data.json   # Patient & lab values
├─ frontend/
│  ├─ index.html
│  └─ main.js
├─ .env.example        # Rename to .env with your Gemini key
└─ README.md           # this file

3. Back‑end setup

cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

3.1 Environment variables

1. Copy .env.example to .env in project root.
2. Add your Google API key:

GEMINI_API_KEY=ya29.****

3.2 Run the server

uvicorn app:app --reload --port 8000

Backend now listens on http://localhost:8000.

4. Front‑end setup

cd frontend
npm install
npm run dev   # Vite dev server on http://localhost:5173

First launch will ask for microphone permission.

5. Try it out

Open http://localhost:5173 in Chrome/Edge.

Click Record and ask

“What is the patient’s most recent creatinine level ?”

Click Stop.

In ≤ 3 seconds you should see and hear

“The creatinine is 1.4 milligrams per decilitre, taken on 20 June 2025.”

6. Customising mock data

Edit backend/mock_data.json

{
  "patientId": "demo-001",
  "labs": {
    "creatinine": { "value": 1.4, "unit": "mg/dL", "date": "2025-06-20" },
    "act":        { "value": 240, "unit": "s",    "date": "2025-06-25" }
  }
}

Add more labs → Gemini will answer them without code changes.

7. Prompt template (in app.py)

SYSTEM_PROMPT = """
You are a sterile‑field OR voice assistant. Answer strictly from the JSON provided.
Format short verbal answers plus one‑line textual display.
"""

Adjust to include new commands or guardrails.

8. Next steps

Goal

Change

Support multiple questions

Keep /ask but feed whole mock_data to Gemini – it picks relevant fields.

Live partial transcript

Replace HTTP POST with WebSocket; stream Whisper partials.

Higher‑quality TTS

Swap browser synthesis for Google TTS (texttospeech_v1).

Real hospital data

Replace get_lab() stub with FHIR call, PACS for images.

9. Troubleshooting

Issue

Fix

Whisper install failures

brew install whispercpp (mac) or pip install whispercpp wheel needs CMake.

Gemini 403 / quota

Ensure billing enabled and model name gemini-pro or gemini-1.5-pro-latest.

Browser TTS silent