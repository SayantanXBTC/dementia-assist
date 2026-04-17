"""
hindsight_memory.py — Persistent memory layer for dementia-assist.

Provides two interchangeable backends:

* ``MemoryManager``      — Hindsight Cloud (Vectorize.io) via the
                           ``hindsight-client`` Python package.
* ``LocalMemoryManager`` — Local JSON file fallback for users without a
                           Hindsight Cloud API key.

Use ``get_memory_manager(config)`` to receive the appropriate backend
automatically based on whether cloud credentials are present.

Environment variables
---------------------
HINDSIGHT_API_URL   Base URL of the Hindsight Cloud instance.
                    Default: https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY   Bearer token.  Required for cloud mode.
HINDSIGHT_BANK_ID   Isolated memory namespace for this app.
                    Default: dementia-assist
"""

import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DEFAULT_API_URL  = "https://api.hindsight.vectorize.io"
_DEFAULT_BANK_ID  = "dementia-assist"
_LOCAL_STORE_PATH = "memory_store.json"


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Pre-defined people — matches the 4 persons trained in face_db.pkl
# seed_initial_data() uses this to bootstrap Hindsight on first run.
# ---------------------------------------------------------------------------

PREDEFINED_PEOPLE: dict[str, dict] = {
    "Sayantan": {
        "text": (
            "Sayantan is a 21-year-old computer science student interested in AI and "
            "coding. He enjoys chess and music and often helps with technical work."
        ),
        "age":      21,
        "relation": "Friend",
        "likes":    ["AI", "Coding", "Chess", "Music"],
        "notes":    "Helpful and calm personality",
    },
    "Simran": {
        "text": (
            "Simran is a 20-year-old student who is energetic and friendly. "
            "She enjoys dancing, fashion, and social media."
        ),
        "age":      20,
        "relation": "Friend",
        "likes":    ["Dancing", "Fashion", "Social Media"],
        "notes":    "Very cheerful and social",
    },
    "Arpita": {
        "text": (
            "Arpita is a 22-year-old student who enjoys reading and writing. "
            "She is calm and likes deep conversations about literature and art."
        ),
        "age":      22,
        "relation": "Friend",
        "likes":    ["Reading", "Writing", "Art"],
        "notes":    "Thoughtful and introspective",
    },
    "Sampad": {
        "text": (
            "Sampad is a 21-year-old student who enjoys sports and fitness. "
            "He likes cricket and going to the gym."
        ),
        "age":      21,
        "relation": "Friend",
        "likes":    ["Cricket", "Gym", "Fitness"],
        "notes":    "Energetic and disciplined",
    },
}


# ---------------------------------------------------------------------------
# Cloud backend — Hindsight Cloud (Vectorize.io)
# ---------------------------------------------------------------------------


class MemoryManager:
    """
    Persistent memory manager backed by Hindsight Cloud.

    All memories are stored in an isolated *bank* (``bank_id``) so that
    multiple apps can share the same Hindsight account without data mixing.
    """

    def __init__(
        self,
        api_url: str = _DEFAULT_API_URL,
        api_key: str = "",
        bank_id: str = _DEFAULT_BANK_ID,
    ) -> None:
        try:
            from hindsight_client import Hindsight  # type: ignore[import]
        except ImportError as exc:
            raise ImportError(
                "hindsight-client is not installed.  Run: pip install hindsight-client"
            ) from exc

        if not api_key:
            raise ValueError("HINDSIGHT_API_KEY must be set to use cloud memory.")

        self.bank_id = bank_id
        self.client  = Hindsight(base_url=api_url, api_key=api_key)
        logger.info(
            "MemoryManager initialised (cloud). bank_id='%s', api_url='%s'.",
            bank_id, api_url,
        )

    # ------------------------------------------------------------------
    # Seed
    # ------------------------------------------------------------------

    def seed_initial_data(self) -> dict:
        """
        Idempotently seed PREDEFINED_PEOPLE into Hindsight Cloud.

        For each person, ``recall_person()`` is called first.  If a memory
        record already exists the person is skipped.  Otherwise their
        ``text`` field is stored as the main content entry and an initial
        ``last_seen`` entry is added.

        Returns
        -------
        dict
            ``{"seeded": [...], "already_existed": [...]}``
        """
        seeded: list[str]          = []
        already_existed: list[str] = []

        for name, data in PREDEFINED_PEOPLE.items():
            existing = self.recall_person(name)
            if existing:
                already_existed.append(name)
                logger.debug("seed_initial_data: '%s' already in Hindsight — skipping.", name)
                continue

            try:
                self.client.retain(
                    bank_id=self.bank_id,
                    content=data["text"],
                    tags=[name.lower(), "person", data["relation"].lower()],
                )
                now = _now_iso()
                self.client.retain(
                    bank_id=self.bank_id,
                    content=f"{name} was seen on {now}",
                    tags=[name.lower(), "last_seen"],
                )
                seeded.append(name)
                logger.info("seed_initial_data: seeded '%s' in Hindsight Cloud.", name)
            except Exception as exc:
                logger.error("seed_initial_data: failed to seed '%s': %s", name, exc)

        logger.info(
            "seed_initial_data (cloud): seeded=%s, already_existed=%s",
            seeded, already_existed,
        )
        return {"seeded": seeded, "already_existed": already_existed}

    # ------------------------------------------------------------------
    # Core operations
    # ------------------------------------------------------------------

    def store_person(
        self,
        name:     str,
        relation: str,
        notes:    str,
        age:      Optional[int]  = None,
        likes:    Optional[list] = None,
    ) -> bool:
        """
        Store a structured memory about a person in Hindsight Cloud.

        The content string uses a parseable key: value format so that
        ``recall_person()`` can reconstruct the structured dict reliably.
        """
        now = _now_iso()
        likes_csv = ", ".join(likes) if likes else "unknown"
        age_str   = str(age) if age else "unknown"

        content = (
            f"New person added: {name}. "
            f"Relationship: {relation}. "
            f"Age: {age_str}. "
            f"Likes: {likes_csv}. "
            f"Notes: {notes}. "
            f"First seen on: {now}."
        )
        try:
            self.client.retain(
                bank_id=self.bank_id,
                content=content,
                tags=[name.lower(), "person", relation.lower()],
            )
            self.client.retain(
                bank_id=self.bank_id,
                content=f"{name} was seen on {now}",
                tags=[name.lower(), "last_seen"],
            )
            logger.info("Stored memory for '%s' in Hindsight Cloud.", name)
            return True
        except Exception as exc:
            logger.error("Failed to store memory for '%s': %s", name, exc)
            return False

    def recall_person(self, name: str) -> Optional[dict]:
        """
        Retrieve memories about a specific person from Hindsight Cloud.

        Returns a dict with keys: name, age, relation, likes, notes, last_seen.
        """
        query = f"What do I know about {name}?"
        try:
            results = self.client.recall(
                bank_id=self.bank_id,
                query=query,
                tags=[name.lower()],
            )
        except Exception as exc:
            logger.error("Failed to recall memory for '%s': %s", name, exc)
            return None

        if not results:
            logger.info("No memories found for '%s'.", name)
            return None

        raw    = results[0] if isinstance(results, list) else results
        parsed = self._parse_memory_content(raw, name)
        logger.info("Recalled memory for '%s'.", name)
        return parsed

    def update_last_seen(self, name: str) -> bool:
        """Record a timestamped "last seen" event for a person."""
        content = f"{name} was seen on {_now_iso()}"
        try:
            self.client.retain(
                bank_id=self.bank_id,
                content=content,
                tags=[name.lower(), "last_seen"],
            )
            logger.info("Updated last-seen for '%s'.", name)
            return True
        except Exception as exc:
            logger.error("Failed to update last-seen for '%s': %s", name, exc)
            return False

    def get_all_people(self) -> list[dict]:
        """Retrieve a summary of all known people from Hindsight Cloud."""
        try:
            results = self.client.recall(
                bank_id=self.bank_id,
                query="List all people I know",
            )
        except Exception as exc:
            logger.error("Failed to retrieve all people: %s", exc)
            return []

        if not results:
            return []

        people: list[dict] = []
        if isinstance(results, list):
            for item in results:
                parsed = self._parse_memory_content(item, name="")
                if parsed.get("name"):
                    people.append(parsed)
        logger.info("Retrieved %d people from Hindsight Cloud.", len(people))
        return people

    def delete_person(self, name: str) -> bool:
        """Attempt to clear all memories tagged with a person's name."""
        try:
            results = self.client.recall(
                bank_id=self.bank_id,
                query=f"Everything about {name}",
                tags=[name.lower()],
            )
            logger.info(
                "Found %d memories tagged '%s'. Deletion depends on API support.",
                len(results) if isinstance(results, list) else 0,
                name.lower(),
            )
            if hasattr(self.client, "forget"):
                self.client.forget(bank_id=self.bank_id, tags=[name.lower()])
                logger.info("Deleted memories for '%s' via client.forget().", name)
                return True
            logger.warning(
                "hindsight_client has no delete method. "
                "Remove memories for '%s' manually via the dashboard.",
                name,
            )
            return False
        except Exception as exc:
            logger.error("Failed to delete memories for '%s': %s", name, exc)
            return False

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_memory_content(raw, name: str) -> dict:
        """
        Convert a raw Hindsight result (string or dict) to a structured dict.

        Handles three content formats:
        1. Old structured: ``"New person added: X. Relationship: Y. Notes: Z."``
        2. New structured: ``"… Age: N. Likes: A, B, C. Notes: Z."``
        3. Free-text (seeded data): ``"X is a 21-year-old … He enjoys chess…"``
        """
        if isinstance(raw, dict):
            content = raw.get("content", "") or str(raw)
        else:
            content = str(raw)

        result: dict = {
            "name":       name,
            "age":        None,
            "relation":   "",
            "likes":      [],
            "notes":      "",
            "last_seen":  "",
            "raw":        content,
        }

        # ── Pass 1: dot-split structured parsing ────────────────────────
        for part in content.split("."):
            part = part.strip()
            if part.startswith("New person added:"):
                result["name"] = part.removeprefix("New person added:").strip()
            elif part.startswith("Person:"):
                result["name"] = part.removeprefix("Person:").strip()
            elif part.startswith("Relationship:"):
                result["relation"] = part.removeprefix("Relationship:").strip()
            elif part.startswith("Age:"):
                try:
                    result["age"] = int(part.removeprefix("Age:").strip())
                except ValueError:
                    pass
            elif part.startswith("Likes:"):
                raw_likes = part.removeprefix("Likes:").strip()
                if raw_likes and raw_likes.lower() != "unknown":
                    result["likes"] = [x.strip() for x in raw_likes.split(",") if x.strip()]
            elif part.startswith("Notes:"):
                result["notes"] = part.removeprefix("Notes:").strip()
            elif part.startswith("First seen on:"):
                result.setdefault("first_seen", part.removeprefix("First seen on:").strip())
            elif "was seen on" in part:
                result["last_seen"] = part.split("was seen on")[-1].strip()

        # ── Pass 2: regex fallback for free-text / seeded content ────────
        if result["age"] is None:
            m = re.search(r"(\d+)-year-old", content)
            if m:
                try:
                    result["age"] = int(m.group(1))
                except ValueError:
                    pass

        if not result["relation"]:
            # "{name} is a N-year-old {relation} who …"
            m = re.search(
                r"\d+-year-old\s+([\w][\w ]*?)(?:\s+who\b|\s+student|\s+and\b|[.,])",
                content,
                re.IGNORECASE,
            )
            if m:
                result["relation"] = m.group(1).strip()

        if not result["likes"]:
            for pattern in (
                r"[Tt]hey like ([^.]+)",
                r"enjoys?\s+([^.]+)",
                r"\blikes?\s+([^.]+)",
                r"interested in ([^.]+)",
            ):
                m = re.search(pattern, content)
                if m:
                    raw_likes = re.sub(r"\band\b", ",", m.group(1))
                    result["likes"] = [x.strip() for x in raw_likes.split(",") if x.strip()]
                    break

        return result


# ---------------------------------------------------------------------------
# Local fallback backend — JSON file
# ---------------------------------------------------------------------------


class LocalMemoryManager:
    """
    Memory manager that persists data to a local JSON file.

    Implements the same public interface as ``MemoryManager`` so that the
    rest of the application can use either backend without modification.
    """

    def __init__(
        self,
        store_path: str = _LOCAL_STORE_PATH,
        bank_id:    str = _DEFAULT_BANK_ID,
        **_kwargs,
    ) -> None:
        self.store_path = Path(store_path)
        self.bank_id    = bank_id
        self._store: dict = {"people": {}}
        self._load()
        logger.info(
            "LocalMemoryManager initialised. store='%s', %d people loaded.",
            self.store_path, len(self._store["people"]),
        )

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _load(self) -> None:
        """Load the JSON store from disk; initialise if missing or corrupt."""
        if not self.store_path.exists():
            logger.info("Local memory store '%s' not found — starting fresh.", self.store_path)
            self._store = {"people": {}}
            return
        try:
            with open(self.store_path, "r", encoding="utf-8") as fh:
                self._store = json.load(fh)
            if "people" not in self._store:
                self._store["people"] = {}
        except (json.JSONDecodeError, OSError) as exc:
            logger.error(
                "Failed to load local memory store '%s': %s — resetting.",
                self.store_path, exc,
            )
            self._store = {"people": {}}

    def _save(self) -> None:
        """Persist the in-memory store back to disk."""
        try:
            self.store_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.store_path, "w", encoding="utf-8") as fh:
                json.dump(self._store, fh, indent=2, ensure_ascii=False)
        except OSError as exc:
            logger.error("Failed to save local memory store: %s", exc)
            raise

    # ------------------------------------------------------------------
    # Seed
    # ------------------------------------------------------------------

    def seed_initial_data(self) -> dict:
        """
        Idempotently seed PREDEFINED_PEOPLE into the local JSON store.

        Persons already present in the store are skipped; the store is
        saved in a single write after processing all candidates.

        Returns
        -------
        dict
            ``{"seeded": [...], "already_existed": [...]}``
        """
        seeded: list[str]          = []
        already_existed: list[str] = []

        for name, data in PREDEFINED_PEOPLE.items():
            key = name.lower()
            if key in self._store["people"]:
                already_existed.append(name)
                logger.debug("seed_initial_data: '%s' already in local store — skipping.", name)
                continue

            now = _now_iso()
            self._store["people"][key] = {
                "name":       name,
                "age":        data.get("age"),
                "relation":   data.get("relation", ""),
                "likes":      data.get("likes", []),
                "notes":      data.get("notes", ""),
                "last_seen":  now,
                "first_seen": now,
                "added":      now,
            }
            seeded.append(name)

        if seeded:
            try:
                self._save()
                logger.info(
                    "seed_initial_data (local): seeded %d people: %s",
                    len(seeded), ", ".join(seeded),
                )
            except OSError as exc:
                logger.error("seed_initial_data: failed to save: %s", exc)

        if already_existed:
            logger.info(
                "seed_initial_data (local): %d people already existed: %s",
                len(already_existed), ", ".join(already_existed),
            )

        return {"seeded": seeded, "already_existed": already_existed}

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def store_person(
        self,
        name:     str,
        relation: str,
        notes:    str,
        age:      Optional[int]  = None,
        likes:    Optional[list] = None,
    ) -> bool:
        """Create or update a person's record in the local JSON store."""
        key      = name.lower()
        now      = _now_iso()
        existing = self._store["people"].get(key, {})
        self._store["people"][key] = {
            "name":       name,
            "age":        age,
            "relation":   relation,
            "likes":      likes or [],
            "notes":      notes,
            "last_seen":  existing.get("last_seen", now),
            "first_seen": existing.get("first_seen", now),
            "added":      existing.get("added", now),
        }
        try:
            self._save()
            logger.info("Stored memory for '%s' in local store.", name)
            return True
        except OSError:
            return False

    def recall_person(self, name: str) -> Optional[dict]:
        """Retrieve a person's record from the local JSON store."""
        record = self._store["people"].get(name.lower())
        if record is None:
            logger.info("No local memory found for '%s'.", name)
            return None
        logger.info("Recalled local memory for '%s'.", name)
        return dict(record)

    def update_last_seen(self, name: str) -> bool:
        """Update the ``last_seen`` timestamp for a person."""
        key = name.lower()
        now = _now_iso()
        if key not in self._store["people"]:
            logger.info("'%s' not in local store — creating stub for last-seen.", name)
            self._store["people"][key] = {
                "name":       name,
                "age":        None,
                "relation":   "",
                "likes":      [],
                "notes":      "",
                "last_seen":  now,
                "first_seen": now,
                "added":      now,
            }
        else:
            self._store["people"][key]["last_seen"] = now
        try:
            self._save()
            logger.info("Updated last-seen for '%s' to %s.", name, now)
            return True
        except OSError:
            return False

    def get_all_people(self) -> list[dict]:
        """Return all person records sorted by name."""
        people = list(self._store["people"].values())
        people.sort(key=lambda p: p.get("name", "").lower())
        return people

    def delete_person(self, name: str) -> bool:
        """Remove a person's record permanently."""
        key = name.lower()
        if key not in self._store["people"]:
            logger.warning("Cannot delete '%s': not found in local store.", name)
            return False
        del self._store["people"][key]
        try:
            self._save()
            logger.info("Deleted local memory for '%s'.", name)
            return True
        except OSError:
            return False


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def get_memory_manager(config: Optional[dict] = None):
    """
    Return the appropriate memory backend based on available configuration.

    Checks ``config`` dict, then environment variables, then defaults to
    ``LocalMemoryManager``.
    """
    cfg = config or {}

    api_url = cfg.get("api_url") or os.environ.get("HINDSIGHT_API_URL", _DEFAULT_API_URL)
    api_key = cfg.get("api_key") or os.environ.get("HINDSIGHT_API_KEY", "")
    bank_id = cfg.get("bank_id") or os.environ.get("HINDSIGHT_BANK_ID", _DEFAULT_BANK_ID)

    if api_key and api_url:
        logger.info("Hindsight Cloud credentials detected — using MemoryManager.")
        try:
            return MemoryManager(api_url=api_url, api_key=api_key, bank_id=bank_id)
        except ImportError as exc:
            logger.warning("hindsight-client not installed (%s). Falling back to local.", exc)
        except Exception as exc:
            logger.warning("Could not init MemoryManager (%s). Falling back to local.", exc)

    store_path = cfg.get("store_path", _LOCAL_STORE_PATH)
    logger.info("Using LocalMemoryManager (store='%s').", store_path)
    return LocalMemoryManager(store_path=store_path, bank_id=bank_id)
