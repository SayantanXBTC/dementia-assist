"""
face_engine.py — Core face recognition engine for dementia-assist.

Changes vs original
--------------------
Fix #1  — Crop face with OpenCV BEFORE calling DeepFace (avoids "No face detected").
Fix #2  — Match against the *average* embedding per person (more stable, less noise).
Fix #3  — Default threshold lowered to 8.0 (sweet-spot 7–9 range).
Fix #4  — load_database() validates and prints loaded data at startup.
Fix #5  — All names normalised to lowercase on store AND on lookup.
Fix #8  — Frames resized to ≤640 px before any processing.
Fix #9  — Confidence score (0–100 %) returned and logged.
"""

import base64
import logging
import pickle
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from deepface import DeepFace

logger = logging.getLogger(__name__)

# Haar-cascade for fast face detection (ships with every OpenCV install)
_FACE_CASCADE = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# Padding fraction added around each detected face crop
_CROP_PAD = 0.20


def _crop_largest_face(frame: np.ndarray) -> Optional[np.ndarray]:
    """
    Detect faces in *frame* using OpenCV Haar cascades and return a cropped
    region around the **largest** detected face.

    A 20 % padding is added on each side so DeepFace can see enough context
    around the face to generate a reliable embedding.

    Returns ``None`` when no face is detected.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = _FACE_CASCADE.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(60, 60),
    )

    if len(faces) == 0:
        return None

    # Pick the largest face by area
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])

    fh, fw = frame.shape[:2]
    pad_x = int(w * _CROP_PAD)
    pad_y = int(h * _CROP_PAD)

    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y)
    x2 = min(fw, x + w + pad_x)
    y2 = min(fh, y + h + pad_y)

    crop = frame[y1:y2, x1:x2]
    logger.debug("Cropped face region: (%d,%d)→(%d,%d)", x1, y1, x2, y2)
    return crop


class FaceEngine:
    """
    Face recognition engine that wraps DeepFace (FaceNet) and manages a
    persistent pickle-based embedding database.

    Database schema (stored in .pkl)
    ---------------------------------
    {
        "lowercase_name": [np.ndarray(128,), ...],
        ...
    }

    All keys are **lowercase** — enforced at every write path so
    Hindsight memory queries (which also use lowercase) always match.
    """

    MODEL_NAME = "Facenet"

    def __init__(self, db_path: str = "face_db.pkl", threshold: float = 8.0) -> None:
        self.db_path = Path(db_path)
        self.threshold = threshold          # Fix #3 — tuned default 8.0
        self.database: dict[str, list[np.ndarray]] = {}
        self._avg_cache: dict[str, np.ndarray] = {}
        self.load_database()

    # ------------------------------------------------------------------
    # Database persistence
    # ------------------------------------------------------------------

    def load_database(self) -> None:
        """
        Load the embedding database.  Prints a full startup summary so
        silent failures are impossible (Fix #4).  Normalises all keys to
        lowercase (Fix #5).  Rebuilds the average-embedding cache (Fix #2).
        """
        if not self.db_path.exists():
            logger.info("Database file '%s' not found — starting empty.", self.db_path)
            self.database = {}
            self._avg_cache = {}
            print(
                f"\n{'='*55}\n"
                f"  face_engine: database file NOT found\n"
                f"  Path : {self.db_path}\n"
                f"{'='*55}\n"
            )
            return

        try:
            with open(self.db_path, "rb") as fh:
                raw: dict = pickle.load(fh)

            # Fix #5 — normalise all existing keys to lowercase
            self.database = {k.lower(): v for k, v in raw.items()}
            self._rebuild_avg_cache()

            person_count    = len(self.database)
            embedding_count = sum(len(v) for v in self.database.values())

            # Fix #4 — always print what was loaded
            print(
                f"\n{'='*55}\n"
                f"  face_engine: database loaded OK\n"
                f"  File             : {self.db_path}\n"
                f"  People loaded    : {person_count}\n"
                f"  Total embeddings : {embedding_count}\n"
                f"  Names            : {', '.join(sorted(self.database.keys())) or '(none)'}\n"
                f"{'='*55}\n"
            )
            logger.info(
                "Loaded database '%s': %d people, %d embeddings.",
                self.db_path, person_count, embedding_count,
            )

        except Exception as exc:
            logger.error("Failed to load database: %s", exc)
            self.database = {}
            self._avg_cache = {}
            print(
                f"\n{'='*55}\n"
                f"  face_engine: FAILED to load database\n"
                f"  Error : {exc}\n"
                f"{'='*55}\n"
            )

    def save_database(self) -> None:
        """Persist the in-memory database back to disk."""
        try:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.db_path, "wb") as fh:
                pickle.dump(self.database, fh)
            logger.info("Database saved to '%s'.", self.db_path)
        except Exception as exc:
            logger.error("Failed to save database: %s", exc)
            raise

    def _rebuild_avg_cache(self) -> None:
        """Recompute per-person average embeddings (Fix #2)."""
        self._avg_cache = {}
        for name, embeddings in self.database.items():
            if embeddings:
                self._avg_cache[name] = np.mean(
                    np.array(embeddings, dtype=np.float32), axis=0
                )
        logger.debug("Avg-embedding cache rebuilt for %d people.", len(self._avg_cache))

    # ------------------------------------------------------------------
    # Embedding generation
    # ------------------------------------------------------------------

    def _decode_frame(self, image: str) -> np.ndarray:
        """Decode base64 → BGR frame, resized to ≤640 px (Fix #8)."""
        if "," in image:
            image = image.split(",", 1)[1]

        img_bytes = base64.b64decode(image)
        frame = cv2.imdecode(np.frombuffer(img_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)

        if frame is None:
            raise ValueError("Could not decode image bytes into a valid frame.")

        h, w = frame.shape[:2]
        if max(h, w) > 640:
            scale = 640 / max(h, w)
            frame = cv2.resize(
                frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA
            )
        return frame

    def get_embedding(self, image: str) -> np.ndarray:
        """
        Decode a base64 webcam frame, crop the largest face (Fix #1), then
        return a 128-d FaceNet embedding.

        Raises ValueError when no face is detected.
        """
        frame = self._decode_frame(image)

        # Fix #1 — crop face with OpenCV *before* calling DeepFace
        cropped = _crop_largest_face(frame)
        if cropped is None:
            raise ValueError("No face detected by OpenCV cascade.")

        result = DeepFace.represent(
            img_path=cropped,
            model_name=self.MODEL_NAME,
            enforce_detection=False,   # cascade already confirmed a face
        )

        embedding = np.array(result[0]["embedding"], dtype=np.float32)
        logger.debug("Embedding generated, shape=%s", embedding.shape)
        return embedding

    # ------------------------------------------------------------------
    # Recognition
    # ------------------------------------------------------------------

    def recognize(self, image: str) -> dict:
        """
        Identify the person in *image* against the loaded database.

        Uses the **average embedding** per person (Fix #2) and the tuned
        threshold (Fix #3).  Returns a confidence % for display (Fix #9).

        Returns
        -------
        dict
            name, distance, confidence
        """
        if not self.database:
            logger.warning("Database is empty — cannot recognise anyone.")
            return {"name": "Unknown", "distance": None, "confidence": None}

        if not self._avg_cache:
            self._rebuild_avg_cache()

        try:
            query_emb = self.get_embedding(image)
        except Exception as exc:
            logger.warning("Could not extract embedding: %s", exc)
            return {"name": "Unknown", "distance": None, "confidence": None}

        best_name: Optional[str] = None
        best_dist = float("inf")

        # Fix #2 — compare against per-person *average* embedding
        for person_name, avg_emb in self._avg_cache.items():
            dist = float(np.linalg.norm(query_emb - avg_emb))
            if dist < best_dist:
                best_dist = dist
                best_name = person_name

        if best_dist < self.threshold and best_name is not None:
            # Fix #9 — confidence score
            confidence = float(np.clip(1.0 - best_dist / self.threshold, 0.0, 1.0))
            logger.info(
                "Recognised '%s' — dist=%.4f, confidence=%.1f%%",
                best_name, best_dist, confidence * 100,
            )
            return {"name": best_name, "distance": best_dist, "confidence": confidence}

        logger.info("No match (best dist=%.4f, threshold=%.1f).", best_dist, self.threshold)
        return {"name": "Unknown", "distance": best_dist, "confidence": None}

    # ------------------------------------------------------------------
    # Database management
    # ------------------------------------------------------------------

    MIN_EMBEDDINGS = 3

    def add_person(self, name: str, images: list[str]) -> dict:
        """
        Enrol a new person.  Names are stored lowercase (Fix #5).
        Rebuilds avg-embedding cache after adding (Fix #2).
        """
        if not name or not name.strip():
            raise ValueError("Person name must be a non-empty string.")
        if not images:
            raise ValueError("At least one image is required.")

        name = name.strip().lower()   # Fix #5

        added, skipped = 0, 0
        new_embeddings: list[np.ndarray] = []

        for idx, img in enumerate(images):
            try:
                emb = self.get_embedding(img)
                new_embeddings.append(emb)
                added += 1
            except Exception as exc:
                skipped += 1
                logger.warning(
                    "Skipping image %d/%d for '%s': %s", idx + 1, len(images), name, exc
                )

        if added < self.MIN_EMBEDDINGS:
            return {
                "success": False,
                "embeddings_count": added,
                "skipped": skipped,
                "error": (
                    f"Only {added} of {len(images)} photos contained a detectable face "
                    f"(minimum {self.MIN_EMBEDDINGS} required). "
                    "Try again with better lighting and face the camera directly."
                ),
            }

        if name not in self.database:
            self.database[name] = []
        self.database[name].extend(new_embeddings)
        self._rebuild_avg_cache()   # Fix #2
        self.save_database()

        logger.info(
            "Added %d embedding(s) for '%s' (%d skipped). Total: %d.",
            added, name, skipped, len(self.database[name]),
        )
        return {"success": True, "embeddings_count": added, "skipped": skipped, "error": None}

    def list_people(self) -> list[str]:
        """Return a sorted list of all person names in the database."""
        return sorted(self.database.keys())