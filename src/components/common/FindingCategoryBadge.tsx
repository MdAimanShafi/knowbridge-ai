import React from 'react';
import {
  GitCommit,
  CheckSquare,
  Clock,
  Link2,
  Ban,
  ShieldAlert,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { FindingCategory } from '../../types/index.ts';

interface Props {
  category: FindingCategory;
  showIcon?: boolean;
}

export const FindingCategoryBadge: React.FC<Props> = ({ category, showIcon = true }) => {
  switch (category) {
    case 'DECISION':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400">
          {showIcon && <GitCommit className="w-3.5 h-3.5 shrink-0" />}
          <span>Decision</span>
        </span>
      );
    case 'COMPLETED_WORK':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
          {showIcon && <CheckSquare className="w-3.5 h-3.5 shrink-0" />}
          <span>Completed</span>
        </span>
      );
    case 'PENDING_TASK':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400">
          {showIcon && <Clock className="w-3.5 h-3.5 shrink-0" />}
          <span>Pending Task</span>
        </span>
      );
    case 'DEPENDENCY':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400">
          {showIcon && <Link2 className="w-3.5 h-3.5 shrink-0" />}
          <span>Dependency</span>
        </span>
      );
    case 'BLOCKER':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400">
          {showIcon && <Ban className="w-3.5 h-3.5 shrink-0" />}
          <span>Blocker</span>
        </span>
      );
    case 'RISK':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
          {showIcon && <ShieldAlert className="w-3.5 h-3.5 shrink-0" />}
          <span>Risk</span>
        </span>
      );
    case 'ARCHITECTURE':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-400">
          {showIcon && <Layers className="w-3.5 h-3.5 shrink-0" />}
          <span>Architecture</span>
        </span>
      );
    case 'UNRESOLVED_QUESTION':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-400">
          {showIcon && <HelpCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>Question</span>
        </span>
      );
    default:
      return <span className="text-xs text-slate-400">{category}</span>;
  }
};
