import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { Finding, ReviewStatus } from '../types/index.ts';
import { EvidenceStatusBadge } from '../components/common/EvidenceStatusBadge.tsx';
import { FindingCategoryBadge } from '../components/common/FindingCategoryBadge.tsx';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  UserCheck,
  Edit3,
  MessageSquare,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface Props {
  onInspectFinding: (finding: Finding) => void;
}

export const ReviewCenterPage: React.FC<Props> = ({ onInspectFinding }) => {
  const { findings, activeProject, refreshProjectData } = useProject();
  const { token, user } = useAuth();
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [quickNotes, setQuickNotes] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const pendingList = findings.filter((f) => f.reviewStatus === 'PENDING');
  const approvedList = findings.filter((f) => f.reviewStatus === 'APPROVED');
  const rejectedList = findings.filter((f) => f.reviewStatus === 'REJECTED');

  const filtered = findings.filter((f) => {
    if (filter === 'PENDING') return f.reviewStatus === 'PENDING';
    if (filter === 'APPROVED') return f.reviewStatus === 'APPROVED';
    if (filter === 'REJECTED') return f.reviewStatus === 'REJECTED';
    return true;
  });

  const handleQuickReview = async (findingId: string, status: ReviewStatus) => {
    setLoadingId(findingId);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/findings/${findingId}/review`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reviewStatus: status,
          reviewerNotes: quickNotes[findingId] || undefined,
        }),
      });

      if (res.ok) {
        await refreshProjectData();
      }
    } catch (err) {
      console.error('Quick review error:', err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-sky-400 mb-1">STAGE 4: REVIEW · HUMAN VERIFICATION QUEUE</div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Human Review & Governance Center</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Fundamental Product Rule: <strong className="text-slate-200">AI never approves its own findings.</strong> An
          authorized peer or tech lead must verify claims against original evidence before inclusion in
          the official handover dossier.
        </p>
      </div>

      {/* Review Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setFilter('PENDING')}
          className={`p-4 rounded-xl border text-left transition-colors ${
            filter === 'PENDING'
              ? 'bg-amber-950/40 border-amber-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Pending Review Queue</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {pendingList.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting reviewer assessment</p>
        </button>

        <button
          onClick={() => setFilter('APPROVED')}
          className={`p-4 rounded-xl border text-left transition-colors ${
            filter === 'APPROVED'
              ? 'bg-emerald-950/40 border-emerald-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Approved for Handover</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {approvedList.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Confirmed and signed off</p>
        </button>

        <button
          onClick={() => setFilter('REJECTED')}
          className={`p-4 rounded-xl border text-left transition-colors ${
            filter === 'REJECTED'
              ? 'bg-red-950/40 border-red-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Rejected / Excluded</span>
            <XCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-400 tabular-nums">
            {rejectedList.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Excluded from official dossier</p>
        </button>
      </div>

      {/* Filter Selector */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit">
        {[
          { id: 'PENDING', label: `Pending Queue (${pendingList.length})` },
          { id: 'APPROVED', label: `Approved (${approvedList.length})` },
          { id: 'REJECTED', label: `Rejected (${rejectedList.length})` },
          { id: 'ALL', label: `All (${findings.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              filter === tab.id
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Review Cards List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="p-12 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-500 text-xs">
            No findings in this review queue.
          </div>
        ) : (
          filtered.map((f) => (
            <div
              key={f.id}
              className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <FindingCategoryBadge category={f.category} />
                  <span className="text-slate-600">·</span>
                  <EvidenceStatusBadge status={f.evidenceStatus} />
                </div>
                <div className="text-xs font-mono text-slate-400">
                  Source: {f.sourceDocumentName} {f.pageNumber ? `(Page ${f.pageNumber})` : ''}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-200">{f.title}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{f.description}</p>
              </div>

              {/* Exact Evidence Excerpt */}
              {f.evidenceExcerpt && (
                <div className="p-3 bg-slate-950/70 border-l-2 border-sky-500 rounded-r text-xs text-slate-300 italic font-mono leading-relaxed">
                  "{f.evidenceExcerpt}"
                </div>
              )}

              {/* Existing reviewer notes */}
              {f.reviewerName && (
                <div className="p-2.5 bg-slate-950/40 border border-slate-800/60 rounded text-xs text-slate-400 flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>
                    Reviewed by <strong className="text-slate-200">{f.reviewerName}</strong>: "
                    {f.reviewerNotes || 'Approved'}"
                  </span>
                </div>
              )}

              {/* Review Actions Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                <div className="flex-1 max-w-lg">
                  <input
                    type="text"
                    value={quickNotes[f.id] || ''}
                    onChange={(e) =>
                      setQuickNotes({ ...quickNotes, [f.id]: e.target.value })
                    }
                    placeholder="Add transition notes for successor (e.g., 'Verified against Q3 audit')..."
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0 justify-end">
                  <button
                    onClick={() => onInspectFinding(f)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Deep Inspect
                  </button>
                  <button
                    onClick={() => handleQuickReview(f.id, 'REJECTED')}
                    disabled={loadingId === f.id}
                    className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/40 border border-red-900/50 rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleQuickReview(f.id, 'NEEDS_CLARIFICATION')}
                    disabled={loadingId === f.id}
                    className="px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-950/40 border border-amber-900/50 rounded-lg transition-colors"
                  >
                    Clarify
                  </button>
                  <button
                    onClick={() => handleQuickReview(f.id, 'APPROVED')}
                    disabled={loadingId === f.id}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
