import React, { useState } from 'react';
import { Modal } from './Modal.tsx';
import { Finding, ReviewStatus } from '../../types/index.ts';
import { EvidenceStatusBadge } from './EvidenceStatusBadge.tsx';
import { FindingCategoryBadge } from './FindingCategoryBadge.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useProject } from '../../context/ProjectContext.tsx';
import { syncFindingToFirestore } from '../../firebase/firestoreService.ts';
import {
  FileText,
  Bookmark,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  UserCheck,
  Calendar,
  AlertOctagon,
  Quote,
} from 'lucide-react';

interface Props {
  finding: Finding | null;
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted?: (updated: Finding) => void;
}

export const EvidenceInspectorModal: React.FC<Props> = ({
  finding,
  isOpen,
  onClose,
  onReviewSubmitted,
}) => {
  const { token, user } = useAuth();
  const { documents, refreshProjectData } = useProject();
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!finding) return null;

  // Find linked document for rich page context
  const sourceDoc = documents.find((d) => d.id === finding.sourceDocumentId);
  const pageContent = sourceDoc?.pages?.find((p) => p.pageNumber === finding.pageNumber);

  const handleReview = async (status: ReviewStatus) => {
    setIsSubmitting(true);
    setSuccessMsg('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/findings/${finding.id}/review`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reviewStatus: status,
          reviewerNotes: reviewerNotes || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Finding updated to ${status}.`);
        if (data.finding) {
          syncFindingToFirestore(data.finding.projectId, data.finding).catch(() => {});
        }
        if (onReviewSubmitted) onReviewSubmitted(data.finding);
        await refreshProjectData();
        setTimeout(() => {
          setSuccessMsg('');
          onClose();
        }, 800);
      }
    } catch (err) {
      console.error('Review submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Evidence & Verification Inspector"
      subtitle={`Finding ID: ${finding.id} · Audit Trail & Grounding`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
          <div className="flex items-center gap-3">
            <FindingCategoryBadge category={finding.category} />
            <span className="text-slate-600">·</span>
            <EvidenceStatusBadge status={finding.evidenceStatus} />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Review Status:</span>
            <span
              className={`font-semibold ${
                finding.reviewStatus === 'APPROVED'
                  ? 'text-emerald-400'
                  : finding.reviewStatus === 'REJECTED'
                  ? 'text-red-400'
                  : finding.reviewStatus === 'NEEDS_CLARIFICATION'
                  ? 'text-amber-400'
                  : 'text-slate-300'
              }`}
            >
              {finding.reviewStatus}
            </span>
          </div>
        </div>

        {/* Title and description */}
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{finding.title}</h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">{finding.description}</p>
        </div>

        {/* Decision Rationale or Impact if available */}
        {finding.rationale && (
          <div className="p-3.5 bg-blue-950/20 border border-blue-900/40 rounded-lg">
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              Documented Rationale
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{finding.rationale}</p>
          </div>
        )}

        {/* Conflicting Information Section if status is CONFLICTING */}
        {finding.evidenceStatus === 'CONFLICTING' && (
          <div className="p-4 bg-violet-950/30 border border-violet-800/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-violet-300 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-violet-400" />
              <span>Contradiction Detected Across Sources</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {finding.conflictingDetails ||
                'Two or more sources provide conflicting technical specifications or priorities that require human leadership resolution.'}
            </p>
          </div>
        )}

        {/* Missing or Uncertain details */}
        {(finding.evidenceStatus === 'MISSING_EVIDENCE' || finding.evidenceStatus === 'UNCERTAIN') && (
          <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
              <AlertOctagon className="w-4 h-4 text-amber-400" />
              <span>Human Verification Required</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {finding.uncertaintyReason ||
                'The source document raises this item without complete operational runbooks, credentials, or confirmation.'}
            </p>
          </div>
        )}

        {/* Grounded Evidence Box with Quote */}
        <div className="border border-slate-800 rounded-lg bg-slate-950 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              <span className="font-medium text-slate-200">
                {finding.sourceDocumentName || 'Source Specification Document'}
              </span>
              {finding.pageNumber && (
                <span className="text-slate-400">· Page {finding.pageNumber}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Quote className="w-3.5 h-3.5" />
              <span>Exact Citation</span>
            </div>
          </div>

          <div className="p-4">
            {finding.evidenceExcerpt ? (
              <blockquote className="p-3 bg-slate-900/80 border-l-2 border-sky-500 rounded-r text-xs text-slate-200 italic leading-relaxed font-mono">
                "{finding.evidenceExcerpt}"
              </blockquote>
            ) : (
              <p className="text-xs text-slate-500 italic">No direct textual excerpt found in document.</p>
            )}

            {/* Surrounding Page Context */}
            {pageContent && (
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Full Page {pageContent.pageNumber} Raw Source Text:
                </div>
                <div className="p-3 bg-slate-900/40 rounded text-[11px] text-slate-400 max-h-36 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {pageContent.text}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 bg-slate-950/40 border border-slate-800/60 rounded">
            <span className="text-slate-500 block mb-0.5">Assigned Owner</span>
            <span className="font-medium text-slate-200">{finding.owner || 'Unassigned'}</span>
          </div>
          <div className="p-2.5 bg-slate-950/40 border border-slate-800/60 rounded">
            <span className="text-slate-500 block mb-0.5">Target Deadline</span>
            <span className="font-medium text-slate-200">{finding.deadline || 'Flexible'}</span>
          </div>
          <div className="p-2.5 bg-slate-950/40 border border-slate-800/60 rounded">
            <span className="text-slate-500 block mb-0.5">Severity</span>
            <span className="font-medium text-slate-200">{finding.severity || 'Normal'}</span>
          </div>
          <div className="p-2.5 bg-slate-950/40 border border-slate-800/60 rounded">
            <span className="text-slate-500 block mb-0.5">Origin</span>
            <span className="font-medium text-slate-200">{finding.isAiGenerated ? 'Gemini 3.8 Flash' : 'Human Peer Log'}</span>
          </div>
        </div>

        {/* Existing Review Audit History */}
        {finding.reviewerName && (
          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <UserCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>Reviewed by {finding.reviewerName}</span>
              {finding.reviewedAt && (
                <span className="text-slate-500">
                  on {new Date(finding.reviewedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {finding.reviewerNotes && (
              <p className="text-slate-400 pl-5 italic">"{finding.reviewerNotes}"</p>
            )}
          </div>
        )}

        {/* Human Review Action Bar (STAGE 4: REVIEW) */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">
              Reviewer Assessment & Transition Notes
            </label>
            <span className="text-[11px] text-slate-500">
              Human review determines handover inclusion
            </span>
          </div>

          <textarea
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            placeholder="Add reviewer rationale, clarifications, or handover instructions for the successor..."
            rows={2}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />

          {successMsg && (
            <div className="p-2 bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300 rounded text-center">
              {successMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => handleReview('NEEDS_CLARIFICATION')}
              disabled={isSubmitting}
              className="px-3 py-2 text-xs font-medium text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 rounded-lg transition-colors whitespace-nowrap"
            >
              Request Clarification
            </button>
            <button
              onClick={() => handleReview('REJECTED')}
              disabled={isSubmitting}
              className="px-3 py-2 text-xs font-medium text-red-300 bg-red-950/40 hover:bg-red-900/50 border border-red-800/60 rounded-lg transition-colors whitespace-nowrap"
            >
              Reject Finding
            </button>
            <button
              onClick={() => handleReview('APPROVED')}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Approve for Handover</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
