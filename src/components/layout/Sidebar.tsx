import React, { useEffect, useState } from 'react';
import { useProject } from '../../context/ProjectContext.tsx';
import {
  FolderKanban,
  FileText,
  Sparkles,
  ShieldCheck,
  CheckSquare,
  FileBarChart,
  Github,
  History,
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Plus,
  LayoutDashboard,
  CheckCircle2,
  Workflow,
  MessageSquare,
  Database,
  Compass,
  X,
} from 'lucide-react';

interface Props {
  currentView: string;
  setCurrentView: (view: string) => void;
  onOpenNewProjectModal: () => void;
  isMobileOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<Props> = ({
  currentView,
  setCurrentView,
  onOpenNewProjectModal,
  isMobileOpen,
  onClose,
}) => {
  const { projects, activeProject, setActiveProject, findings, documents } = useProject();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const updateViewport = () => setIsDesktop(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  const navigate = (view: string) => {
    setCurrentView(view);
    onClose();
  };

  const pendingReviews = findings.filter((f) => f.reviewStatus === 'PENDING').length;
  const activeRisks = findings.filter((f) => f.category === 'RISK' || f.category === 'BLOCKER').length;

  return (
    <aside
      id="app-navigation"
      aria-label="Workspace navigation"
      aria-hidden={!isDesktop && !isMobileOpen}
      inert={!isDesktop && !isMobileOpen}
      data-open={isMobileOpen}
      className="mobile-nav fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18rem,88vw)] shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-950 shadow-2xl shadow-black/30 transition-transform duration-200 lg:sticky lg:top-16 lg:z-30 lg:h-[calc(100dvh-4rem)] lg:w-64 lg:bg-slate-900 lg:shadow-none"
    >
      {/* Project Switcher */}
      <div className="p-4 border-b border-slate-800 relative">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Current Workspace
          </label>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
          aria-expanded={projectDropdownOpen}
          aria-haspopup="listbox"
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-950/70 hover:bg-slate-950 border border-slate-800 rounded-lg text-left transition-colors"
        >
          <div className="truncate pr-2">
            <div className="text-xs font-semibold text-slate-200 truncate">
              {activeProject?.name || 'Select Project'}
            </div>
            <div className="text-[10px] text-sky-400 font-mono truncate">
              {activeProject?.code || 'WORKSPACE'}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        {/* Project Selector Menu */}
        {projectDropdownOpen && (
          <div className="absolute left-4 right-4 top-[74px] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Switch Project
            </div>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActiveProject(p);
                  setProjectDropdownOpen(false);
                  onClose();
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors flex items-center justify-between ${
                  activeProject?.id === p.id ? 'bg-slate-800 text-sky-400 font-medium' : 'text-slate-300'
                }`}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">{p.code}</span>
              </button>
            ))}
            <div className="mt-1 pt-1 border-t border-slate-800 px-2">
              <button
                onClick={() => {
                  setProjectDropdownOpen(false);
                  onClose();
                  onOpenNewProjectModal();
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-sky-400 hover:bg-sky-950/30 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Project</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Nav Items */}
      <div className="px-3 py-4 space-y-6 flex-1">
        {/* Workflow Stages */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>5-Stage Workflow</span>
            <Workflow className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => navigate('workspace')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'workspace'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 text-[10px] font-mono text-slate-500">01</span>
                <span>Connect (Docs)</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                {documents.length}
              </span>
            </button>

            <button
              onClick={() => navigate('reconstruct')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'reconstruct'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 text-[10px] font-mono text-slate-500">02</span>
                <span>Reconstruct (AI)</span>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            </button>

            <button
              onClick={() => navigate('evidence')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'evidence'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 text-[10px] font-mono text-slate-500">03</span>
                <span>Verify (Evidence)</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                {findings.length}
              </span>
            </button>

            <button
              onClick={() => navigate('reviews')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'reviews'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 text-[10px] font-mono text-slate-500">04</span>
                <span>Review (Human)</span>
              </div>
              {pendingReviews > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 text-[10px] font-mono rounded">
                  {pendingReviews}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate('handover')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'handover'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 text-[10px] font-mono text-slate-500">05</span>
                <span>Handover (Report)</span>
              </div>
              <FileBarChart className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </div>
        </div>

        {/* Operational Modules */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Intelligence & Connectors
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => navigate('assistant')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'assistant'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span>AI Project Assistant</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 px-1 bg-emerald-500/10 rounded">RAG</span>
            </button>

            <button
              onClick={() => navigate('connectors')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'connectors'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Data Sources Center</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">API</span>
            </button>

            <button
              onClick={() => navigate('setup')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'setup'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-amber-400" />
                <span>Guided Setup Pipeline</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">6-Step</span>
            </button>

            <button
              onClick={() => navigate('graph')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'graph'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>3D Knowledge Graph</span>
              </div>
              <span className="text-[10px] font-mono text-sky-400/80 uppercase">3D</span>
            </button>

            <button
              onClick={() => navigate('tasks')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'tasks'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckSquare className="w-4 h-4" />
                <span>Tasks & Dependencies</span>
              </div>
            </button>

            <button
              onClick={() => navigate('risks')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'risks'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Risks & Blockers</span>
              </div>
              {activeRisks > 0 && (
                <span className="text-[11px] font-mono text-amber-400 tabular-nums">
                  {activeRisks}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate('github')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'github'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Github className="w-4 h-4" />
                <span>GitHub Integration</span>
              </div>
            </button>

            <button
              onClick={() => navigate('activity')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                currentView === 'activity'
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4" />
                <span>Activity & Audit</span>
              </div>
            </button>
          </div>
        </div>

        {/* Hackathon Submission Docs */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Hackathon Docs
          </div>
          <button
            onClick={() => navigate('docs')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              currentView === 'docs'
                ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>Round 2 Deliverables</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">R2</span>
          </button>
        </div>
      </div>

      {/* Continuity Health Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-slate-400">Handover Readiness</span>
          <span className="font-mono text-emerald-400 font-semibold">
            {findings.length > 0
              ? Math.round((findings.filter((f) => f.reviewStatus === 'APPROVED').length / findings.length) * 100)
              : 0}%
          </span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{
              width: `${
                findings.length > 0
                  ? Math.round(
                      (findings.filter((f) => f.reviewStatus === 'APPROVED').length / findings.length) * 100
                    )
                  : 0
              }%`,
            }}
          />
        </div>
        <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
          <span>Target: {activeProject?.targetHandoverDate || '2026-11-15'}</span>
          <span>Lead: {activeProject?.successorName?.split(' ')[0] || 'Alex'}</span>
        </div>
      </div>
    </aside>
  );
};
