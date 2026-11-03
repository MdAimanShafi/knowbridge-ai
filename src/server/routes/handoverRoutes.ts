import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { HandoverReport, Finding } from '../../types/index.ts';

export const handoverRoutes = Router();

// Generate structured Handover Report from stored findings
handoverRoutes.post('/projects/:projectId/handover', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const { title, customNotes } = req.body;

  const project = db.getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const allFindings = db.getFindings(projectId);
  const documents = db.getDocuments(projectId);

  // Partition findings by category and approval status
  const approvedFindings = allFindings.filter((f) => f.reviewStatus === 'APPROVED');
  const unapprovedFindings = allFindings.filter((f) => f.reviewStatus !== 'APPROVED');

  const completedWork = allFindings.filter((f) => f.category === 'COMPLETED_WORK');
  const pendingTasks = allFindings.filter((f) => f.category === 'PENDING_TASK');
  const decisions = allFindings.filter((f) => f.category === 'DECISION');
  const dependencies = allFindings.filter((f) => f.category === 'DEPENDENCY');
  const risksAndBlockers = allFindings.filter((f) => f.category === 'RISK' || f.category === 'BLOCKER');
  const unresolvedQuestions = allFindings.filter((f) => f.category === 'UNRESOLVED_QUESTION');
  const missingAndConflictingInfo = allFindings.filter(
    (f) => f.evidenceStatus === 'CONFLICTING' || f.evidenceStatus === 'MISSING_EVIDENCE' || f.evidenceStatus === 'UNCERTAIN'
  );

  // Generate actionable recommended next steps for successor
  const recommendedNextActions = [
    {
      priority: 1,
      title: 'Review and resolve conflicting payment gateway directive with VP Finance',
      description:
        'Coordinate with Finance to confirm whether Adyen contract will proceed or if Stripe remains sole tokenization provider before Q4 code freeze.',
      suggestedOwner: project.successorName || 'Successor Engineer',
      deadline: 'Within first 5 business days',
    },
    {
      priority: 2,
      title: 'Implement Webhook idempotency handler for asynchronous payment events',
      description:
        'Close out pending high-priority task DOC-PAY-002: prevent duplicate order fulfillments on gateway timeout retries.',
      suggestedOwner: project.successorName || 'Successor Engineer',
      deadline: '2026-11-08',
    },
    {
      priority: 3,
      title: 'Verify Master PGP Key Custody for Cold Storage Backups',
      description:
        'Establish dual-custody key escrow with SecOps prior to Sarah Lin departure to prevent disaster recovery lockout.',
      suggestedOwner: 'SecOps & Successor',
      deadline: '2026-11-10',
    },
    {
      priority: 4,
      title: 'Pre-Audit PCI-DSS Token Isolation Review',
      description:
        'Confirm that database read replicas and application logs do not persist cardholder data tokens before the external audit on Nov 18.',
      suggestedOwner: project.successorName || 'Successor Engineer',
      deadline: '2026-11-14',
    },
  ];

  // Document source index
  const sourceReferences = documents.map((doc) => {
    const findingsFromDoc = allFindings.filter((f) => f.sourceDocumentId === doc.id);
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
    currentStatus: `Project Status: ${project.status}. Total documents analyzed: ${documents.length}. Total verified findings: ${approvedFindings.length} (${unapprovedFindings.length} pending review). Outgoing lead: ${project.departingMemberName || 'Sarah Lin'}. Incoming successor: ${project.successorName || 'Alex Rivera'}.`,
    completedWork,
    pendingTasks,
    decisions,
    dependencies,
    risksAndBlockers,
    unresolvedQuestions,
    missingAndConflictingInfo,
    recommendedNextActions,
    sourceReferences,
    executiveSignOff: customNotes
      ? {
          approvedBy: user.name,
          approvalDate: new Date().toISOString(),
          notes: customNotes,
        }
      : undefined,
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
  const reports = db.getHandoverReports(req.params.projectId);
  res.json({ reports });
});

// Get single handover report
handoverRoutes.get('/handover/:id', authMiddleware, (req: Request, res: Response) => {
  const report = db.getHandoverReportById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Handover report not found.' });
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
  const report = db.getHandoverReportById(req.params.id);
  if (!report) {
    return res.status(404).send('<h1>Report not found</h1>');
  }

  const html = generatePrintableReportHtml(report);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.query.download === '1' || req.query.download === 'true') {
    res.setHeader('Content-Disposition', `attachment; filename="KNOWBRIDGE_Handover_${report.id}.html"`);
  }
  res.send(html);
};

handoverRoutes.get('/handover/:id/pdf', handlePdfExport);
handoverRoutes.get('/handovers/:id/pdf', handlePdfExport);

function generatePrintableReportHtml(r: HandoverReport): string {
  const renderFindingList = (list: Finding[], label: string) => `
    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 16px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">
        ${label} (${list.length})
      </h3>
      ${
        list.length === 0
          ? '<p style="color: #64748b; font-style: italic;">No items recorded in this section.</p>'
          : list
              .map(
                (f) => `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
            <strong style="color: #1e293b; font-size: 14px;">${f.title}</strong>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${
              f.reviewStatus === 'APPROVED' ? '#dcfce7; color: #166534;' : '#fef3c7; color: #92400e;'
            }">
              ${f.reviewStatus} · ${f.evidenceStatus}
            </span>
          </div>
          <p style="margin: 4px 0 8px 0; color: #334155; font-size: 13px; line-height: 1.5;">${f.description}</p>
          ${
            f.evidenceExcerpt
              ? `<blockquote style="margin: 6px 0; padding: 6px 12px; background: #ffffff; border-left: 3px solid #3b82f6; color: #475569; font-size: 12px; font-style: italic;">
                  "${f.evidenceExcerpt}"
                  <div style="font-style: normal; font-size: 11px; color: #64748b; margin-top: 4px;">
                    Source: ${f.sourceDocumentName || 'Document'} ${f.pageNumber ? `(Page ${f.pageNumber})` : ''}
                  </div>
                </blockquote>`
              : ''
          }
          <div style="display: flex; gap: 16px; font-size: 11px; color: #64748b; margin-top: 6px;">
            ${f.owner ? `<span><strong>Owner:</strong> ${f.owner}</span>` : ''}
            ${f.deadline ? `<span><strong>Deadline:</strong> ${f.deadline}</span>` : ''}
            ${f.severity ? `<span><strong>Severity:</strong> ${f.severity}</span>` : ''}
            ${f.reviewerName ? `<span><strong>Reviewer:</strong> ${f.reviewerName}</span>` : ''}
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
      <title>${r.title} — KNOWBRIDGE AI Handover Dossier</title>
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
          <h1 style="margin: 8px 0 0 0; font-size: 22px; color: #0f172a;">${r.title}</h1>
        </div>
        <div style="text-align: right; font-size: 12px; color: #64748b;">
          <div><strong>Dossier ID:</strong> ${r.id}</div>
          <div><strong>Date:</strong> ${new Date(r.generatedAt).toLocaleDateString()}</div>
          <div><strong>Compiled by:</strong> ${r.generatedByName}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div><strong>Project ID:</strong> ${r.projectId}</div>
        <div><strong>Version:</strong> ${r.version}</div>
        <div><strong>Security Scope:</strong> Company Confidential</div>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 16px; color: #0f172a; margin-bottom: 8px;">1. Executive Summary & Continuity Status</h3>
        <p style="font-size: 13px; color: #334155;">${r.projectOverview}</p>
        <p style="font-size: 13px; color: #334155;">${r.currentStatus}</p>
      </div>

      <div class="next-actions">
        <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1e40af;">
          Recommended Successor Immediate Action Checklist (Day 1 - Day 30)
        </h3>
        ${r.recommendedNextActions
          .map(
            (act) => `
          <div class="action-item">
            <strong>#${act.priority}. ${act.title}</strong>
            <p style="margin: 2px 0; color: #1e293b;">${act.description}</p>
            <div style="font-size: 11px; color: #3b82f6;">Owner: ${act.suggestedOwner} ${act.deadline ? `· Deadline: ${act.deadline}` : ''}</div>
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

      <div style="margin-top: 32px; padding-top: 16px; border-top: 2px solid #e2e8f0;">
        <h3 style="font-size: 15px; color: #0f172a; margin-bottom: 8px;">Verified Source Documentation Evidence</h3>
        <ul style="font-size: 12px; color: #475569; padding-left: 20px;">
          ${r.sourceReferences
            .map(
              (s) => `
            <li><strong>${s.filename}</strong> — ${s.pagesCovered} (${s.findingsCount} findings substantiated)</li>
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
          <div>Signed by: ${r.executiveSignOff.approvedBy} on ${new Date(
              r.executiveSignOff.approvalDate
            ).toLocaleDateString()}</div>
          <div style="margin-top: 4px; font-style: italic;">"${r.executiveSignOff.notes}"</div>
        </div>
      `
          : ''
      }
    </body>
    </html>
  `;
}
