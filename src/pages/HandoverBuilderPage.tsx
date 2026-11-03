import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { HandoverReport, Finding } from '../types/index.ts';
import { EvidenceStatusBadge } from '../components/common/EvidenceStatusBadge.tsx';
import { FindingCategoryBadge } from '../components/common/FindingCategoryBadge.tsx';
import { safeFetchJson } from '../utils/api.ts';
import { syncHandoverReportToFirestore } from '../firebase/firestoreService.ts';
import {
  FileBarChart,
  FileDown,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  GitCommit,
  CheckSquare,
  Layers,
  HelpCircle,
  ExternalLink,
  Sparkles,
  UserCheck,
} from 'lucide-react';

interface Props {
  onInspectFinding: (finding: Finding) => void;
}

export const HandoverBuilderPage: React.FC<Props> = ({ onInspectFinding }) => {
  const { activeProject, findings, documents } = useProject();
  const { token, user } = useAuth();

  const [reports, setReports] = useState<HandoverReport[]>([]);
  const [activeReport, setActiveReport] = useState<HandoverReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [signOffNotes, setSignOffNotes] = useState('');
  const [isSigningOff, setIsSigningOff] = useState(false);
  const [signOffSuccess, setSignOffSuccess] = useState(false);

  useEffect(() => {
    async function loadReports() {
      if (!activeProject) return;
      const res = await safeFetchJson<{ reports: HandoverReport[] }>(
        `/api/projects/${activeProject.id}/handover`
      );
      if (res.ok && res.data?.reports) {
        setReports(res.data.reports);
        if (res.data.reports.length > 0) {
          setActiveReport(res.data.reports[res.data.reports.length - 1]);
        }
      }
    }
    loadReports();
  }, [activeProject]);

  const handleGenerateReport = async () => {
    if (!activeProject) return;
    setIsGenerating(true);
    try {
      const res = await safeFetchJson<{ report: HandoverReport }>(
        `/api/projects/${activeProject.id}/handover`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: customTitle || `${activeProject.name} — Handover Dossier v1.0`,
          }),
        }
      );

      if (res.ok && res.data?.report) {
        setActiveReport(res.data.report);
        setReports((prev) => [...prev, res.data!.report]);
        syncHandoverReportToFirestore(activeProject.id, res.data.report).catch(() => {});
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecutiveSignOff = async () => {
    if (!activeReport) return;
    setIsSigningOff(true);
    try {
      const res = await safeFetchJson<{ report: HandoverReport }>(
        `/api/handover/${activeReport.id}/signoff`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: signOffNotes }),
        }
      );

      if (res.ok && res.data?.report) {
        setActiveReport(res.data.report);
        setSignOffSuccess(true);
        if (activeProject) {
          syncHandoverReportToFirestore(activeProject.id, res.data.report).catch(() => {});
        }
        setTimeout(() => setSignOffSuccess(false), 3000);
      }
    } finally {
      setIsSigningOff(false);
    }
  };

  const approvedFindings = findings.filter((f) => f.reviewStatus === 'APPROVED');
  const pendingFindings = findings.filter((f) => f.reviewStatus === 'PENDING');

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-sky-400 mb-1">STAGE 5: HANDOVER · OFFICIAL REPORT DOSSIER</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Handover Report Builder</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Generates the comprehensive knowledge handover dossier for the successor. Clearly separates
            peer-approved verified findings from pending or unresolved claims.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeReport && (
            <div className="flex items-center gap-2">
              <a
                href={`/api/handover/${activeReport.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-2"
                title="Open formatted dossier for print or PDF export"
              >
                <Printer className="w-4 h-4 text-sky-400" />
                <span>Print Dossier</span>
              </a>
              <a
                href={`/api/handover/${activeReport.id}/pdf?download=1`}
                download={`KNOWBRIDGE_Handover_${activeReport.id}.html`}
                className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-2"
                title="Download complete standalone HTML report file"
              >
                <FileDown className="w-4 h-4 text-emerald-400" />
                <span>Download Report</span>
              </a>
            </div>
          )}
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <FileBarChart className="w-4 h-4" />
            <span>{isGenerating ? 'Compiling Dossier...' : 'Generate New Handover Report'}</span>
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            {approvedFindings.length}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200">
              {approvedFindings.length} Peer-Approved Handover Claims
            </div>
            <div className="text-[11px] text-slate-400">
              {pendingFindings.length} unapproved findings will be clearly segregated as Unresolved
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="text-right">
            <div className="text-slate-400">Successor Lead</div>
            <div className="font-semibold text-slate-200">{activeProject?.successorName || 'Alex Rivera'}</div>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="text-right">
            <div className="text-slate-400">Target Handover</div>
            <div className="font-mono text-sky-400">{activeProject?.targetHandoverDate || '2026-11-15'}</div>
          </div>
        </div>
      </div>

      {/* Active Report Document View */}
      {activeReport ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          {/* Dossier Header Bar */}
          <div className="px-6 py-5 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-sky-400">
                Official Knowledge Handover Dossier · {activeReport.id}
              </div>
              <h2 className="text-lg font-bold text-white mt-1">{activeReport.title}</h2>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span>Version {activeReport.version}</span>
                <span>·</span>
                <span>Compiled by {activeReport.generatedByName}</span>
                <span>·</span>
                <span>{new Date(activeReport.generatedAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={`/api/handover/${activeReport.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs text-sky-400 hover:text-white bg-sky-950/40 hover:bg-sky-900/40 border border-sky-800/60 rounded-lg transition-colors flex items-center gap-1.5 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Clean PDF View</span>
              </a>
            </div>
          </div>

          <div className="p-8 space-y-8 text-xs text-slate-300">
            {/* 1. Overview */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-1.5 flex items-center gap-2">
                <span className="text-sky-400 font-mono">01.</span>
                <span>Executive Continuity Overview</span>
              </h3>
              <p className="text-slate-300 leading-relaxed text-xs">{activeReport.projectOverview}</p>
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-slate-400">
                {activeReport.currentStatus}
              </div>
            </section>

            {/* 2. Recommended Next Actions for Successor (Immediate Checklist) */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-1.5 flex items-center gap-2">
                <span className="text-sky-400 font-mono">02.</span>
                <span>Recommended Successor Immediate Actions (Day 1 - Day 30)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeReport.recommendedNextActions.map((act) => (
                  <div
                    key={act.priority}
                    className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-400">Priority #{act.priority}</span>
                      {act.deadline && (
                        <span className="text-[10px] font-mono text-slate-500">Due: {act.deadline}</span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-200">{act.title}</div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{act.description}</p>
                    <div className="text-[10px] text-slate-500 pt-1">
                      Assigned Successor: <strong className="text-slate-300">{act.suggestedOwner}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Architectural & Technical Decisions */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-1.5 flex items-center gap-2">
                <span className="text-sky-400 font-mono">03.</span>
                <span>Architectural & Technical Decisions with Rationale</span>
              </h3>
              <div className="space-y-2">
                {activeReport.decisions.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => onInspectFinding(f)}
                    className="p-3 bg-slate-950/50 hover:bg-slate-950 border border-slate-800 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-200">{f.title}</span>
                      <EvidenceStatusBadge status={f.evidenceStatus} />
                    </div>
                    <p className="text-xs text-slate-400">{f.description}</p>
                    {f.evidenceExcerpt && (
                      <div className="mt-2 text-[11px] font-mono text-slate-400 italic bg-slate-900 px-2.5 py-1 rounded border-l border-sky-500">
                        "{f.evidenceExcerpt}" — {f.sourceDocumentName} (Pg {f.pageNumber})
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Pending Tasks with Owners and Deadlines */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-1.5 flex items-center gap-2">
                <span className="text-sky-400 font-mono">04.</span>
                <span>Outstanding Tasks & Handover Assignments</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-500 uppercase">
                      <th className="py-2.5 px-3">Task Title</th>
                      <th className="py-2.5 px-3">Assigned Owner</th>
                      <th className="py-2.5 px-3">Target Deadline</th>
                      <th className="py-2.5 px-3">Evidence Source</th>
                      <th className="py-2.5 px-3">Review State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeReport.pendingTasks.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => onInspectFinding(t)}
                        className="hover:bg-slate-950/40 cursor-pointer"
                      >
                        <td className="py-2.5 px-3 font-medium text-slate-200">{t.title}</td>
                        <td className="py-2.5 px-3 text-slate-400">{t.owner || 'Unassigned'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{t.deadline || 'Flexible'}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {t.sourceDocumentName} (Pg {t.pageNumber})
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-semibold ${
                              t.reviewStatus === 'APPROVED' ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {t.reviewStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 5. Risks and Blockers */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-1.5 flex items-center gap-2">
                <span className="text-rose-400 font-mono">05.</span>
                <span>Active Operational Risks & Blockers</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeReport.risksAndBlockers.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => onInspectFinding(r)}
                    className="p-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-lg cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{r.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-rose-950/60 text-rose-400 rounded">
                        {r.severity || 'HIGH'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{r.description}</p>
                    <div className="text-[10px] text-slate-500">
                      Source: {r.sourceDocumentName} (Pg {r.pageNumber})
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 6. Unresolved Questions & Missing Evidence */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-100 border-b border-slate-800 pb-1.5 flex items-center gap-2">
                <span className="text-amber-400 font-mono">06.</span>
                <span>Flagged Missing Evidence & Unresolved Questions</span>
              </h3>
              <div className="p-4 bg-amber-950/15 border border-amber-900/30 rounded-lg space-y-3">
                {activeReport.unresolvedQuestions.map((q) => (
                  <div key={q.id} className="text-xs space-y-1">
                    <div className="flex items-center gap-2 text-amber-300 font-medium">
                      <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{q.title}</span>
                    </div>
                    <p className="text-slate-400 pl-5 text-[11px] leading-relaxed">{q.description}</p>
                    {q.uncertaintyReason && (
                      <p className="text-amber-400/80 pl-5 text-[11px] italic">
                        Verification Gap: {q.uncertaintyReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 7. Source Documentation Index */}
            <section className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Audited Source References
              </h4>
              <ul className="space-y-1 text-slate-400 text-xs">
                {activeReport.sourceReferences.map((s) => (
                  <li key={s.documentId} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    <span className="text-slate-200">{s.filename}</span>
                    <span className="text-slate-500">— {s.pagesCovered} ({s.findingsCount} findings substantiated)</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Executive Sign-Off Section */}
            <section className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Executive Handover Sign-Off & Acceptance
                  </h4>
                </div>
                {activeReport.executiveSignOff && (
                  <span className="text-xs font-medium text-emerald-400">Signed & Accepted</span>
                )}
              </div>

              {activeReport.executiveSignOff ? (
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-emerald-300">
                    Sign-Off Recorded by {activeReport.executiveSignOff.approvedBy} on{' '}
                    {new Date(activeReport.executiveSignOff.approvalDate).toLocaleDateString()}
                  </div>
                  <p className="text-slate-300 italic">"{activeReport.executiveSignOff.notes}"</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Sign off to formally accept project continuity responsibility and confirm that all
                    supporting evidence has been verified.
                  </p>
                  <textarea
                    value={signOffNotes}
                    onChange={(e) => setSignOffNotes(e.target.value)}
                    placeholder="Enter executive sign-off comments (e.g. 'Handover transition accepted. Reviewed Stripe/Adyen open directive and key escrow protocols.')..."
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {signOffSuccess && (
                    <div className="text-xs text-emerald-400">Sign-off confirmed successfully.</div>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={handleExecutiveSignOff}
                      disabled={isSigningOff}
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{isSigningOff ? 'Recording Sign-Off...' : 'Execute Formal Sign-Off'}</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div className="p-16 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-4">
          <FileBarChart className="w-12 h-12 text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-semibold text-slate-200">No Handover Report Generated Yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Click the button below to compile all stored findings, decisions, tasks, and citations into an
              official project handover dossier.
            </p>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Official Handover Dossier</span>
          </button>
        </div>
      )}
    </div>
  );
};
