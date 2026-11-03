import React, { useState } from 'react';
import {
  BookOpen,
  FileCode,
  Database,
  Shield,
  Sparkles,
  CheckCircle,
  Server,
  Layers,
  Terminal,
} from 'lucide-react';

export const DocumentationHubPage: React.FC = () => {
  const [activeDoc, setActiveDoc] = useState<string>('ROUND2_SUBMISSION');

  const docs = [
    { id: 'ROUND2_SUBMISSION', title: 'Round 2 Official Submission', icon: CheckCircle },
    { id: 'ARCHITECTURE', title: 'System Architecture & Data Flow', icon: Layers },
    { id: 'AI_PIPELINE', title: 'Gemini AI Pipeline & Grounding', icon: Sparkles },
    { id: 'DATABASE_SCHEMA', title: 'Database Schema & Relations', icon: Database },
    { id: 'SECURITY', title: 'Security, RBAC & Privacy', icon: Shield },
    { id: 'API_DOCUMENTATION', title: 'REST API Specification', icon: Server },
    { id: 'ROUND3_IMPROVEMENTS', title: 'Round 3 Roadmap Improvements', icon: Terminal },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <div className="text-xs font-mono text-sky-400 mb-1">WCC FORGE 48 · ROUND 2 · SYNTAX ERROR</div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Technical Documentation Hub</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Comprehensive engineering architecture, grounded AI extraction schemas, database design,
          and security audit specifications prepared for hackathon judges.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Nav list */}
        <div className="space-y-1">
          {docs.map((d) => {
            const Icon = d.icon;
            const isActive = activeDoc === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setActiveDoc(d.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{d.title}</span>
              </button>
            );
          })}
        </div>

        {/* Content Viewport */}
        <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-8 text-xs text-slate-300 space-y-6 leading-relaxed">
          {activeDoc === 'ROUND2_SUBMISSION' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] font-mono uppercase text-sky-400">Submission Dossier</span>
                <h2 className="text-lg font-bold text-white mt-1">WCC Forge 48 — Round 2 Build Report</h2>
                <div className="text-slate-400 mt-0.5">Team: SYNTAX ERROR · Product: KNOWBRIDGE AI</div>
              </div>
              <p>
                <strong>Problem Statement:</strong> "Prevent Critical Knowledge From Leaving With People."
                When engineers, researchers, or product leaders depart an organization, critical decision
                reasoning, unresolved tasks, dependencies, and risks frequently leave with them.
              </p>
              <h3 className="text-sm font-semibold text-slate-100 pt-2">Central 5-Stage Workflow</h3>
              <ol className="list-decimal pl-5 space-y-1 text-slate-300">
                <li><strong>CONNECT:</strong> Create project workspace, upload multi-page PDFs or link GitHub repositories.</li>
                <li><strong>RECONSTRUCT:</strong> Run server-side Gemini 3.8 Flash structured JSON schema extraction.</li>
                <li><strong>VERIFY:</strong> Inspect exact grounded source excerpts with page-level citations; flag conflicts and missing evidence.</li>
                <li><strong>REVIEW:</strong> Human reviewers approve, reject, or edit claims. <em>Rule: AI never approves its own findings.</em></li>
                <li><strong>HANDOVER:</strong> Generate official handover report with executive sign-off and printable PDF export.</li>
              </ol>
              <h3 className="text-sm font-semibold text-slate-100 pt-2">Completed Deliverables</h3>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li>Production-grade Express + React 19 full-stack engine with in-memory & file-backed relational persistence.</li>
                <li>Pre-seeded flagship demo project <strong>"E-Commerce Platform Migration" (Project Phoenix)</strong> with real synthetic documents.</li>
                <li>Real PDF parsing with page-level tracking via pdf-parse.</li>
                <li>Server-side Gemini 3.8 Flash integration with strict Type schema enforcement.</li>
                <li>Printable and downloadable PDF handover reports with executive sign-off audit.</li>
              </ul>
            </div>
          )}

          {activeDoc === 'ARCHITECTURE' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] font-mono uppercase text-sky-400">System Design</span>
                <h2 className="text-lg font-bold text-white mt-1">Architectural Topology & Data Flow</h2>
              </div>
              <p>
                KNOWBRIDGE AI is built using a hardened client-server topology designed to keep external API
                credentials strictly on the server while delivering instant, sub-200ms reactive client UI.
              </p>
              <div className="p-4 bg-slate-950 font-mono rounded text-[11px] text-sky-300 leading-normal overflow-x-auto">
                {`[CLIENT (React 19 + Tailwind v4 + Vite)]
   │
   ├── (JWT Bearer Token / HTTPS)
   ▼
[EXPRESS SERVER (Node.js / TypeScript)]
   │
   ├── [Auth & RBAC Middleware]
   ├── [PDF Text & Page Extractor (pdf-parse)]
   ├── [Gemini 3.8 Flash Service (@google/genai)]
   ├── [Relational Database Layer (db.ts / JSON Store)]
   └── [Handover Dossier & PDF Rendering Engine]`}
              </div>
              <h3 className="text-sm font-semibold text-slate-100 pt-2">Key Technical Decisions</h3>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li><strong>Server-Side Only Gemini API:</strong> The Gemini API key is never exposed to browser client bundles. Telemetry header User-Agent: 'aistudio-build' is enforced.</li>
                <li><strong>Page-Level Provenance:</strong> Every finding is explicitly linked to its source document ID and exact page number.</li>
                <li><strong>Relational Integrity:</strong> Deleting a document safely cleans up associated unverified findings.</li>
              </ul>
            </div>
          )}

          {activeDoc === 'AI_PIPELINE' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] font-mono uppercase text-sky-400">Model Configuration</span>
                <h2 className="text-lg font-bold text-white mt-1">Gemini 3.8 Flash Structured Extraction</h2>
              </div>
              <p>
                The AI extraction engine uses <code>gemini-3.8-flash</code> with structured JSON schemas
                enforced via <code>responseMimeType: "application/json"</code> and <code>responseSchema</code>.
              </p>
              <div className="p-3 bg-slate-950 rounded text-slate-400 font-mono text-[11px]">
                {`System Instruction Highlights:
- Ground every claim strictly in document text.
- Never present an AI inference as a verified fact.
- Categorize into DECISION, PENDING_TASK, RISK, BLOCKER, DEPENDENCY, UNRESOLVED_QUESTION.
- Flag evidenceStatus: VERIFIED | UNCERTAIN | CONFLICTING | MISSING_EVIDENCE.`}
              </div>
              <p>
                If the model detects conflicting directives (such as the Stripe Elements vs Adyen directive in the demo project),
                it tags the item as <code>CONFLICTING</code> and records the contradiction so human reviewers can intervene.
              </p>
            </div>
          )}

          {activeDoc === 'DATABASE_SCHEMA' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] font-mono uppercase text-sky-400">Data Model</span>
                <h2 className="text-lg font-bold text-white mt-1">Relational Database Entities</h2>
              </div>
              <p>The system defines 8 primary relational entities:</p>
              <div className="grid grid-cols-2 gap-3 text-slate-400">
                <div className="p-3 bg-slate-950 rounded">
                  <strong className="text-slate-200">users</strong>: id, email, name, role, title, passwordHash
                </div>
                <div className="p-3 bg-slate-950 rounded">
                  <strong className="text-slate-200">projects</strong>: id, name, code, status, ownerId, departingMember, successor
                </div>
                <div className="p-3 bg-slate-950 rounded">
                  <strong className="text-slate-200">documents</strong>: id, projectId, filename, filesize, pageCount, pages
                </div>
                <div className="p-3 bg-slate-950 rounded">
                  <strong className="text-slate-200">findings</strong>: id, projectId, title, category, evidenceStatus, reviewStatus, pageNumber, excerpt
                </div>
                <div className="p-3 bg-slate-950 rounded">
                  <strong className="text-slate-200">handover_reports</strong>: id, projectId, version, sections, executiveSignOff
                </div>
                <div className="p-3 bg-slate-950 rounded">
                  <strong className="text-slate-200">activity_logs</strong>: id, projectId, userId, action, category, details, timestamp
                </div>
              </div>
            </div>
          )}

          {activeDoc === 'SECURITY' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] font-mono uppercase text-sky-400">Security Architecture</span>
                <h2 className="text-lg font-bold text-white mt-1">Security, Privacy & RBAC Enforcement</h2>
              </div>
              <p>
                KNOWBRIDGE AI operates on strict zero-trust principles:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li><strong>Password Security:</strong> Passwords are hashed using bcrypt with salt rounds = 10.</li>
                <li><strong>JWT Verification:</strong> Stateless HMAC SHA-256 JWT tokens validated on every protected API endpoint.</li>
                <li><strong>Strict RBAC:</strong> Roles (OWNER, LEAD, REVIEWER, MEMBER) restrict review approvals and document deletions.</li>
                <li><strong>No Secrets in Client:</strong> Neither Gemini API keys nor GitHub tokens are ever transmitted to the frontend.</li>
                <li><strong>Audit Logging:</strong> Every document ingestion, review decision, and report export is immutably logged with actor ID and timestamp.</li>
              </ul>
            </div>
          )}

          {activeDoc === 'API_DOCUMENTATION' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] font-mono uppercase text-sky-400">API Contract</span>
                <h2 className="text-lg font-bold text-white mt-1">Documented REST Endpoints</h2>
              </div>
              <div className="space-y-2 font-mono text-[11px]">
                <div className="p-2 bg-slate-950 rounded flex justify-between">
                  <span className="text-emerald-400">POST /api/auth/register</span>
                  <span className="text-slate-500">Create account</span>
                </div>
                <div className="p-2 bg-slate-950 rounded flex justify-between">
                  <span className="text-emerald-400">POST /api/auth/login</span>
                  <span className="text-slate-500">Sign in with credentials</span>
                </div>
                <div className="p-2 bg-slate-950 rounded flex justify-between">
                  <span className="text-sky-400">GET /api/projects</span>
                  <span className="text-slate-500">List workspaces</span>
                </div>
                <div className="p-2 bg-slate-950 rounded flex justify-between">
                  <span className="text-emerald-400">POST /api/projects/:id/documents</span>
                  <span className="text-slate-500">Upload & parse PDF</span>
                </div>
                <div className="p-2 bg-slate-950 rounded flex justify-between">
                  <span className="text-violet-400">POST /api/documents/:id/process</span>
                  <span className="text-slate-500">Trigger Gemini extraction</span>
                </div>
                <div className="p-2 bg-slate-950 rounded flex justify-between">
                  <span className="text-emerald-400">POST /api/findings/:id/review</span>
                  <span className="text-slate-500">Approve / Reject finding</span>
                </div>
                <div className="p-2 bg-slate-950 rounded flex justify-between">
                  <span className="text-sky-400">POST /api/projects/:id/handover</span>
                  <span className="text-slate-500">Generate handover dossier</span>
                </div>
                <div className="p-2 bg-slate-950 rounded flex justify-between">
                  <span className="text-sky-400">GET /api/handover/:id/pdf</span>
                  <span className="text-slate-500">Printable HTML / PDF view</span>
                </div>
              </div>
            </div>
          )}

          {activeDoc === 'ROUND3_IMPROVEMENTS' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] font-mono uppercase text-sky-400">Future Roadmap</span>
                <h2 className="text-lg font-bold text-white mt-1">Three Substantial Round 3 Improvements</h2>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                  <h4 className="text-sm font-semibold text-sky-400">
                    1. Advanced Project Source Integrations
                  </h4>
                  <p className="text-slate-400 text-xs">
                    Expand authorized ingestors beyond PDFs and GitHub to include Jira issue boards, Confluence
                    spaces, Slack decision channels, and Figma design specs with end-to-end token encryption.
                  </p>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                  <h4 className="text-sm font-semibold text-violet-400">
                    2. Interactive Project Knowledge Graph
                  </h4>
                  <p className="text-slate-400 text-xs">
                    Connect decisions, tasks, dependencies, risks, documents, and code commits into an
                    explorable 2D/3D knowledge graph using WebGL and vector embeddings to visualize single points of failure.
                  </p>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                  <h4 className="text-sm font-semibold text-emerald-400">
                    3. AI-Powered Continuity Intelligence & Successor Onboarding Assistant
                  </h4>
                  <p className="text-slate-400 text-xs">
                    Proactive knowledge-gap detection that simulates an incoming engineer's first 90 days,
                    generates personalized learning paths, and highlights unassigned critical systems before the departure date.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
