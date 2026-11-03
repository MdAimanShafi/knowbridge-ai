# KNOWBRIDGE AI — Intelligent Project Knowledge Handover Platform
### Preserving Knowledge. Empowering Continuity.

**Hackathon:** We Code Coders — WCC Forge 48  
**Round:** Round 2 — The Build  
**Team Name:** SYNTAX ERROR  

---

## 1. The Core Problem

> **"Prevent Critical Knowledge From Leaving With People."**

When an employee, developer, researcher, or project lead leaves a team, important knowledge often leaves with them:
- The reasoning behind architectural and technical decisions
- Incomplete tasks, blockers, and subtle edge cases
- Cross-team technical dependencies
- Unresolved operational risks
- Dispersed documentation across PDFs, markdown notes, reports, and GitHub repositories

Incoming team members are forced to spend weeks manually reconstructing context, causing delays, duplicated work, security vulnerabilities, and project disruption.

**KNOWBRIDGE AI** solves this by establishing a continuous, evidence-grounded, permission-aware project handover workflow.

---

## 2. Central 5-Stage Workflow

```
[ CONNECT ] ──▶ [ RECONSTRUCT ] ──▶ [ VERIFY ] ──▶ [ REVIEW ] ──▶ [ HANDOVER ]
 Upload PDFs      Gemini 3.8 Flash    Page Citations    Human Lead     Official Dossier
 & GitHub Repo    Structured Schema   Conflict Audits   Sign-Off       & PDF Export
```

1. **STAGE 1: CONNECT**
   - Ingest authorized project specifications, architecture documents, and status reports.
   - Synchronize GitHub repositories (pull requests, open issues, and commits).

2. **STAGE 2: RECONSTRUCT**
   - Server-side Gemini 3.8 Flash extracts structured project entities:
     * Architectural Decisions & Rationales
     * Completed Milestones & Pending Tasks
     * Task Owners & Deadlines
     * Technical Dependencies & Blockers
     * Operational Risks & Severity Ratings
     * Unresolved Questions

3. **STAGE 3: VERIFY**
   - Every claim is tied to an original document and exact page-level quote excerpt.
   - Evidence states:
     * `VERIFIED`: Supported by direct textual evidence.
     * `UNCERTAIN`: Incomplete or ambiguous source statement.
     * `CONFLICTING`: Two or more sources present inconsistent directions (e.g. Stripe vs Adyen evaluation).
     * `MISSING_EVIDENCE`: Operational questions lacking key credentials or runbooks.

4. **STAGE 4: REVIEW**
   - **Constitutional Rule: AI never approves its own findings.**
   - Human leads approve, reject, or request clarification with reviewer notes.

5. **STAGE 5: HANDOVER**
   - Compiles an official handover dossier.
   - Segregates verified approved findings from pending or flagged claims.
   - Provides printable and downloadable PDF export.
   - Records executive sign-off and transition acceptance.

---

## 3. Flagship Demo Project: "E-Commerce Platform Migration" (Project Phoenix)

The platform is pre-loaded with synthetic documents and verified citations for immediate hackathon judge testing:
- **Project:** Monolith decommissioning to GKE microservices & PostgreSQL 16.
- **Departing Architect:** Sarah Lin (Staff Platform Architect)
- **Incoming Successor:** Alex Rivera (Senior Software Engineer)
- **Reviewer:** Marcus Vance (Engineering Director)
- **Pre-loaded Documents:**
  * `Project Architecture Specification v3.pdf`
  * `Payment Integration and PCI Scope Notes.pdf`
  * `Q3 Migration Status and Risk Matrix.pdf`

---

## 4. Quick Start & Execution

```bash
# 1. Install dependencies
npm install

# 2. Run the full-stack application (server.ts with Vite middlewares on port 3000)
npm run dev

# 3. Build for production
npm run build
npm start
```

### Environment Variables (`.env`)
```env
GEMINI_API_KEY=your-gemini-api-key
PORT=3000
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
```

`GEMINI_API_KEY` is optional for local development. When it is not configured, document analysis uses a grounded rule-based fallback; the app reports which provider produced the findings. In production, set `JWT_SECRET` to a random value of at least 32 characters. The development-only default is not suitable for deployment.

### Using the application

- Register an account or sign in with your email and password. New registrations receive the member role; project creators are added as project owners.
- Create or select a workspace, then upload PDF, DOCX, XLSX, XLS, CSV, TXT, Markdown, or JSON documents. Scanned PDFs need OCR before upload.
- Review extracted findings and their source citations. Gemini findings are checked against the uploaded text; findings still require human review before they can appear as approved handover claims.
- Generate a handover report after reviewing findings. Pending reviews must be resolved before executive sign-off. Export and sign-off require authentication.
- Demo sign-in is available only in non-production environments.

---

## 5. Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Motion, Lucide React
- **Backend:** Node.js, Express, tsx
- **AI Engine:** Google Gemini API (`gemini-3.8-flash` via `@google/genai`) with a grounded rule-based fallback
- **Document Ingestion:** PyMuPDF / pdf-parse with page-level text extraction
- **Security:** bcryptjs password hashing, JWT stateless authorization, RBAC
- **Persistence:** Relational in-memory store backed by atomic disk persistence (`data/knowbridge_store.json`)
