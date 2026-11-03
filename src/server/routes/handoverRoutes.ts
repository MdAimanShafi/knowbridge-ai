import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { HandoverReport, Finding } from '../../types/index.ts';

export const handoverRoutes = Router();

function canAccessHandover(projectId: string, userId: string) {
  const member = db.getProjectMembers(projectId).find((projectMember) => projectMember.userId === userId);
  return member && ['OWNER', 'LEAD', 'REVIEWER'].includes(member.role);
}

// Generate structured Handover Report from stored findings
handoverRoutes.post('/projects/:projectId/handover', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const { title } = req.body;

  const project = db.getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (!canAccessHandover(projectId, user.id)) {
    return res.status(403).json({ error: 'Project reviewer access is required to generate a handover report.' });
  }
  if (typeof title === 'string' && title.trim().length > 200) {
    return res.status(400).json({ error: 'Report title must be 200 characters or fewer.' });
  }

  const allFindings = db.getFindings(projectId);
  const documents = db.getDocuments(projectId);

  const approvedFindings = allFindings.filter((f) => f.reviewStatus === 'APPROVED');
  const unapprovedFindings = allFindings.filter(
    (f) => f.reviewStatus === 'PENDING' || f.reviewStatus === 'NEEDS_CLARIFICATION'
  );

  const completedWork = approvedFindings.filter((f) => f.category === 'COMPLETED_WORK');
  const pendingTasks = approvedFindings.filter((f) => f.category === 'PENDING_TASK');
  const decisions = approvedFindings.filter((f) => f.category === 'DECISION');
  const dependencies = approvedFindings.filter((f) => f.category === 'DEPENDENCY');
  const risksAndBlockers = approvedFindings.filter((f) => f.category === 'RISK' || f.category === 'BLOCKER');
  const unresolvedQuestions = approvedFindings.filter((f) => f.category === 'UNRESOLVED_QUESTION');
  const missingAndConflictingInfo = approvedFindings.filter(
    (f) =>
      f.evidenceStatus === 'CONFLICTING' ||
      f.evidenceStatus === 'MISSING_EVIDENCE' ||
      f.evidenceStatus === 'UNCERTAIN'
  );

  const recommendedNextActions = [...pendingTasks, ...risksAndBlockers].slice(0, 5).map((finding, index) => ({
    priority: index + 1,
    title: finding.title,
    description: finding.description,
    suggestedOwner: finding.owner || project.successorName || 'Successor Engineer',
    deadline: finding.deadline,
  }));

  const sourceReferences = documents.map((doc) => {
    const findingsFromDoc = approvedFindings.filter((f) => f.sourceDocumentId === doc.id);
    const pages = Array.from(new Set(findingsFromDoc.map((f) => f.pageNumber).filter(Boolean))).sort(
      (a, b) => (a as number) - (b as number)
    );
    return {
      documentId: doc.id,
      filename: doc.filename,
      pagesCovered: pages.length > 0 ? `Pages ${pages.join(', ')}` : 'All Pages',
      findingsCount: findingsFromDoc.length,
    };
  });

  const report: HandoverReport = {
    id: `rpt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    projectId,
    title: title || `${project.name} — Official Knowledge Handover Report`,
    version: '1.0.0',
    generatedById: user.id,
    generatedByName: user.name,
    generatedAt: new Date().toISOString(),
    projectOverview:
      project.description ||
      'Complete operational knowledge synthesis compiled from verified technical documentation, decisions records, and peer reviews.',
    currentStatus: `Project Status: ${project.status}. Total documents analyzed: ${documents.length}. Human-approved findings: ${approvedFindings.length}. Findings awaiting review: ${unapprovedFindings.length}. Outgoing lead: ${project.departingMemberName || 'Not specified'}. Incoming successor: ${project.successorName || 'Not specified'}.`,
    completedWork,
    pendingTasks,
    decisions,
    dependencies,
    risksAndBlockers,
    unresolvedQuestions,
    missingAndConflictingInfo,
    unapprovedFindings,
    recommendedNextActions,
    sourceReferences,
  };

  db.saveHandoverReport(report);

  db.logActivity({
    projectId,
    userId: user.id,
    userName: user.name,
    action: 'Handover Report Generated',
    category: 'HANDOVER',
    details: `Generated official handover dossier "${report.title}" with ${approvedFindings.length} verified findings.`,
  });

  res.status(201).json({ report });
});

// List handover reports for project
handoverRoutes.get('/projects/:projectId/handover', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!db.getProjectById(req.params.projectId)) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  if (!canAccessHandover(req.params.projectId, user.id)) {
    return res.status(403).json({ error: 'Project reviewer access is required to view handover reports.' });
  }
  const reports = db.getHandoverReports(req.params.projectId);
  res.json({ reports });
});

// Get single handover report
handoverRoutes.get('/handover/:id', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const report = db.getHandoverReportById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Handover report not found.' });
  }
  if (!canAccessHandover(report.projectId, user.id)) {
    return res.status(403).json({ error: 'Project reviewer access is required to view this handover report.' });
  }
  res.json({ report });
});

// Executive sign-off on report
handoverRoutes.post('/handover/:id/signoff', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const report = db.getHandoverReportById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Handover report not found.' });
  }
  if (!canAccessHandover(report.projectId, user.id)) {
    return res.status(403).json({ error: 'Project reviewer access is required to sign off this handover.' });
  }
  if (typeof req.body.notes === 'string' && req.body.notes.length > 5000) {
    return res.status(400).json({ error: 'Sign-off notes must be 5,000 characters or fewer.' });
  }
  const pendingReviews = db
    .getFindings(report.projectId)
    .filter((finding) => finding.reviewStatus === 'PENDING' || finding.reviewStatus === 'NEEDS_CLARIFICATION');
  if (pendingReviews.length > 0) {
    return res.status(409).json({
      error: `Resolve all ${pendingReviews.length} pending or clarification-requested finding(s) before signing off.`,
    });
  }

  const { notes } = req.body;
  report.executiveSignOff = {
    approvedBy: user.name,
    approvalDate: new Date().toISOString(),
    notes: notes || 'Handover transition accepted and verified against source evidence.',
  };
  db.save();

  db.logActivity({
    projectId: report.projectId,
    userId: user.id,
    userName: user.name,
    action: 'Executive Handover Sign-Off',
    category: 'HANDOVER',
    details: `${user.name} signed off on handover report "${report.title}".`,
  });

  res.json({ report });
});

// Printable / Clean PDF View (supports both singular and plural paths)
const handlePdfExport = (req: Request, res: Response) => {
  const user = (req as any).user;
  const report = db.getHandoverReportById(req.params.id);
  if (!report) {
    return res.status(404).send('<h1>Report not found</h1>');
  }
  if (!canAccessHandover(report.projectId, user.id)) {
    return res.status(403).send('<h1>Project reviewer access is required to view this report.</h1>');
  }

  const html = generatePrintableReportHtml(report);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.query.download === '1' || req.query.download === 'true') {
    res.setHeader('Content-Disposition', `attachment; filename="KNOWBRIDGE_Handover_${report.id}.html"`);
  }
  res.send(html);
};

handoverRoutes.get('/handover/:id/pdf', authMiddleware, handlePdfExport);
handoverRoutes.get('/handovers/:id/pdf', authMiddleware, handlePdfExport);

function generatePrintableReportHtml(r: HandoverReport): string {
  const escapeHtml = (value: string | number) =>
    String(value).replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character];
    });

  const renderFindingList = (list: Finding[], label: string) => `
    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 16px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">
        ${escapeHtml(label)} (${list.length})
      </h3>
      ${
        list.length === 0
          ? '<p style="color: #64748b; font-style: italic;">No items recorded in this section.</p>'
          : list
              .map(
                (f) => `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
            <strong style="color: #1e293b; font-size: 14px;">${escapeHtml(f.title)}</strong>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${
              f.reviewStatus === 'APPROVED' ? '#dcfce7; color: #166534;' : '#fef3c7; color: #92400e;'
            }">
              ${escapeHtml(f.reviewStatus)} · ${escapeHtml(f.evidenceStatus)}
            </span>
          </div>
          <p style="margin: 4px 0 8px 0; color: #334155; font-size: 13px; line-height: 1.5;">${escapeHtml(f.description)}</p>
          ${
            f.evidenceExcerpt
              ? `<blockquote style="margin: 6px 0; padding: 6px 12px; background: #ffffff; border-left: 3px solid #3b82f6; color: #475569; font-size: 12px; font-style: italic;">
                  "${escapeHtml(f.evidenceExcerpt)}"
                  <div style="font-style: normal; font-size: 11px; color: #64748b; margin-top: 4px;">
                    Source: ${escapeHtml(f.sourceDocumentName || 'Document')} ${f.pageNumber ? `(Page ${f.pageNumber})` : ''}
                  </div>
                </blockquote>`
              : ''
          }
          <div style="display: flex; gap: 16px; font-size: 11px; color: #64748b; margin-top: 6px;">
            ${f.owner ? `<span><strong>Owner:</strong> ${escapeHtml(f.owner)}</span>` : ''}
            ${f.deadline ? `<span><strong>Deadline:</strong> ${escapeHtml(f.deadline)}</span>` : ''}
            ${f.severity ? `<span><strong>Severity:</strong> ${escapeHtml(f.severity)}</span>` : ''}
            ${f.reviewerName ? `<span><strong>Reviewer:</strong> ${escapeHtml(f.reviewerName)}</span>` : ''}
          </div>
        </div>
      `
              )
              .join('')
      }
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(r.title)} — KNOWBRIDGE AI Handover Dossier</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; padding: 20px; max-width: 900px; margin: 0 auto; background: #fff; }
        .header { border-bottom: 3px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
        .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #0284c7; }
        .subtitle { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 12px; margin-bottom: 24px; }
        .next-actions { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin-bottom: 24px; }
        .action-item { margin-bottom: 8px; font-size: 13px; color: #1e3a8a; }
        @media print {
          .no-print { display: none; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 16px; text-align: right;">
        <button onclick="window.print()" style="padding: 8px 16px; background: #0284c7; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
          Print / Save as PDF
        </button>
      </div>

      <div class="header">
        <div>
          <div class="brand">KNOWBRIDGE AI</div>
          <div class="subtitle">Intelligent Project Knowledge Handover Platform</div>
          <h1 style="margin: 8px 0 0 0; font-size: 22px; color: #0f172a;">${escapeHtml(r.title)}</h1>
        </div>
        <div style="text-align: right; font-size: 12px; color: #64748b;">
          <div><strong>Dossier ID:</strong> ${escapeHtml(r.id)}</div>
          <div><strong>Date:</strong> ${escapeHtml(new Date(r.generatedAt).toLocaleDateString())}</div>
          <div><strong>Compiled by:</strong> ${escapeHtml(r.generatedByName)}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div><strong>Project ID:</strong> ${escapeHtml(r.projectId)}</div>
        <div><strong>Version:</strong> ${escapeHtml(r.version)}</div>
        <div><strong>Security Scope:</strong> Company Confidential</div>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; color: #0f172a; margin-bottom: 8px;">1. Executive Summary & Continuity Status</h3>
        <p style="font-size: 13px; color: #334155;">${escapeHtml(r.projectOverview)}</p>
        <p style="font-size: 13px; color: #334155;">${escapeHtml(r.currentStatus)}</p>
      </div>

      <div class="next-actions">
        <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1e40af;">
          Recommended Successor Immediate Action Checklist (Day 1 - Day 30)
        </h3>
        ${r.recommendedNextActions
          .map(
            (act) => `
          <div class="action-item">
            <strong>#${act.priority}. ${escapeHtml(act.title)}</strong>
            <p style="margin: 2px 0; color: #1e293b;">${escapeHtml(act.description)}</p>
            <div style="font-size: 11px; color: #3b82f6;">Owner: ${escapeHtml(act.suggestedOwner)} ${act.deadline ? `· Deadline: ${escapeHtml(act.deadline)}` : ''}</div>
          </div>
        `
          )
          .join('')}
      </div>

      ${renderFindingList(r.decisions, '2. Architectural & Technical Decisions')}
      ${renderFindingList(r.pendingTasks, '3. Outstanding Incomplete Tasks')}
      ${renderFindingList(r.completedWork, '4. Completed Deliverables & Milestones')}
      ${renderFindingList(r.dependencies, '5. Cross-Team Technical Dependencies')}
      ${renderFindingList(r.risksAndBlockers, '6. Active Risks & Technical Blockers')}
      ${renderFindingList(r.unresolvedQuestions, '7. Unresolved Questions & Missing Evidence (Flagged)')}
      ${renderFindingList(r.unapprovedFindings || [], '8. Findings Awaiting Human Review')}

      <div style="margin-top: 32px; padding-top: 16px; border-top: 2px solid #e2e8f0;">
        <h3 style="font-size: 15px; color: #0f172a; margin-bottom: 8px;">Verified Source Documentation Evidence</h3>
        <ul style="font-size: 12px; color: #475569; padding-left: 20px;">
          ${r.sourceReferences
            .map(
              (s) => `
            <li><strong>${escapeHtml(s.filename)}</strong> — ${escapeHtml(s.pagesCovered)} (${s.findingsCount} findings substantiated)</li>
          `
            )
            .join('')}
        </ul>
      </div>

      ${
        r.executiveSignOff
          ? `
        <div style="margin-top: 24px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 12px;">
          <strong>Executive Handover Sign-Off Confirmed</strong>
          <div>Signed by: ${escapeHtml(r.executiveSignOff.approvedBy)} on ${escapeHtml(new Date(
              r.executiveSignOff.approvalDate
            ).toLocaleDateString())}</div>
          <div style="margin-top: 4px; font-style: italic;">"${escapeHtml(r.executiveSignOff.notes)}"</div>
        </div>
      `
          : ''
      }
    </body>
    </html>
  `;
}
