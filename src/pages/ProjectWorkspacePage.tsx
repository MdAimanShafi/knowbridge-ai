import React, { useState, useRef, useEffect } from 'react';
import { useProject } from '../context/ProjectContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { EvidenceStatusBadge } from '../components/common/EvidenceStatusBadge.tsx';
import { FindingCategoryBadge } from '../components/common/FindingCategoryBadge.tsx';
import { Finding, ProjectDocument } from '../types/index.ts';
import { safeFetchJson } from '../utils/api.ts';
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  FileBarChart,
  ChevronRight,
  Filter,
  Eye,
  Check,
  X,
  RefreshCw,
  Layers,
  Clock,
  Github,
  Plus,
  HelpCircle,
  AlertOctagon,
  FileDown,
} from 'lucide-react';

interface Props {
  setCurrentView: (view: string) => void;
  onInspectFinding: (finding: Finding) => void;
}

export const ProjectWorkspacePage: React.FC<Props> = ({ setCurrentView, onInspectFinding }) => {
  const { activeProject, documents, findings, refreshProjectData } = useProject();
  const { token, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeStage, setActiveStage] = useState<number>(1);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [notification, setNotification] = useState<string>('');
  const [analysisWarning, setAnalysisWarning] = useState<string>('');
  const [aiProvider, setAiProvider] = useState<'GEMINI' | 'GROUNDED_FALLBACK' | null>(null);

  useEffect(() => {
    let active = true;
    safeFetchJson<{ aiProvider: 'GEMINI' | 'GROUNDED_FALLBACK' }>('/api/health').then((response) => {
      if (active && response.ok && response.data) setAiProvider(response.data.aiProvider);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProject) return;

    setIsUploading(true);
    setUploadError('');
    setNotification('');
    setAnalysisWarning('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/projects/${activeProject.id}/documents`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json();
      setNotification(
        data.isDuplicate
          ? `"${file.name}" is already in this project. Existing document and findings were kept.`
          : `Parsed "${file.name}" (${data.document.pageCount} pages) and extracted ${data.findingsExtracted || 0} findings${data.analysisProvider === 'GEMINI' ? ' with Gemini' : ' with grounded rules'}.`
      );
      setAnalysisWarning(data.analysisWarning || '');
      await refreshProjectData();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProcessDocument = async (docId: string) => {
    setIsProcessing(docId);
    setNotification('');
    setUploadError('');
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/documents/${docId}/process`, {
        method: 'POST',
        headers,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Document reconstruction failed.');
      setNotification(
        `Reconstructed ${data.count} structured findings ${data.analysisProvider === 'GEMINI' ? 'with Gemini' : 'with grounded rules'}.`
      );
      setAnalysisWarning(data.analysisWarning || '');
      await refreshProjectData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Document reconstruction failed.');
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredFindings = findings.filter((f) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'PENDING') return f.reviewStatus === 'PENDING';
    if (selectedFilter === 'APPROVED') return f.reviewStatus === 'APPROVED';
    if (selectedFilter === 'VERIFIED') return f.evidenceStatus === 'VERIFIED';
    if (selectedFilter === 'UNCERTAIN') return f.evidenceStatus === 'UNCERTAIN';
    if (selectedFilter === 'CONFLICTING') return f.evidenceStatus === 'CONFLICTING';
    if (selectedFilter === 'MISSING') return f.evidenceStatus === 'MISSING_EVIDENCE';
    if (selectedFilter === 'DECISIONS') return f.category === 'DECISION';
    if (selectedFilter === 'TASKS') return f.category === 'PENDING_TASK';
    if (selectedFilter === 'RISKS') return f.category === 'RISK' || f.category === 'BLOCKER';
    return true;
  });

  const approvedCount = findings.filter((f) => f.reviewStatus === 'APPROVED').length;
  const pendingCount = findings.filter((f) => f.reviewStatus === 'PENDING').length;
  const conflictingCount = findings.filter((f) => f.evidenceStatus === 'CONFLICTING').length;
  const missingCount = findings.filter((f) => f.evidenceStatus === 'MISSING_EVIDENCE').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-mono mb-1">
            <span>{activeProject?.code}</span>
            <span>·</span>
            <span>{activeProject?.category}</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{activeProject?.name}</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {activeProject?.description}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setCurrentView('assistant')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>Ask AI Assistant</span>
          </button>
          <button
            onClick={() => setCurrentView('graph')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>3D Graph</span>
          </button>
          <button
            onClick={() => setCurrentView('handover')}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            <FileBarChart className="w-4 h-4" />
            <span>Generate Handover Report</span>
          </button>
        </div>
      </div>

      {/* 5-Stage Central Workflow Timeline Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
          <span>Central Continuity Pipeline: 5-Stage Transition Progress</span>
          <span className="font-mono text-sky-400">STAGE 0{activeStage} ACTIVE</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {[
            { id: 1, title: 'Connect', desc: 'Documents & GitHub', count: `${documents.length} docs` },
            { id: 2, title: 'Reconstruct', desc: 'AI Extraction Engine', count: `${findings.length} findings` },
            { id: 3, title: 'Verify', desc: 'Evidence & Citations', count: `${conflictingCount + missingCount} flagged` },
            { id: 4, title: 'Review', desc: 'Human Approval Queue', count: `${pendingCount} pending` },
            { id: 5, title: 'Handover', desc: 'Structured Report', count: `${approvedCount} confirmed` },
          ].map((stage) => {
            const isActive = activeStage === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStage(stage.id)}
                className={`p-3 text-left rounded-lg transition-all border ${
                  isActive
                    ? 'bg-sky-600/15 border-sky-500/50 shadow-sm'
                    : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-950 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className={isActive ? 'text-sky-400 font-bold' : 'text-slate-500'}>
                    0{stage.id}
                  </span>
                  <span className="text-slate-400 tabular-nums">{stage.count}</span>
                </div>
                <div
                  className={`text-xs font-semibold ${
                    isActive ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {stage.title}
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{stage.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 rounded-lg flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification('')} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {analysisWarning && (
        <div role="status" className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-200">
          {analysisWarning}
        </div>
      )}

      {uploadError && (
        <div className="p-3 bg-red-950/40 border border-red-800 text-xs text-red-300 rounded-lg flex items-center justify-between">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError('')} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STAGE 1: CONNECT VIEW */}
      {activeStage === 1 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Connected Project Documents & Sources
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Authorized documentation loaded for project knowledge preservation.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3.5 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>{isUploading ? 'Extracting Text...' : 'Upload PDF / Specification'}</span>
              </button>
            </div>
          </div>

          {/* Document Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Document Name</th>
                  <th className="py-3 px-4">Pages</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Uploader</th>
                  <th className="py-3 px-4">Extraction Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {documents.map((doc) => {
                  const docFindings = findings.filter((f) => f.sourceDocumentId === doc.id);
                  return (
                    <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                          <span className="font-medium text-slate-200">{doc.filename}</span>
                        </div>
                        {doc.summary && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 max-w-md">
                            {doc.summary}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 tabular-nums">
                        {doc.pageCount} pages
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 tabular-nums">
                        {(doc.filesize / 1024).toFixed(0)} KB
                      </td>
                      <td className="py-3 px-4 text-slate-400">{doc.uploaderName}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Extracted ({docFindings.length} findings)</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleProcessDocument(doc.id)}
                          disabled={isProcessing === doc.id}
                          className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                        >
                          {isProcessing === doc.id ? 'Reconstructing...' : 'Reprocess'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STAGE 2: RECONSTRUCT VIEW */}
      {activeStage === 2 && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
                    Project Knowledge Analysis
                  </h3>
                  <p className="text-xs text-slate-400">
                    Extracts decisions, tasks, dependencies, and risks from source text, then checks every citation against its page.
                  </p>
                </div>
              </div>
              <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>
                  {aiProvider === null
                    ? 'Checking AI provider...'
                    : aiProvider === 'GEMINI'
                      ? 'Gemini configured'
                      : 'Grounded rules fallback'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="text-slate-400 mb-1">Architecture Decisions</div>
                <div className="text-xl font-bold font-mono text-sky-400">
                  {findings.filter((f) => f.category === 'DECISION').length}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="text-slate-400 mb-1">Pending Incomplete Tasks</div>
                <div className="text-xl font-bold font-mono text-blue-400">
                  {findings.filter((f) => f.category === 'PENDING_TASK').length}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="text-slate-400 mb-1">Identified Dependencies</div>
                <div className="text-xl font-bold font-mono text-indigo-400">
                  {findings.filter((f) => f.category === 'DEPENDENCY').length}
                </div>
              </div>
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="text-slate-400 mb-1">Risks & Blockers</div>
                <div className="text-xl font-bold font-mono text-rose-400">
                  {findings.filter((f) => f.category === 'RISK' || f.category === 'BLOCKER').length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGES 2, 3, 4, 5: FINDINGS EXPLORER TABLE (CENTRAL WORKFLOW CORE) */}
      <div className="space-y-4">
        {/* Interactive Segmented Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            {[
              { id: 'ALL', label: `All Findings (${findings.length})` },
              { id: 'PENDING', label: `Pending Review (${pendingCount})` },
              { id: 'APPROVED', label: `Approved (${approvedCount})` },
              { id: 'VERIFIED', label: 'Verified Evidence' },
              { id: 'CONFLICTING', label: `Conflicting (${conflictingCount})` },
              { id: 'MISSING', label: `Missing Evidence (${missingCount})` },
              { id: 'DECISIONS', label: 'Decisions' },
              { id: 'TASKS', label: 'Pending Tasks' },
              { id: 'RISKS', label: 'Risks & Blockers' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedFilter === tab.id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500 font-mono">
            Showing {filteredFindings.length} items
          </span>
        </div>

        {/* Findings List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
          {filteredFindings.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No findings match the selected filter.
            </div>
          ) : (
            filteredFindings.map((finding) => (
              <div
                key={finding.id}
                onClick={() => onInspectFinding(finding)}
                className="p-4 hover:bg-slate-800/40 transition-colors cursor-pointer group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <FindingCategoryBadge category={finding.category} />
                    <span className="text-slate-600">·</span>
                    <EvidenceStatusBadge status={finding.evidenceStatus} />
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-semibold ${
                        finding.reviewStatus === 'APPROVED'
                          ? 'text-emerald-400'
                          : finding.reviewStatus === 'REJECTED'
                          ? 'text-red-400'
                          : finding.reviewStatus === 'NEEDS_CLARIFICATION'
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {finding.reviewStatus}
                    </span>
                    {finding.reviewerName && (
                      <span className="text-slate-500 text-[11px]">
                        by {finding.reviewerName.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-slate-200 group-hover:text-sky-400 transition-colors">
                  {finding.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {finding.description}
                </p>

                {/* Evidence Excerpt Preview */}
                {finding.evidenceExcerpt && (
                  <div className="mt-2 text-xs text-slate-400 italic bg-slate-950/40 border-l border-sky-500/80 px-2.5 py-1 rounded-r truncate font-mono">
                    "{finding.evidenceExcerpt}"
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <span>
                      Doc: <strong className="text-slate-400">{finding.sourceDocumentName || 'Source Document'}</strong>
                    </span>
                    {finding.pageNumber && <span>· Page {finding.pageNumber}</span>}
                    {finding.owner && (
                      <span>
                        · Owner: <strong className="text-slate-400">{finding.owner}</strong>
                      </span>
                    )}
                    {finding.deadline && (
                      <span>
                        · Due: <strong className="text-slate-400">{finding.deadline}</strong>
                      </span>
                    )}
                  </div>
                  <div className="text-sky-400 group-hover:underline flex items-center gap-1 font-medium">
                    <span>Inspect Evidence & Review</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
