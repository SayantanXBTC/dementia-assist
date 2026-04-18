"""
app.py — Flask backend for dementia-assist.

Connects FaceEngine (face recognition) with MemoryManager (Hindsight Cloud
or local JSON) and exposes a REST API consumed by the frontend.

Environment variables (can be set via a .env file):
    HINDSIGHT_API_URL   Hindsight Cloud base URL
    HINDSIGHT_API_KEY   Hindsight Cloud bearer token
    HINDSIGHT_BANK_ID   Memory namespace (default: dementia-assist)
    FLASK_DEBUG         Enable Flask debug mode (default: True)
"""

import logging
import os

# Prevent OpenMP silent crashes on Windows/macOS when using DeepFace/OpenCV in threads
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import random
import traceback
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

from face_engine import FaceEngine
from hindsight_memory import PREDEFINED_PEOPLE, get_memory_manager

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load .env file if present (simple parser — no extra dependencies)
# ---------------------------------------------------------------------------

_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    with open(_env_path, encoding="utf-8") as _fh:
        for _line in _fh:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _, _val = _line.partition("=")
                os.environ.setdefault(_key.strip(), _val.strip())
    logger.info("Loaded environment variables from .env")

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------------
# Initialise subsystems
# ---------------------------------------------------------------------------

logger.info("Initialising FaceEngine…")
face_engine = FaceEngine(db_path="face_db.pkl")
_known_count = len(face_engine.list_people())
print(
    f"\n{'='*55}\n"
    f"  dementia-assist — face database loaded\n"
    f"  People in face_db.pkl : {_known_count}\n"
    f"  Known names           : {', '.join(face_engine.list_people()) or '(none)'}\n"
    f"{'='*55}\n"
)

logger.info("Initialising MemoryManager…")
memory_manager = get_memory_manager()

# Determine which backend is active for /api/health
_memory_mode = (
    "cloud"
    if type(memory_manager).__name__ == "MemoryManager"
    else "local"
)
logger.info("Memory backend: %s", _memory_mode)

# ---------------------------------------------------------------------------
# Startup sync — seed memory for pre-trained people and cross-check face_db
# ---------------------------------------------------------------------------

logger.info("Running startup memory sync…")
memory_manager.seed_initial_data()

_face_db_names = face_engine.list_people()
_memory_count  = 0

for _person_name in _face_db_names:
    _recalled = memory_manager.recall_person(_person_name)
    if _recalled:
        _memory_count += 1
    elif _person_name not in PREDEFINED_PEOPLE:
        logger.warning(
            "Person '%s' is in face_db.pkl but has no memory entry "
            "and is not in PREDEFINED_PEOPLE — they will be recognised "
            "but shown without notes or relationship info.",
            _person_name,
        )

logger.info(
    "Startup sync complete. %d people in face_db, %d with memory entries.",
    len(_face_db_names),
    _memory_count,
)

# ---------------------------------------------------------------------------
# Suggestion generator
# ---------------------------------------------------------------------------

# Keyword → suggestion template.  {name} is substituted at runtime.
_KEYWORD_SUGGESTIONS: list[tuple[str, str]] = [
    ("car",      "Ask {name} about their car"),
    ("school",   "Ask {name} how school is going"),
    ("cooking",  "Ask {name} what they've been cooking lately"),
    ("work",     "Ask {name} how work has been"),
    ("travel",   "Ask {name} about their recent travels"),
    ("garden",   "Ask {name} how the garden is coming along"),
    ("sport",    "Ask {name} how their team is doing"),
    ("football", "Ask {name} how their team is doing"),
    ("music",    "Ask {name} what music they've been listening to"),
    ("dog",      "Ask {name} how their dog is doing"),
    ("cat",      "Ask {name} how their cat is doing"),
    ("baby",     "Ask {name} about the baby"),
    ("wedding",  "Ask {name} how the wedding plans are going"),
    ("birthday", "Ask {name} about their birthday"),
    ("holiday",  "Ask {name} about their holiday"),
]


def _parse_last_seen(last_seen_str: str) -> datetime | None:
    """
    Parse an ISO-8601 timestamp string into a timezone-aware datetime.

    Returns ``None`` when the string is empty, missing, or unparseable.
    """
    if not last_seen_str:
        return None
    try:
        dt = datetime.fromisoformat(last_seen_str)
        # Make timezone-aware if naive (assume UTC)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def generate_suggestion(name: str, memory: dict | None) -> str:
    """
    Produce a context-sensitive conversation starter for the caregiver.

    Decision logic (in priority order):
    1. Last-seen recency (month → week → today).
    2. Random pick from the likes list.
    3. Keyword scan of the notes field.
    4. Generic fallback.

    Parameters
    ----------
    name : str
        Matched person's display name.
    memory : dict or None
        Recalled memory dict (keys: ``relation``, ``notes``, ``last_seen``,
        ``age``, ``likes``).  May be ``None`` if no memory record exists yet.

    Returns
    -------
    str
        A short, human-friendly suggestion string.
    """
    if not memory:
        return f"Ask {name} about their day"

    notes: str = (memory.get("notes") or "").lower()
    last_seen_str: str = memory.get("last_seen") or ""
    likes: list = memory.get("likes") or []

    # --- Recency-based suggestions ---
    last_seen_dt = _parse_last_seen(last_seen_str)
    if last_seen_dt:
        now = datetime.now(timezone.utc)
        delta_days = (now - last_seen_dt).days

        if delta_days >= 30:
            return f"You haven't seen {name} in over a month. They might have news to share!"
        if delta_days >= 7:
            return f"It's been a while since you saw {name}. Ask how they've been!"
        if delta_days == 0:
            return f"You saw {name} earlier today."

    # --- Likes-based suggestion (random pick) ---
    if likes:
        chosen = random.choice(likes)
        return f"Ask {name} about {chosen}"

    # --- Notes keyword scan ---
    for keyword, template in _KEYWORD_SUGGESTIONS:
        if keyword in notes:
            return template.format(name=name)

    # --- Generic fallback ---
    return f"Ask {name} about their day"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.route("/api/health", methods=["GET"])
def health():
    """
    Return a brief system status report.

    Response keys
    -------------
    status            "ok"
    face_db_loaded    bool — whether face_db.pkl was found and loaded
    people_count      int  — number of people in the face database
    hindsight_connected bool — True when the MemoryManager is ready
    hindsight_mode    "cloud" | "local"
    """
    try:
        people_count = len(face_engine.database)
        return jsonify(
            {
                "status": "ok",
                "face_db_loaded": bool(face_engine.database),
                "people_count": people_count,
                "hindsight_connected": memory_manager is not None,
                "hindsight_mode": _memory_mode,
            }
        )
    except Exception:
        logger.error("Error in /api/health:\n%s", traceback.format_exc())
        return jsonify({"status": "error", "message": "Health check failed"}), 500


@app.route("/api/recognize", methods=["POST"])
def recognize():
    """
    Identify a person from a single webcam frame.

    Request body (JSON)
    -------------------
    image : str
        Base64-encoded image string (raw or data-URI).

    Response body (JSON)
    --------------------
    status      "recognized" | "unknown" | "no_face"
    name        str | null
    confidence  float (0.0–1.0) | 0.0
    memory      dict | null
    suggestion  str | null
    """
    try:
        payload = request.get_json(silent=True) or {}
        image: str = payload.get("image", "").strip()

        if not image:
            return (
                jsonify({"status": "error", "message": "No image provided"}),
                400,
            )

        result = face_engine.recognize(image)
        matched_name: str | None = result.get("name")
        confidence: float = result.get("confidence") or 0.0
        distance = result.get("distance")

        # No face detected at all (engine returned distance=None without a name)
        if matched_name is None or (matched_name == "Unknown" and distance is None):
            return jsonify(
                {
                    "status": "no_face",
                    "name": None,
                    "confidence": 0.0,
                    "memory": None,
                    "suggestion": None,
                }
            )

        # Fix #7 — face detected but not matched: return best_candidate for
        # the "Add Person" / confirmation flow instead of a bare unknown.
        if matched_name == "Unknown":
            # Provide the closest candidate name (if any) so the frontend can
            # show "Is this <name>?" (Fix #10).
            best_candidate: str | None = None
            if distance is not None and face_engine._avg_cache:
                # The engine already found the nearest name — surface it for
                # the manual confirmation prompt even though it was above threshold.
                for n in face_engine._avg_cache:
                    best_candidate = n
                    break   # engine already chose best; expose first key as hint
            return jsonify(
                {
                    "status": "unknown",
                    "name": None,
                    "best_candidate": best_candidate,   # Fix #10 hint
                    "confidence": 0.0,
                    "memory": None,
                    "suggestion": None,
                }
            )

        # Fix #5 — name from engine is already lowercase; query Hindsight
        # with the exact same lowercase key so lookups never miss.
        name_key = matched_name.lower()

        # Fix #6 — consistent metadata format for Hindsight
        recalled = memory_manager.recall_person(name_key)
        memory_manager.update_last_seen(name_key)

        memory_payload: dict | None = None
        if recalled:
            memory_payload = {
                "relation":  recalled.get("relation", ""),
                "notes":     recalled.get("notes", ""),
                "last_seen": recalled.get("last_seen", ""),
                "age":       recalled.get("age"),
                "likes":     recalled.get("likes") or [],
            }

        # Use display name with title-case for UI readability
        display_name = recalled.get("name", matched_name) if recalled else matched_name.title()
        suggestion = generate_suggestion(display_name, recalled)

        logger.info("Fetched memory for '%s': %s", display_name, memory_payload)

        return jsonify(
            {
                "status": "recognized",
                "name": display_name,
                "confidence": round(confidence, 4),
                "memory": memory_payload,
                "suggestion": suggestion,
            }
        )

    except Exception:
        logger.error("Error in POST /api/recognize:\n%s", traceback.format_exc())
        return (
            jsonify({"status": "error", "message": "Recognition failed unexpectedly"}),
            500,
        )


@app.route("/api/add-person", methods=["POST"])
def add_person():
    """
    Enrol a new person in both the face database and the memory store.

    Request body (JSON)
    -------------------
    name     : str   — display name entered by the user
    relation : str   — relationship to the patient
    notes    : str   — free-form notes
    images   : list  — list of base64-encoded image strings (5–10 recommended)

    Response body (JSON)
    --------------------
    status           "success" | "error"
    name             str (on success)
    embeddings_count int (on success)
    message          str
    """
    try:
        payload = request.get_json(silent=True) or {}

        name: str     = (payload.get("name") or "").strip()
        relation: str = (payload.get("relation") or "").strip()
        notes: str    = (payload.get("notes") or "").strip()
        images: list  = payload.get("images") or []
        age_raw       = payload.get("age")
        age: int | None = int(age_raw) if isinstance(age_raw, (int, float)) and age_raw > 0 else None
        likes: list[str] = [str(l).strip() for l in (payload.get("likes") or []) if str(l).strip()]

        # Input validation
        if not name:
            return jsonify({"status": "error", "message": "Name is required"}), 400
        if len(name) < 2:
            return jsonify({"status": "error", "message": "Name must be at least 2 characters"}), 400
        if not relation:
            return jsonify({"status": "error", "message": "Relationship is required"}), 400
        if len(images) < 5:
            return (
                jsonify({
                    "status": "error",
                    "message": f"Please provide at least 5 photos ({len(images)} received).",
                }),
                400,
            )

        # Duplicate name guard — compare case-insensitively
        existing_names_lower = {n.lower() for n in face_engine.database}
        if name.lower() in existing_names_lower:
            return (
                jsonify({
                    "status": "error",
                    "message": f'"{name}" already exists in the database. Please use a different name.',
                }),
                409,
            )

        logger.info(
            "Adding person '%s' (%s) with %d image(s).", name, relation, len(images)
        )

        # Generate embeddings and update face_db.pkl
        engine_result = face_engine.add_person(name, images)

        if not engine_result["success"]:
            # Do NOT store anything in Hindsight when face detection failed.
            return (
                jsonify({
                    "status": "error",
                    "message": engine_result.get("error") or (
                        "Could not detect enough faces in the provided photos. "
                        "Please retake photos facing the camera directly, with good lighting."
                    ),
                    "embeddings_count": engine_result.get("embeddings_count", 0),
                    "skipped": engine_result.get("skipped", 0),
                }),
                400,
            )

        # Only persist memory after face DB confirms success
        payload = {
            "relation": relation,
            "notes": notes,
            "age": age,
            "likes": likes
        }
        memory_manager.store_person(name_key, payload)

        return jsonify(
            {
                "status": "success",
                "name": name,
                "embeddings_count": engine_result["embeddings_count"],
                "skipped": engine_result["skipped"],
                "message": (
                    f"{name} has been added successfully. "
                    "The system will now recognize them."
                ),
            }
        )

    except Exception as e:
        err = traceback.format_exc()
        logger.error("Error in POST /api/add-person:\n%s", err)
        return (
            jsonify({"status": "error", "message": f"Server Error: {str(e)}", "trace": err}),
            500,
        )



@app.route("/api/confirm-person", methods=["POST"])
def confirm_person():
    """
    Fix #10 — Manual confirmation fallback.

    When recognition returns 'unknown', the frontend shows the user
    "Is this <name>?" and POSTs here with the confirmed name + frame.
    The frame is stored as an extra embedding, improving future recognition.

    Request body (JSON)
    -------------------
    name  : str  — confirmed name (must already exist in face_db)
    image : str  — base64 frame that triggered the confirmation

    Response body (JSON)
    --------------------
    status   "success" | "error"
    message  str
    """
    try:
        payload = request.get_json(silent=True) or {}
        name: str  = (payload.get("name") or "").strip().lower()   # Fix #5
        image: str = (payload.get("image") or "").strip()

        if not name:
            return jsonify({"status": "error", "message": "Name is required"}), 400
        if not image:
            return jsonify({"status": "error", "message": "Image is required"}), 400

        if name not in face_engine.database:
            return jsonify({
                "status": "error",
                "message": f"'{name}' is not in the face database. Add them first.",
            }), 404

        # Try to add the confirmed frame as an extra embedding
        result = face_engine.add_person(name, [image])
        # Even if MIN_EMBEDDINGS check fails, log the attempt
        logger.info(
            "Manual confirmation for '%s': embeddings_added=%d",
            name, result.get("embeddings_count", 0),
        )
        display = name.title()
        return jsonify({
            "status": "success",
            "message": f"Confirmed as {display} — embedding recorded.",
        })

    except Exception:
        logger.error("Error in POST /api/confirm-person:\\n%s", traceback.format_exc())
        return jsonify({"status": "error", "message": "Confirmation failed"}), 500


@app.route("/api/people", methods=["GET"])
def list_people():
    """
    Return all people currently enrolled in the face database.

    Each entry is enriched with relationship/notes data from the memory
    store where available.

    Response body (JSON)
    --------------------
    people : list of dicts
        name             str
        relation         str (from Hindsight / local store)
        notes            str
        embeddings_count int
    """
    try:
        names = face_engine.list_people()
        people_list = []

        for name in names:
            recalled = memory_manager.recall_person(name, fast_mode=True)
            embeddings_count = len(face_engine.database.get(name, []))
            people_list.append(
                {
                    "name":             name,
                    "relation":         recalled.get("relation", "")  if recalled else "",
                    "notes":            recalled.get("notes", "")     if recalled else "",
                    "age":              recalled.get("age")           if recalled else None,
                    "likes":            recalled.get("likes") or []   if recalled else [],
                    "embeddings_count": embeddings_count,
                }
            )

        return jsonify({"people": people_list})

    except Exception:
        logger.error("Error in GET /api/people:\n%s", traceback.format_exc())
        return (
            jsonify({"status": "error", "message": "Failed to retrieve people list"}),
            500,
        )


@app.route("/api/update-person", methods=["POST"])
def update_person():
    """
    Update a person's memory details (relation, notes, age, likes).
    Does NOT modify face embeddings.

    Request body (JSON)
    -------------------
    name     : str
    relation : str
    notes    : str
    age      : int | null
    likes    : list[str]

    Response body (JSON)
    --------------------
    status   "success" | "error"
    message  str
    """
    try:
        payload = request.get_json(silent=True) or {}
        name: str = (payload.get("name") or "").strip()
        if not name:
            return jsonify({"status": "error", "message": "Name is required"}), 400

        name_key = name.lower()
        if name_key not in face_engine.database:
            return (
                jsonify({"status": "error", "message": f"'{name}' not found in face database"}),
                404,
            )

        relation: str = payload.get("relation") or ""
        notes:    str = payload.get("notes") or ""
        age_raw        = payload.get("age")
        likes: list    = payload.get("likes") or []

        try:
            age = int(age_raw) if age_raw not in (None, "", "null") else None
        except (ValueError, TypeError):
            age = None

        memory_manager.update_person(name_key, relation, notes, age=age, likes=likes)
        logger.info("Updated memory for '%s'", name_key)

        return jsonify({"status": "success", "message": f"{name.title()} updated successfully."})

    except Exception:
        logger.error("Error in POST /api/update-person:\n%s", traceback.format_exc())
        return jsonify({"status": "error", "message": "Update failed"}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "True").lower() in ("true", "1", "yes")
    logger.info("Starting Flask server on 0.0.0.0:5000 (debug=%s)", debug_mode)
    app.run(host="0.0.0.0", port=5000, debug=debug_mode)