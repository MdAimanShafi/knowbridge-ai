import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext.tsx';
import { Finding } from '../types/index.ts';
import { EvidenceStatusBadge } from '../components/common/EvidenceStatusBadge.tsx';
import { FindingCategoryBadge } from '../components/common/FindingCategoryBadge.tsx';
import {
  CheckSquare,
  AlertTriangle,
  Ban,
  Link2,
  Clock,
  User,
  Calendar,
  AlertOctagon,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface Props {
  onInspectFinding: (finding: Finding) => void;
}

export const TaskRiskPage: React.FC<Props> = ({ onInspectFinding }) => {
  const { findings, activeProject } = useProject();
  const [tab, setTab] = useState<'TASKS' | 'RISKS' | 'DEPENDENCIES'>('TASKS');

  const tasks = findings.filter((f) => f.category === 'PENDING_TASK' || f.category === 'COMPLETED_WORK');
  const risks = findings.filter((f) => f.category === 'RISK' || f.category === 'BLOCKER');
  const dependencies = findings.filter((f) => f.category === 'DEPENDENCY');

  const pendingTasks = tasks.filter((t) => t.category === 'PENDING_TASK');
  const completedTasks = tasks.filter((t) => t.category === 'COMPLETED_WORK');

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <div className="text-xs font-mono text-sky-400 mb-1">OPERATIONAL CONTINUITY ENGINE</div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Tasks, Dependencies & Risk Matrix</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Comprehensive inventory of outstanding work, cross-team technical dependencies, and high-impact
          risks that require immediate attention during the team transition.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setTab('TASKS')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === 'TASKS' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tasks ({pendingTasks.length} pending, {completedTasks.length} done)
        </button>
        <button
          onClick={() => setTab('RISKS')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === 'RISKS' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Risks & Blockers ({risks.length})
        </button>
        <button
          onClick={() => setTab('DEPENDENCIES')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === 'DEPENDENCIES' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Technical Dependencies ({dependencies.length})
        </button>
      </div>

      {/* TASKS VIEW */}
      {tab === 'TASKS' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Outstanding Handover Tasks ({pendingTasks.length})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Click any task to inspect source citations
              </span>
            </div>
            <div className="divide-y divide-slate-800">
              {pendingTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onInspectFinding(t)}
                  className="p-4 hover:bg-slate-800/40 transition-colors cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                        {t.title}
                      </span>
                      <EvidenceStatusBadge status={t.evidenceStatus} showIcon={false} />
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">{t.description}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Source: {t.sourceDocumentName} (Pg {t.pageNumber})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-xs">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase">Assigned Owner</div>
                      <div className="font-medium text-slate-300">{t.owner || 'Unassigned'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase">Target Deadline</div>
                      <div className="font-mono text-sky-400">{t.deadline || 'Flexible'}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-sky-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Completed Deliverables */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60">
              <span className="text-xs font-semibold text-slate-200">
                Completed Deliverables & Milestones ({completedTasks.length})
              </span>
            </div>
            <div className="divide-y divide-slate-800">
              {completedTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onInspectFinding(t)}
                  className="p-4 hover:bg-slate-800/40 transition-colors cursor-pointer group flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-400">
                      {t.title}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>
                  </div>
                  <div className="text-xs text-emerald-400 font-medium shrink-0 ml-4">
                    Verified Completed
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RISKS VIEW */}
      {tab === 'RISKS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {risks.map((r) => (
            <div
              key={r.id}
              onClick={() => onInspectFinding(r)}
              className="p-5 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors cursor-pointer space-y-3"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FindingCategoryBadge category={r.category} />
                  <span className="text-slate-600">·</span>
                  <EvidenceStatusBadge status={r.evidenceStatus} />
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    r.severity === 'CRITICAL'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}
                >
                  {r.severity || 'HIGH'}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-200 hover:text-sky-400 transition-colors">
                  {r.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{r.description}</p>
              </div>

              {r.evidenceExcerpt && (
                <div className="p-2.5 bg-slate-950/60 rounded border-l-2 border-rose-500 font-mono text-xs text-slate-300 italic">
                  "{r.evidenceExcerpt}"
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
                <span>Owner: {r.owner || 'Needs Assignment'}</span>
                <span>Due: {r.deadline || 'Pre-Launch'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DEPENDENCIES VIEW */}
      {tab === 'DEPENDENCIES' && (
        <div className="space-y-4">
          {dependencies.map((d) => (
            <div
              key={d.id}
              onClick={() => onInspectFinding(d)}
              className="p-5 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <FindingCategoryBadge category={d.category} />
                <span className="text-xs text-slate-400">
                  {d.sourceDocumentName} (Pg {d.pageNumber})
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-200">{d.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{d.description}</p>
              {d.evidenceExcerpt && (
                <div className="p-2.5 bg-slate-950/60 rounded border-l-2 border-indigo-500 font-mono text-xs text-slate-300 italic">
                  "{d.evidenceExcerpt}"
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
