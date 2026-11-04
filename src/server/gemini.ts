import 'dotenv/config';
import { randomUUID } from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { Finding, FindingCategory, EvidenceStatus } from '../types/index.ts';

// Server-side initialization per @google/genai specification
const apiKey = process.env.GEMINI_API_KEY || '';
export const isGeminiConfigured = () => Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.length > 5);

const ai = isGeminiConfigured()
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

export interface DocumentToAnalyze {
  id: string;
  filename: string;
  pages: { pageNumber: number; text: string }[];
}

export interface ExtractedFindingPayload {
  title: string;
  description: string;
  category: FindingCategory;
  evidenceStatus: EvidenceStatus;
  pageNumber: number;
  evidenceExcerpt: string;
  rationale?: string;
  owner?: string;
  deadline?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact?: string;
  conflictingDetails?: string;
  uncertaintyReason?: string;
}

export interface DocumentAnalysisResult {
  findings: Finding[];
  provider: 'GEMINI' | 'GROUNDED_FALLBACK';
  warning?: string;
}

export async function analyzeDocumentsWithGemini(
  projectId: string,
  doc: DocumentToAnalyze,
  allProjectDocs: DocumentToAnalyze[] = []
): Promise<DocumentAnalysisResult> {
  if (!doc.pages.some((page) => page.text.trim())) {
    throw new Error('No readable text was extracted from this document.');
  }

  const documentContext = doc.pages
    .map((p) => `--- PAGE ${p.pageNumber} ---\n${p.text}`)
    .join('\n\n');

  const otherDocsSummary = allProjectDocs
    .filter((d) => d.id !== doc.id)
    .map((d) => `Other Project Document: ${d.filename} (${d.pages.length} pages)`)
    .join('\n');

  const systemInstruction = `You are KNOWBRIDGE AI, an expert enterprise project continuity and knowledge preservation engineer.
Your mission is to prevent critical project knowledge from leaving when key team members depart.
Analyze the provided project document text (with exact page boundaries) and extract high-value structured findings.

CRITICAL RULES:
1. Every claim MUST be grounded in the text. DO NOT FABRICATE or extrapolate.
2. For every finding, provide:
   - title: Concise, professional summary
   - description: Detailed context, what happened, or why
   - category: One of ['DECISION', 'COMPLETED_WORK', 'PENDING_TASK', 'DEPENDENCY', 'BLOCKER', 'RISK', 'ARCHITECTURE', 'UNRESOLVED_QUESTION']
   - evidenceStatus: One of:
       * 'VERIFIED': Document explicitly proves and confirms this finding.
       * 'UNCERTAIN': The text mentions it ambiguously, vaguely, or lacks complete details.
       * 'CONFLICTING': Document contains conflicting dates, instructions, or clashes with another direction.
       * 'MISSING_EVIDENCE': A question is raised or claim made, but crucial operational details (credentials, runbook, owner) are missing.
   - pageNumber: The exact integer page number where the excerpt was found.
   - evidenceExcerpt: The exact, verbatim sentence or paragraph quote from that page supporting the finding.
   - rationale: Why this decision was made (for DECISION)
   - owner: Explicit person/team assigned, if mentioned.
   - deadline: Target completion date, if stated.
   - severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' (for RISKS/BLOCKERS)
   - uncertaintyReason: If UNCERTAIN or MISSING_EVIDENCE, why it requires human verification.
   - conflictingDetails: If CONFLICTING, what contradicts what.
3. Extract at least 4 to 8 high-impact findings covering decisions, tasks, blockers, risks, and questions.`;

  // Check if API key is provided and valid
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Project Document to Analyze: "${doc.filename}"\n\n${otherDocsSummary ? `Project Context:\n${otherDocsSummary}\n\n` : ''}Document Pages Content:\n${documentContext}\n\nExtract all structured handover findings in valid JSON adhering to the schema.`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                category: {
                  type: Type.STRING,
                  enum: [
                    'DECISION',
                    'COMPLETED_WORK',
                    'PENDING_TASK',
                    'DEPENDENCY',
                    'BLOCKER',
                    'RISK',
                    'ARCHITECTURE',
                    'UNRESOLVED_QUESTION',
                  ],
                },
                evidenceStatus: {
                  type: Type.STRING,
                  enum: ['VERIFIED', 'UNCERTAIN', 'CONFLICTING', 'MISSING_EVIDENCE'],
                },
                pageNumber: { type: Type.INTEGER },
                evidenceExcerpt: { type: Type.STRING },
                rationale: { type: Type.STRING },
                owner: { type: Type.STRING },
                deadline: { type: Type.STRING },
                severity: {
                  type: Type.STRING,
                  enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
                },
                impact: { type: Type.STRING },
                uncertaintyReason: { type: Type.STRING },
                conflictingDetails: { type: Type.STRING },
              },
              required: ['title', 'description', 'category', 'evidenceStatus', 'pageNumber', 'evidenceExcerpt'],
            },
          },
        },
      });

      const text = response.text;
      if (text) {
        const parsed: ExtractedFindingPayload[] = JSON.parse(text);
        const analyzedAt = new Date().toISOString();
        return {
          provider: 'GEMINI',
          findings: parsed
            .filter((item) => item.title?.trim() && item.description?.trim())
            .map((item) => {
              const citedPage = doc.pages.find((page) => page.pageNumber === item.pageNumber);
              const excerpt = item.evidenceExcerpt?.trim() || '';
              const excerptMatches = Boolean(
                citedPage &&
                  excerpt &&
                  citedPage.text.replace(/\s+/g, ' ').includes(excerpt.replace(/\s+/g, ' '))
              );
              return {
                id: `fnd-ai-${randomUUID()}`,
                projectId,
                title: item.title,
                description: item.description,
                category: item.category,
                evidenceStatus: excerptMatches ? item.evidenceStatus : 'UNCERTAIN',
                reviewStatus: 'PENDING',
                sourceDocumentId: doc.id,
                sourceDocumentName: doc.filename,
                pageNumber: citedPage?.pageNumber || doc.pages[0].pageNumber,
                evidenceExcerpt: excerptMatches ? excerpt : '',
                rationale: item.rationale,
                owner: item.owner,
                deadline: item.deadline,
                severity: item.severity,
                impact: item.impact,
                uncertaintyReason: excerptMatches
                  ? item.uncertaintyReason
                  : 'The AI could not match its citation exactly to the extracted source page. Verify this finding against the document.',
                conflictingDetails: item.conflictingDetails,
                isAiGenerated: true,
                createdAt: analyzedAt,
                updatedAt: analyzedAt,
              };
            }),
        };
      }
    } catch (err) {
      console.error('Gemini API extraction failed; using grounded fallback extraction:', err);
      return {
        findings: fallbackGroundedExtraction(projectId, doc),
        provider: 'GROUNDED_FALLBACK',
        warning: 'Gemini analysis failed. Findings were extracted with grounded rules and need human review.',
      };
    }
  }

  const providerWarning = apiKey
    ? 'Gemini returned no structured results. Findings were extracted with grounded rules and need human review.'
    : 'GEMINI_API_KEY is not configured. Findings were extracted with grounded rules and need human review.';
  return {
    findings: fallbackGroundedExtraction(projectId, doc),
    provider: 'GROUNDED_FALLBACK',
    warning: providerWarning,
  };
}

function fallbackGroundedExtraction(projectId: string, doc: DocumentToAnalyze): Finding[] {
  const findings: Finding[] = [];

  // Search each page for high-signal phrases
  doc.pages.forEach((page) => {
    const text = page.text;
    const lines = text.split('\n').filter((l) => l.trim().length > 0);

    lines.forEach((line) => {
      const lower = line.toLowerCase();

      if (lower.includes('decision:') || lower.includes('decided to') || lower.includes('chosen')) {
        findings.push({
          id: `fnd-ai-${randomUUID()}`,
          projectId,
          title: line.replace(/decision:/i, '').trim().slice(0, 80) || 'Architectural Technical Decision',
          description: line,
          category: 'DECISION',
          evidenceStatus: 'VERIFIED',
          reviewStatus: 'PENDING',
          sourceDocumentId: doc.id,
          sourceDocumentName: doc.filename,
          pageNumber: page.pageNumber,
          evidenceExcerpt: line,
          rationale: 'Derived from explicit decision log in document.',
          isAiGenerated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (lower.includes('risk:') || lower.includes('vulnerability') || lower.includes('audit')) {
        findings.push({
          id: `fnd-ai-${randomUUID()}`,
          projectId,
          title: line.replace(/risk:/i, '').trim().slice(0, 80) || 'Operational Project Risk',
          description: line,
          category: 'RISK',
          evidenceStatus: lower.includes('uncertain') ? 'UNCERTAIN' : 'VERIFIED',
          reviewStatus: 'PENDING',
          sourceDocumentId: doc.id,
          sourceDocumentName: doc.filename,
          pageNumber: page.pageNumber,
          evidenceExcerpt: line,
          severity: lower.includes('critical') ? 'CRITICAL' : 'HIGH',
          isAiGenerated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (lower.includes('blocker:') || lower.includes('blocking')) {
        findings.push({
          id: `fnd-ai-${randomUUID()}`,
          projectId,
          title: line.replace(/blocker:/i, '').trim().slice(0, 80) || 'Active Workflow Blocker',
          description: line,
          category: 'BLOCKER',
          evidenceStatus: 'VERIFIED',
          reviewStatus: 'PENDING',
          sourceDocumentId: doc.id,
          sourceDocumentName: doc.filename,
          pageNumber: page.pageNumber,
          evidenceExcerpt: line,
          severity: 'HIGH',
          isAiGenerated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (lower.includes('question') || lower.includes('who holds') || lower.includes('unresolved')) {
        findings.push({
          id: `fnd-ai-${randomUUID()}`,
          projectId,
          title: line.replace(/question \d*:/i, '').trim().slice(0, 80) || 'Unresolved Handover Question',
          description: line,
          category: 'UNRESOLVED_QUESTION',
          evidenceStatus: 'MISSING_EVIDENCE',
          reviewStatus: 'PENDING',
          sourceDocumentId: doc.id,
          sourceDocumentName: doc.filename,
          pageNumber: page.pageNumber,
          evidenceExcerpt: line,
          uncertaintyReason: 'Explicit question identified in text with missing operational resolution.',
          severity: 'HIGH',
          isAiGenerated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (lower.includes('task') || lower.includes('pending') || lower.includes('todo')) {
        findings.push({
          id: `fnd-ai-${randomUUID()}`,
          projectId,
          title: line.slice(0, 80),
          description: line,
          category: 'PENDING_TASK',
          evidenceStatus: 'VERIFIED',
          reviewStatus: 'PENDING',
          sourceDocumentId: doc.id,
          sourceDocumentName: doc.filename,
          pageNumber: page.pageNumber,
          evidenceExcerpt: line,
          isAiGenerated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });
  });

  // If no specific markers were matched, generate structured overview findings from first page
  if (findings.length === 0 && doc.pages.length > 0) {
    const p1 = doc.pages[0];
    findings.push({
      id: `fnd-ai-${randomUUID()}`,
      projectId,
      title: `Project Overview from ${doc.filename}`,
      description: p1.text.slice(0, 280),
      category: 'ARCHITECTURE',
      evidenceStatus: 'VERIFIED',
      reviewStatus: 'PENDING',
      sourceDocumentId: doc.id,
      sourceDocumentName: doc.filename,
      pageNumber: p1.pageNumber,
      evidenceExcerpt: p1.text.slice(0, 180),
      isAiGenerated: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return findings;
}
