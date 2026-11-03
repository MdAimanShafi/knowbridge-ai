import React from 'react';
import { CheckCircle2, HelpCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import { EvidenceStatus } from '../../types/index.ts';

interface Props {
  status: EvidenceStatus;
  showIcon?: boolean;
}

export const EvidenceStatusBadge: React.FC<Props> = ({ status, showIcon = true }) => {
  switch (status) {
    case 'VERIFIED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
          {showIcon && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
          <span>Verified Evidence</span>
        </span>
      );
    case 'UNCERTAIN':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
          {showIcon && <HelpCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>Uncertain Support</span>
        </span>
      );
    case 'CONFLICTING':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-400">
          {showIcon && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
          <span>Conflicting Sources</span>
        </span>
      );
    case 'MISSING_EVIDENCE':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400">
          {showIcon && <AlertOctagon className="w-3.5 h-3.5 shrink-0" />}
          <span>Missing Evidence</span>
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">{status}</span>;
  }
};
