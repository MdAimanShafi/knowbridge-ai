import PDFDocument from 'pdfkit';
import { Finding, HandoverReport } from '../types/index.ts';

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export async function generateHandoverPdf(report: HandoverReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 52, bufferPages: true });
    const chunks: Buffer[] = [];

    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));

    const text = (value: string | number | undefined) => String(value || '-');
    const heading = (value: string) => {
      document.moveDown(0.7);
      document.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text(value);
      document.moveDown(0.25);
    };
    const renderFinding = (finding: Finding) => {
      document.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b').text(finding.title);
      document
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#334155')
        .text(`${finding.reviewStatus} - ${finding.evidenceStatus}`);
      document.moveDown(0.15).text(finding.description);
      if (finding.evidenceExcerpt) {
        document
          .moveDown(0.15)
          .font('Helvetica-Oblique')
          .fillColor('#475569')
          .text(`Evidence: "${finding.evidenceExcerpt}"`);
        document
          .font('Helvetica')
          .fillColor('#64748b')
          .text(`Source: ${finding.sourceDocumentName || 'Document'}${finding.pageNumber ? ` (page ${finding.pageNumber})` : ''}`);
      }
      const metadata = [
        finding.owner ? `Owner: ${finding.owner}` : '',
        finding.deadline ? `Deadline: ${finding.deadline}` : '',
        finding.severity ? `Severity: ${finding.severity}` : '',
        finding.reviewerName ? `Reviewer: ${finding.reviewerName}` : '',
      ].filter(Boolean);
      if (metadata.length) document.moveDown(0.15).fillColor('#64748b').text(metadata.join(' | '));
      document.moveDown(0.55);
    };
    const renderFindings = (title: string, findings: Finding[]) => {
      heading(`${title} (${findings.length})`);
      if (findings.length === 0) {
        document.font('Helvetica-Oblique').fontSize(9).fillColor('#64748b').text('No items recorded.');
        return;
      }
      findings.forEach(renderFinding);
    };

    document.font('Helvetica-Bold').fontSize(10).fillColor('#0284c7').text('KNOWBRIDGE AI');
    document.font('Helvetica').fontSize(8).fillColor('#64748b').text('INTELLIGENT PROJECT KNOWLEDGE HANDOVER DOSSIER');
    document.moveDown(0.5);
    document.font('Helvetica-Bold').fontSize(19).fillColor('#0f172a').text(report.title);
    document.moveDown(0.4);
    document
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#475569')
      .text(`Dossier: ${report.id}  |  Generated: ${formatDate(report.generatedAt)}  |  Compiled by: ${report.generatedByName}`);
    document
      .moveDown(0.25)
      .text(`Project: ${report.projectId}  |  Version: ${report.version}  |  Scope: Company Confidential`);

    heading('Executive Summary and Continuity Status');
    document.font('Helvetica').fontSize(10).fillColor('#334155').text(report.projectOverview);
    document.moveDown(0.25).text(report.currentStatus);

    heading('Recommended Successor Actions');
    if (report.recommendedNextActions.length === 0) {
      document.font('Helvetica-Oblique').fontSize(9).fillColor('#64748b').text('No next actions recorded.');
    } else {
      report.recommendedNextActions.forEach((action) => {
        document
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#1e3a8a')
          .text(`${action.priority}. ${action.title}`);
        document.font('Helvetica').fillColor('#334155').text(action.description);
        document
          .fontSize(8)
          .fillColor('#64748b')
          .text(`Owner: ${action.suggestedOwner}${action.deadline ? ` | Deadline: ${action.deadline}` : ''}`);
        document.moveDown(0.35);
      });
    }

    renderFindings('Architectural and Technical Decisions', report.decisions);
    renderFindings('Outstanding Incomplete Tasks', report.pendingTasks);
    renderFindings('Completed Deliverables and Milestones', report.completedWork);
    renderFindings('Cross-Team Dependencies', report.dependencies);
    renderFindings('Active Risks and Blockers', report.risksAndBlockers);
    renderFindings('Unresolved Questions and Missing Evidence', report.unresolvedQuestions);
    renderFindings('Findings Awaiting Human Review', report.unapprovedFindings || []);

    heading('Verified Source Documentation');
    if (report.sourceReferences.length === 0) {
      document.font('Helvetica-Oblique').fontSize(9).fillColor('#64748b').text('No source references recorded.');
    } else {
      report.sourceReferences.forEach((source) => {
        document
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#334155')
          .text(`${source.filename} - ${source.pagesCovered} (${source.findingsCount} findings)`);
      });
    }

    if (report.executiveSignOff) {
      heading('Executive Handover Sign-Off');
      document
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#334155')
        .text(`Signed by: ${report.executiveSignOff.approvedBy} on ${formatDate(report.executiveSignOff.approvalDate)}`);
      document.moveDown(0.2).text(report.executiveSignOff.notes);
    }

    const range = document.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      document.switchToPage(page);
      document
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748b')
        .text(`KNOWBRIDGE AI - Confidential  |  Page ${page + 1} of ${range.count}`, 52, 790, {
          width: 491,
          align: 'center',
          lineBreak: false,
        });
    }

    document.end();
  });
}
