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
