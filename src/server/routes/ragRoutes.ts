import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { answerProjectQuestion } from '../ragEngine.ts';
import { RagQueryRequest } from '../../types/index.ts';
import { projectIdParam, requireProjectAccess } from '../accessControl.ts';

export const ragRoutes = Router();
const projectAccess = requireProjectAccess(projectIdParam());

// Ask a natural language question about the project with strict grounding
ragRoutes.post('/projects/:projectId/rag/query', authMiddleware, projectAccess, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const { question, filter } = (req.body || {}) as RagQueryRequest;

  if (typeof question !== 'string' || question.trim().length === 0 || question.length > 2000) {
    return res.status(400).json({ error: 'Question must be between 1 and 2,000 characters.' });
  }
  const project = await db.getProjectById(projectId);
  if (!project) return res.status(404).json({ error: 'Project workspace not found.' });

  try {
    const sourceRecords = await db.getSourceRecords(projectId);
    const documents = await db.getDocuments(projectId);
    const findings = await db.getFindings(projectId);

    const answer = await answerProjectQuestion(
      project,
      { question, filter },
      sourceRecords,
      documents,
      findings
    );

    // Save to query log
    await db.saveRagQuery(projectId, question, answer, user?.id);

    // Log query in audit log
    await db.logActivity({
      projectId,
      userId: user?.id || 'anonymous',
      userName: user?.name || 'Evaluator',
      action: 'Project Intelligence Query',
      category: 'RAG_QUERY',
      details: `Asked: "${question.slice(0, 70)}..." -> Status: ${answer.verificationStatus} (${answer.supportingSources.length} citations).`,
    });

    res.json({ answer });
  } catch (err) {
    console.error('RAG query execution error:', err instanceof Error ? err.message : 'Unknown RAG error');
    res.status(500).json({ error: 'RAG processing failed.' });
  }
});

// Get query history for project
ragRoutes.get('/projects/:projectId/rag/history', authMiddleware, projectAccess, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const history = await db.getRagQueries(projectId);
  res.json({ history });
});

// Get suggested questions
ragRoutes.get('/projects/:projectId/rag/suggested', authMiddleware, projectAccess, (_req: Request, res: Response) => {
  const defaultSuggestions = [
    'What is the current status of this project?',
    'What tasks are still pending?',
    'What are the latest blockers and risks requiring attention?',
    'Which architectural decisions have been approved?',
    'What are the primary external dependencies?',
  ];

  res.json({ suggestions: defaultSuggestions });
});
