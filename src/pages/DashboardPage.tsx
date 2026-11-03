import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { safeFetchJson } from '../utils/api.ts';
import {
  FileText,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Clock,
  Layers,
  FileBarChart,
  RefreshCw,
  FolderGit2,
  Database,
} from 'lucide-react';

interface Props {
  setCurrentView: (view: string) => void;
  onOpenNewProjectModal: () => void;
  onInspectFinding: (finding: any) => void;
}

export const DashboardPage: React.FC<Props> = ({
  setCurrentView,
  onOpenNewProjectModal,
  onInspectFinding,
}) => {
  const { activeProject, projects, documents, findings, resetDemoData } = useProject();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    async function loadStats() {
      const res = await safeFetchJson<any>('/api/stats');
      if (res.ok && res.data) {
        setStats(res.data);
      }
    }
    loadStats();
  }, [projects, documents, findings]);

  const approvedCount = findings.filter((f) => f.reviewStatus === 'APPROVED').length;
  const pendingCount = findings.filter((f) => f.reviewStatus === 'PENDING').length;
  const uncertainCount = findings.filter((f) => f.evidenceStatus === 'UNCERTAIN' || f.evidenceStatus === 'CONFLICTING').length;
  const activeRisks = findings.filter((f) => f.category === 'RISK' || f.category === 'BLOCKER');

  const continuityPct = findings.length > 0 ? Math.round((approvedCount / findings.length) * 100) : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner & Quick Persona Switcher for Hackathon Judges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 border border-slate-800 rounded-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
            <span>Hackathon Evaluation Workspace · Round 2 Build</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Preserving Critical Knowledge. Empowering Seamless Transition.
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Welcome, <strong className="text-slate-200">{user?.name}</strong>. Currently analyzing{' '}
            <strong className="text-sky-400">{activeProject?.name}</strong>. Outgoing lead{' '}
            <span className="text-slate-300 font-medium">{activeProject?.departingMemberName || 'Sarah Lin'}</span>{' '}
            handing over to{' '}
            <span className="text-slate-300 font-medium">{activeProject?.successorName || 'Alex Rivera'}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => setCurrentView('assistant')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask AI Assistant</span>
          </button>
          <button
            onClick={() => setCurrentView('connectors')}
            className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Data Sources</span>
          </button>
          <button
            onClick={() => setCurrentView('graph')}
            className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>3D Graph</span>
          </button>
          <button
            onClick={() => setCurrentView('handover')}
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <FileBarChart className="w-4 h-4" />
            <span>Handover Dossier</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (Tabular Numerals & High Density) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400 mb-1">Total Projects</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {stats?.totalProjects ?? projects.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Monitored</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400 mb-1">Parsed Documents</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {documents.length}
          </div>
          <div className="text-[11px] text-sky-400 mt-1">PDF & Specs</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400 mb-1">Extracted Findings</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {findings.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Structured Items</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400 mb-1">Human Approved</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
            {approvedCount}
          </div>
          <div className="text-[11px] text-emerald-500 mt-1">Confirmed</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400 mb-1">Pending Reviews</div>
          <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
            {pendingCount}
          </div>
          <div className="text-[11px] text-amber-500 mt-1">Requires Human Check</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs text-slate-400 mb-1">Active Risks & Blockers</div>
          <div className="text-2xl font-bold text-rose-400 font-mono tabular-nums">
            {activeRisks.length}
          </div>
          <div className="text-[11px] text-rose-500 mt-1">Urgent Attention</div>
        </div>
      </div>

      {/* Continuity Health & 5-Stage Central Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 5-Stage Pipeline Interactive Cards */}
        <div className="lg:col-span-2 p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Central 5-Stage Handover Pipeline
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every claim is verified from original source documents with human sign-off
              </p>
            </div>
            <button
              onClick={() => setCurrentView('workspace')}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
            >
              <span>Open Interactive Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
            {/* Stage 1 */}
            <div
              onClick={() => setCurrentView('workspace')}
              className="p-3.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 rounded-lg cursor-pointer transition-colors group flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block mb-1">
                  STAGE 1
                </span>
                <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                  CONNECT
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Upload project PDFs & GitHub links</p>
              </div>
              <div className="mt-4 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-emerald-400">
                {documents.length} Docs Synced
              </div>
            </div>

            {/* Stage 2 */}
            <div
              onClick={() => setCurrentView('reconstruct')}
              className="p-3.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 rounded-lg cursor-pointer transition-colors group flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block mb-1">
                  STAGE 2
                </span>
                <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                  RECONSTRUCT
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Gemini 3.8 Flash structured schema</p>
              </div>
              <div className="mt-4 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-sky-400">
                {findings.length} Findings
              </div>
            </div>

            {/* Stage 3 */}
            <div
              onClick={() => setCurrentView('evidence')}
              className="p-3.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 rounded-lg cursor-pointer transition-colors group flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block mb-1">
                  STAGE 3
                </span>
                <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                  VERIFY
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Grounded citations & conflict audits</p>
              </div>
              <div className="mt-4 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-violet-400">
                {uncertainCount} Flagged
              </div>
            </div>

            {/* Stage 4 */}
            <div
              onClick={() => setCurrentView('reviews')}
              className="p-3.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 rounded-lg cursor-pointer transition-colors group flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block mb-1">
                  STAGE 4
                </span>
                <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                  REVIEW
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Human authority approves claims</p>
              </div>
              <div className="mt-4 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-amber-400">
                {pendingCount} Pending
              </div>
            </div>

            {/* Stage 5 */}
            <div
              onClick={() => setCurrentView('handover')}
              className="p-3.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 rounded-lg cursor-pointer transition-colors group flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block mb-1">
                  STAGE 5
                </span>
                <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                  HANDOVER
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Dossier generation & PDF export</p>
              </div>
              <div className="mt-4 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-emerald-400">
                Ready to Export
              </div>
            </div>
          </div>
        </div>

        {/* Right: Handover Transition Health & Sign-off State */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-100">Handover Readiness</h3>
              <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                {continuityPct}%
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mb-3">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                style={{ width: `${continuityPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Based on {approvedCount} verified and approved findings out of {findings.length} total
              extracted knowledge points.
            </p>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Departing Lead:</span>
              <span className="text-slate-200 font-medium">
                {activeProject?.departingMemberName || 'Sarah Lin'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Successor:</span>
              <span className="text-slate-200 font-medium">
                {activeProject?.successorName || 'Alex Rivera'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Target Date:</span>
              <span className="text-sky-400 font-mono">
                {activeProject?.targetHandoverDate || '2026-11-15'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setCurrentView('handover')}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Review & Build Handover Report</span>
          </button>
        </div>
      </div>

      {/* Critical Handover Items Needing Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Risks & Blockers */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Critical Risks & Blockers ({activeRisks.length})
              </h3>
            </div>
            <button
              onClick={() => setCurrentView('risks')}
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              View Matrix
            </button>
          </div>

          <div className="space-y-2.5">
            {activeRisks.slice(0, 3).map((f) => (
              <div
                key={f.id}
                onClick={() => onInspectFinding(f)}
                className="p-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-200 truncate pr-2">{f.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-rose-950/60 text-rose-400 rounded shrink-0">
                    {f.severity || 'HIGH'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{f.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                  <span>Source: {f.sourceDocumentName} (Pg {f.pageNumber})</span>
                  <span>·</span>
                  <span className="text-sky-400 hover:underline">Inspect Evidence →</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Human Reviews Queue */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Pending Review Queue ({pendingCount})
              </h3>
            </div>
            <button
              onClick={() => setCurrentView('reviews')}
              className="text-xs text-sky-400 hover:text-sky-300"
            >
              Open Queue
            </button>
          </div>

          <div className="space-y-2.5">
            {findings
              .filter((f) => f.reviewStatus === 'PENDING')
              .slice(0, 3)
              .map((f) => (
                <div
                  key={f.id}
                  onClick={() => onInspectFinding(f)}
                  className="p-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-200 truncate pr-2">{f.title}</span>
                    <span className="text-[10px] font-mono text-amber-400 shrink-0">
                      {f.evidenceStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{f.description}</p>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                    <span>{f.category}</span>
                    <span className="text-sky-400 hover:underline">Verify & Approve →</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
