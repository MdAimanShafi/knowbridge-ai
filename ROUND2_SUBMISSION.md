# ROUND 2 SUBMISSION DOSSIER — WCC FORGE 48
## TEAM SYNTAX ERROR | KNOWBRIDGE AI

- **Project:** KNOWBRIDGE AI — Intelligent Project Knowledge Handover Platform
- **Tagline:** Preserving Knowledge. Empowering Continuity.
- **Team Name:** SYNTAX ERROR
- **Hackathon:** We Code Coders — WCC Forge 48
- **Round:** Round 2 — The Build

---

### 1. Functional Web Application Verification
The application is fully functional and features a complete end-to-end working workflow:
1. **Connect:** Project workspace creation, PDF document upload, and GitHub integration.
2. **Reconstruct:** Structured knowledge extraction using Google Gemini API (`gemini-3.8-flash`) with strict JSON schemas.
3. **Verify:** Exact page-level evidence traceability (`VERIFIED`, `UNCERTAIN`, `CONFLICTING`, `MISSING_EVIDENCE`).
4. **Review:** Human review queue (Approve, Reject, Clarify, Edit with audit notes).
5. **Handover:** Handover report generator with executive sign-off and printable/downloadable PDF export.

---

### 2. Judge Testing Guide
1. Launch or open the application.
2. The app pre-authenticates as **Alex Rivera (Incoming Senior Engineer)**.
3. Select the **"E-Commerce Platform Migration" (PHX-MIG)** workspace.
4. Go to **Workflow (Stage 01: Connect)**:
   - View the 3 parsed project documents (`Project Architecture Specification v3.pdf`, etc.).
   - Upload any custom PDF file or sample spec using the "Upload PDF" button.
5. In **Stage 02: Reconstruct**:
   - Inspect the Gemini 3.8 Flash structured extraction metrics.
   - Click "Reprocess" on any document to test live extraction.
6. In **Stage 03: Verify**:
   - Inspect the highlighted contradictory directives (Stripe Elements vs Adyen evaluation).
   - Click any item to open the **Evidence & Verification Inspector** showing the exact source quote and surrounding raw page text.
7. In **Stage 04: Review**:
   - Approve, Reject, or Request Clarification on findings. Add transition notes.
8. In **Stage 05: Handover**:
   - Click "Generate New Handover Report".
   - View the completed dossier and click **"Print / Download PDF"** to inspect the printable export.
   - Execute formal Executive Sign-Off.
