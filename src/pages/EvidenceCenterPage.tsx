import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext.tsx';
import { Finding, EvidenceStatus } from '../types/index.ts';
import { EvidenceStatusBadge } from '../components/common/EvidenceStatusBadge.tsx';
import { FindingCategoryBadge } from '../components/common/FindingCategoryBadge.tsx';
import {
  ShieldCheck,
  Search,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  CheckCircle2,
  FileText,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface Props {
  onInspectFinding: (finding: Finding) => void;
}

export const EvidenceCenterPage: React.FC<Props> = ({ onInspectFinding }) => {
  const { findings, documents, activeProject } = useProject();
  const [filter, setFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const verifiedList = findings.filter((f) => f.evidenceStatus === 'VERIFIED');
  const uncertainList = findings.filter((f) => f.evidenceStatus === 'UNCERTAIN');
  const conflictingList = findings.filter((f) => f.evidenceStatus === 'CONFLICTING');
  const missingList = findings.filter((f) => f.evidenceStatus === 'MISSING_EVIDENCE');

  const filtered = findings.filter((f) => {
    if (filter === 'VERIFIED' && f.evidenceStatus !== 'VERIFIED') return false;
    if (filter === 'UNCERTAIN' && f.evidenceStatus !== 'UNCERTAIN') return false;
    if (filter === 'CONFLICTING' && f.evidenceStatus !== 'CONFLICTING') return false;
    if (filter === 'MISSING_EVIDENCE' && f.evidenceStatus !== 'MISSING_EVIDENCE') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.evidenceExcerpt && f.evidenceExcerpt.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <div className="text-xs font-mono text-sky-400 mb-1">STAGE 3: VERIFY · EVIDENCE & CITATIONS</div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Evidence Verification Center</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Every AI-generated claim is grounded in original project specifications. Unverified claims,
          ambiguous statements, and cross-source contradictions are flagged for human inspection.
        </p>
      </div>

      {/* Evidence Quality Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilter('VERIFIED')}
          className={`p-4 rounded-xl border text-left transition-colors ${
            filter === 'VERIFIED'
              ? 'bg-emerald-950/40 border-emerald-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Verified Findings</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {verifiedList.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Clearly supported by document text</p>
        </button>

        <button
          onClick={() => setFilter('CONFLICTING')}
          className={`p-4 rounded-xl border text-left transition-colors ${
            filter === 'CONFLICTING'
              ? 'bg-violet-950/40 border-violet-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Conflicting Sources</span>
            <AlertTriangle className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-violet-400 tabular-nums">
            {conflictingList.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Inconsistent directives detected</p>
        </button>

        <button
          onClick={() => setFilter('UNCERTAIN')}
          className={`p-4 rounded-xl border text-left transition-colors ${
            filter === 'UNCERTAIN'
              ? 'bg-amber-950/40 border-amber-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Uncertain Support</span>
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {uncertainList.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Incomplete or ambiguous wording</p>
        </button>

        <button
          onClick={() => setFilter('MISSING_EVIDENCE')}
          className={`p-4 rounded-xl border text-left transition-colors ${
            filter === 'MISSING_EVIDENCE'
              ? 'bg-rose-950/40 border-rose-500'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Missing Evidence</span>
            <AlertOctagon className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
            {missingList.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Questions with missing runbooks</p>
        </button>
      </div>

      {/* Conflicting Information Deep-Dive Callout (e.g. Stripe vs Adyen) */}
      {conflictingList.length > 0 && (
        <div className="p-5 bg-violet-950/20 border border-violet-800/40 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-violet-400" />
            <span>High-Priority Contradiction Highlight: Payment Gateway Evaluation</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="font-semibold text-slate-200 mb-1">
                Source 1: Architecture Specification (Pg 2)
              </div>
              <p className="text-slate-400 font-mono text-[11px] italic">
                "Platform engineering selected Stripe Elements for tokenization and sandboxing is 100% complete."
              </p>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="font-semibold text-slate-200 mb-1">
                Source 2: Payment Integration Notes (Pg 2)
              </div>
              <p className="text-slate-400 font-mono text-[11px] italic">
                "VP of Finance directed evaluation of Adyen due to EU interchange rate savings before November freeze."
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-300">
            <strong>Continuity Impact:</strong> Incoming lead Alex Rivera must schedule a 30-minute
            alignment with VP Finance before starting checkout payment abstraction refactor.
          </p>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          {['ALL', 'VERIFIED', 'CONFLICTING', 'UNCERTAIN', 'MISSING_EVIDENCE'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === f
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'ALL'
                ? `All (${findings.length})`
                : f === 'VERIFIED'
                ? `Verified (${verifiedList.length})`
                : f === 'CONFLICTING'
                ? `Conflicting (${conflictingList.length})`
                : f === 'UNCERTAIN'
                ? `Uncertain (${uncertainList.length})`
                : `Missing (${missingList.length})`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search claims or excerpts..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Grounded Evidence List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No evidence records found for this query.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => onInspectFinding(item)}
              className="p-4 hover:bg-slate-800/40 transition-colors cursor-pointer group"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <FindingCategoryBadge category={item.category} />
                  <span className="text-slate-600">·</span>
                  <EvidenceStatusBadge status={item.evidenceStatus} />
                </div>
                <div className="text-xs font-mono text-slate-400">
                  Document: {item.sourceDocumentName} {item.pageNumber ? `(Page ${item.pageNumber})` : ''}
                </div>
              </div>

              <h3 className="text-sm font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {item.description}
              </p>

              {item.evidenceExcerpt && (
                <div className="mt-2.5 p-2.5 bg-slate-950/60 border-l-2 border-sky-500 rounded-r text-xs text-slate-300 italic font-mono leading-relaxed">
                  "{item.evidenceExcerpt}"
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
                <div className="flex items-center gap-4">
                  {item.owner && <span>Owner: <strong className="text-slate-400">{item.owner}</strong></span>}
                  {item.severity && <span>Severity: <strong className="text-slate-400">{item.severity}</strong></span>}
                  <span>Review Status: <strong className="text-slate-300">{item.reviewStatus}</strong></span>
                </div>
                <div className="text-sky-400 group-hover:underline flex items-center gap-1 font-medium">
                  <span>View Original Page & Audit</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
