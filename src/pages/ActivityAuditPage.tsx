import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { ActivityLog } from '../types/index.ts';
import { safeFetchJson } from '../utils/api.ts';
import {
  History,
  FileText,
  Sparkles,
  ShieldCheck,
  FileBarChart,
  Github,
  FolderKanban,
  Search,
} from 'lucide-react';

export const ActivityAuditPage: React.FC = () => {
  const { activeProject } = useProject();
  const { token } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  useEffect(() => {
    async function fetchLogs() {
      if (!activeProject) return;
      const res = await safeFetchJson<{ logs: ActivityLog[] }>(
        `/api/projects/${activeProject.id}/activity`
      );
      if (res.ok && res.data?.logs) {
        setLogs(res.data.logs);
      }
    }
    fetchLogs();
  }, [activeProject]);

  const filteredLogs = logs.filter((log) => {
    if (filterCategory === 'ALL') return true;
    return log.category === filterCategory;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'DOCUMENT':
        return <FileText className="w-3.5 h-3.5 text-sky-400" />;
      case 'AI_EXTRACTION':
        return <Sparkles className="w-3.5 h-3.5 text-violet-400" />;
      case 'REVIEW':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
      case 'HANDOVER':
        return <FileBarChart className="w-3.5 h-3.5 text-blue-400" />;
      case 'GITHUB':
        return <Github className="w-3.5 h-3.5 text-slate-300" />;
      default:
        return <FolderKanban className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <div className="text-xs font-mono text-sky-400 mb-1">COMPLIANCE & GOVERNANCE LOG</div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Project Activity & Audit Trail</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Immutable history of all project actions: document ingestion, AI extraction pipelines, human
          review sign-offs, and handover dossier exports.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit">
        {['ALL', 'DOCUMENT', 'AI_EXTRACTION', 'REVIEW', 'HANDOVER', 'GITHUB'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              filterCategory === cat
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Audit Log Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No activity logs found for this filter.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-slate-800/40 transition-colors">
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                {getCategoryIcon(log.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">{log.action}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase px-1.5 py-0.2 bg-slate-950 rounded">
                      {log.category}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{log.details}</p>
                <div className="text-[11px] text-slate-500 mt-1">
                  Actor: <strong className="text-slate-300">{log.userName}</strong>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
