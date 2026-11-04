import { Finding, Project, ProjectDocument } from '../types/index.ts';

export interface OnboardingPlanItem {
  id: string;
  title: string;
  description: string;
  category: Finding['category'] | 'DOCUMENTATION';
  owner?: string;
  sourceDocumentName?: string;
  reviewStatus?: Finding['reviewStatus'];
  evidenceStatus?: Finding['evidenceStatus'];
}

export interface SuccessorOnboardingPlan {
  successorName: string;
  readinessScore: number;
  readinessGaps: string[];
  phases: { days: '0-30' | '31-60' | '61-90'; objective: string; items: OnboardingPlanItem[] }[];
  ownershipRisks: {
    title: string;
    description: string;
    owner?: string;
    reviewStatus: Finding['reviewStatus'];
  }[];
}

export function buildSuccessorOnboardingPlan(
  project: Project,
  documents: ProjectDocument[],
  findings: Finding[],
): SuccessorOnboardingPlan {
  const successorName = project.successorName?.trim() || 'Successor not assigned';
  const approved = findings.filter((finding) => finding.reviewStatus === 'APPROVED');
  const highImpact = findings.filter(
    (finding) =>
      (finding.category === 'RISK' || finding.category === 'BLOCKER') &&
      (finding.severity === 'CRITICAL' || finding.severity === 'HIGH'),
  );
  const unownedCritical = highImpact.filter((finding) => !finding.owner?.trim());
  const pendingReviewCount = findings.filter(
    (finding) => finding.reviewStatus === 'PENDING' || finding.reviewStatus === 'NEEDS_CLARIFICATION',
  ).length;
  const readinessGaps: string[] = [];

  if (!project.successorName?.trim()) readinessGaps.push('Assign a named successor.');
  if (documents.length === 0) readinessGaps.push('Add source documents for the successor to review.');
  if (approved.length === 0) readinessGaps.push('Have a reviewer approve evidence-backed project findings.');
  if (pendingReviewCount > 0) readinessGaps.push(`${pendingReviewCount} finding(s) still need human review.`);
  if (unownedCritical.length > 0) {
    readinessGaps.push(`${unownedCritical.length} high/critical risk(s) have no named owner.`);
  }

  const readinessScore = Math.max(
    0,
    100 -
      (!project.successorName?.trim() ? 20 : 0) -
      (documents.length === 0 ? 20 : 0) -
      (approved.length === 0 ? 25 : 0) -
      Math.min(20, pendingReviewCount * 4) -
      Math.min(15, unownedCritical.length * 5),
  );

  const itemsFor = (predicate: (finding: Finding) => boolean): OnboardingPlanItem[] =>
    findings.filter(predicate).map((finding) => ({
      id: finding.id,
      title: finding.title,
      description: finding.description,
      category: finding.category,
      owner: finding.owner,
      sourceDocumentName: finding.sourceDocumentName,
      reviewStatus: finding.reviewStatus,
      evidenceStatus: finding.evidenceStatus,
    }));

  const docsAsItems = (selected: ProjectDocument[]): OnboardingPlanItem[] =>
    selected.map((document) => ({
      id: `document-${document.id}`,
      title: `Review ${document.filename}`,
      description: document.summary || `Read the source document and verify its current operational guidance.`,
      category: 'DOCUMENTATION',
      sourceDocumentName: document.filename,
    }));

  const day30 = [
    ...docsAsItems(documents.slice(0, 5)),
    ...itemsFor((finding) => highImpact.includes(finding) || finding.category === 'PENDING_TASK').slice(0, 10),
  ];
  const day60 = itemsFor(
    (finding) =>
      finding.category === 'DECISION' ||
      finding.category === 'ARCHITECTURE' ||
      finding.category === 'DEPENDENCY',
  ).slice(0, 15);
  const day90 = itemsFor(
    (finding) =>
      finding.category === 'UNRESOLVED_QUESTION' ||
      (finding.category === 'RISK' && finding.severity !== 'CRITICAL' && finding.severity !== 'HIGH'),
  ).slice(0, 15);

  return {
    successorName,
    readinessScore,
    readinessGaps,
    phases: [
      { days: '0-30', objective: 'Build operational context and stabilize urgent ownership.', items: day30 },
      { days: '31-60', objective: 'Validate architecture, decisions, and cross-team dependencies.', items: day60 },
      { days: '61-90', objective: 'Close knowledge gaps and establish durable operational coverage.', items: day90 },
    ],
    ownershipRisks: highImpact.map((finding) => ({
      title: finding.title,
      description: finding.owner
        ? `Primary owner: ${finding.owner}. Confirm a secondary owner and handoff.`
        : 'No primary owner is recorded. Assign an owner and a secondary contact.',
      owner: finding.owner,
      reviewStatus: finding.reviewStatus,
    })),
  };
}
