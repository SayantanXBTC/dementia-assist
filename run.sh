#!/bin/bash
set -e

echo "================================================"
echo "  Dementia Assist — AI Memory Companion"
echo "================================================"
echo ""

# ── Preflight checks ────────────────────────────────────────────────────────

if [ ! -f "face_db.pkl" ]; then
  echo "WARNING: face_db.pkl not found."
  echo "  The system will start with an empty face database."
  echo "  Place your trained face_db.pkl in the project root, or"
  echo "  use the 'Add Person' feature in the UI to enrol people live."
else
  echo "✓ Face database found (face_db.pkl)"
fi

if [ ! -f ".env" ]; then
  echo ""
  echo "WARNING: .env not found — copying from .env.example"
  cp .env.example .env
  echo "  Edit .env and add your Hindsight API key to enable cloud memory."
  echo "  Without it, memories are stored locally in memory_store.json."
else
  echo "✓ Environment file found (.env)"
fi

echo ""

# ── Dependencies ────────────────────────────────────────────────────────────

echo "Installing backend dependencies..."
pip install -r requirements.txt --quiet

echo "Installing frontend dependencies..."
(cd frontend && npm install --silent)

echo ""
echo "Dependencies ready."
echo ""

# ── Start services ──────────────────────────────────────────────────────────

echo "Starting Flask backend on http://localhost:5000 ..."
python app.py &
BACKEND_PID=$!

# Give Flask a moment to bind before Next.js starts polling /api/*
sleep 2

echo "Starting Next.js frontend on http://localhost:3000 ..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "================================================"
echo "  System is running!"
echo ""
echo "  Open:  http://localhost:3000"
echo ""
echo "  Backend API: http://localhost:5000/api/health"
echo ""
echo "  Press Ctrl+C to stop both services."
echo "================================================"
echo ""

# ── Graceful shutdown ───────────────────────────────────────────────────────

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID"  2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  echo "Done."
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for either process to exit
wait
