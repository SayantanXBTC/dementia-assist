# Dementia Assist — AI Memory Companion

Real-time face recognition system that helps dementia patients recognise people
and recall contextual memories about them.

---

## How It Works

1. The webcam continuously captures frames and runs them through a FaceNet model
2. Recognised faces are matched against a trained embedding database (`face_db.pkl`)
3. The system retrieves stored memories from Hindsight Cloud (or local JSON fallback)
4. The UI displays the person's name, relationship, notes, last-seen time, and a
   conversation suggestion tailored to what's stored in memory
5. Unknown people can be enrolled live — capture 5–10 photos, fill in their details,
   and they are immediately recognisable in the next scan cycle
6. Voice output announces who the person is when a new face is recognised

---

## Prerequisites

| Requirement | Minimum version |
|---|---|
| Python | 3.9+ |
| Node.js | 18+ |
| Webcam | any |
| Hindsight API key | optional (local fallback included) |

---

## Quick Start

### Linux / macOS

```bash
# 1. Clone the repo
git clone <repo-url>
cd dementia-assist

# 2. Place your trained face_db.pkl in the project root
#    (skip this step to start with an empty database)

# 3. Configure environment
cp .env.example .env
# Edit .env — add your Hindsight API key if you have one

# 4. Launch everything with one command
chmod +x run.sh
./run.sh
```

### Windows

```bat
run.bat
```

The script installs all dependencies, starts the Flask backend on port 5000,
and the Next.js frontend on port 3000 — then opens both in separate windows.

Open **http://localhost:3000** in your browser and allow webcam access.

---

## Manual Setup

### Backend

```bash
pip install -r requirements.txt
python app.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values.

| Variable | Description | Default |
|---|---|---|
| `HINDSIGHT_API_URL` | Hindsight Cloud base URL | `https://api.hindsight.vectorize.io` |
| `HINDSIGHT_API_KEY` | Your Hindsight Cloud bearer token | *(none — uses local JSON fallback)* |
| `HINDSIGHT_BANK_ID` | Memory namespace for this app | `dementia-assist` |
| `FLASK_DEBUG` | Flask debug mode | `True` |

Without `HINDSIGHT_API_KEY`, all memories are stored in `memory_store.json` in
the project root. This works fully offline with no sign-up required.

Sign up for Hindsight Cloud at https://ui.hindsight.vectorize.io/signup

---

## Training Your Own face_db.pkl

Collect 10–15 images per person in `dataset/<name>/` folders, then run:

```python
from deepface import DeepFace
import pickle, os

database = {}
for person in os.listdir("dataset"):
    person_dir = f"dataset/{person}"
    if not os.path.isdir(person_dir):
        continue
    embeddings = []
    for img_file in os.listdir(person_dir):
        if not img_file.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        try:
            result = DeepFace.represent(
                f"{person_dir}/{img_file}",
                model_name="Facenet",
                enforce_detection=True,
            )
            embeddings.append(result[0]["embedding"])
        except Exception as e:
            print(f"Skipped {img_file}: {e}")
    if embeddings:
        database[person] = embeddings
        print(f"  {person}: {len(embeddings)} embeddings")

with open("face_db.pkl", "wb") as f:
    pickle.dump(database, f)

print(f"\nSaved {len(database)} people to face_db.pkl")
```

Place `face_db.pkl` in the project root and (re)start the system.

---

## Adding New People Live

1. An unknown face appears on camera → the UI shows **"Unknown Person Detected"**
2. Click **"Add This Person"**
3. Fill in: Name, Relationship, Notes (optional)
4. Capture **5–10 photos** from different angles using the in-modal webcam
5. Click **"Save Person"**
6. The person is enrolled instantly — the next scan cycle will recognise them

---

## Testing the API

With the backend running:

```bash
python test_system.py
```

This runs a suite of smoke tests against all endpoints and prints a pass/fail
summary.  The script exits with code 0 on success, 1 on any failure.

---

## Project Structure

```
dementia-assist/
├── app.py                 # Flask REST API server
├── face_engine.py         # FaceNet embedding engine (DeepFace)
├── hindsight_memory.py    # Hindsight Cloud + local JSON memory
├── face_db.pkl            # Trained face embeddings (you provide this)
├── memory_store.json      # Local memory fallback (auto-created)
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variable template
├── .env                   # Your config (git-ignored)
├── test_system.py         # API smoke tests
├── run.sh                 # Linux/macOS startup script
├── run.bat                # Windows startup script
├── dataset/               # Training images (one sub-folder per person)
│   ├── person1/
│   ├── person2/
│   └── ...
└── frontend/              # Next.js 14 frontend
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   └── globals.css
    ├── components/
    │   ├── CameraPanel.tsx      # Webcam feed + 2s recognition loop
    │   ├── InfoPanel.tsx        # Recognition result display
    │   ├── AddPersonModal.tsx   # Live enrolment modal
    │   ├── PeopleSidebar.tsx    # Enrolled people list
    │   ├── StatusBar.tsx        # Backend health indicator
    │   └── Toast.tsx            # Notification system
    ├── lib/types.ts
    ├── next.config.js           # Proxies /api/* → localhost:5000
    └── package.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Face recognition | DeepFace + FaceNet (TensorFlow) |
| Memory storage | Hindsight Cloud / local JSON |
| Backend | Python 3.9+ · Flask · flask-cors |
| Frontend | Next.js 14 · TypeScript · Tailwind CSS |
| Voice output | Web Speech API (`window.speechSynthesis`) |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System status, people count, memory mode |
| `POST` | `/api/recognize` | Identify a person from a base64 webcam frame |
| `POST` | `/api/add-person` | Enrol a new person (face + memory) |
| `GET` | `/api/people` | List all enrolled people with memory details |

### POST /api/recognize

**Request**
```json
{ "image": "<base64 JPEG string>" }
```

**Response — recognised**
```json
{
  "status": "recognized",
  "name": "Sarah",
  "confidence": 0.87,
  "memory": {
    "relation": "Daughter",
    "notes": "Loves painting",
    "last_seen": "2025-04-17T10:30:00+00:00"
  },
  "suggestion": "Ask Sarah about their painting lately"
}
```

**Response — unknown / no face**
```json
{ "status": "unknown", "name": null, "confidence": 0.0, "memory": null, "suggestion": null }
{ "status": "no_face", "name": null, "confidence": 0.0, "memory": null, "suggestion": null }
```

### POST /api/add-person

**Request**
```json
{
  "name": "Sarah",
  "relation": "Daughter",
  "notes": "Loves painting",
  "images": ["<base64>", "<base64>", "..."]
}
```

**Response — success**
```json
{
  "status": "success",
  "name": "Sarah",
  "embeddings_count": 7,
  "skipped": 0,
  "message": "Sarah has been added successfully. The system will now recognize them."
}
```
