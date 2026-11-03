import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';
import { answerProjectQuestion } from '../ragEngine.ts';
import { RagQueryRequest } from '../../types/index.ts';

export const ragRoutes = Router();

// Ask a natural language question about the project with strict grounding
ragRoutes.post('/projects/:projectId/rag/query', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { projectId } = req.params;
  const { question, filter } = req.body as RagQueryRequest;

  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: 'Please enter a valid question.' });
  }

  const project = db.getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project workspace not found.' });
  }

  try {
    const sourceRecords = db.getSourceRecords(projectId);
    const documents = db.getDocuments(projectId);
    const findings = db.getFindings(projectId);

    const answer = await answerProjectQuestion(
      project,
      { question, filter },
      sourceRecords,
      documents,
      findings
    );

    // Save to query log
    db.saveRagQuery(projectId, question, answer, user?.id);

    // Log query in audit log
    db.logActivity({
      projectId,
      userId: user?.id || 'anonymous',
      userName: user?.name || 'Evaluator',
      action: 'Project Intelligence Query',
      category: 'RAG_QUERY',
      details: `Asked: "${question.slice(0, 70)}..." -> Status: ${answer.verificationStatus} (${answer.supportingSources.length} citations).`,
    });

    res.json({ answer });
  } catch (err: any) {
    console.error('RAG query execution error:', err);
    res.status(500).json({ error: `RAG processing failed: ${err.message || 'Internal error'}` });
  }
});

// Get query history for project
ragRoutes.get('/projects/:projectId/rag/history', authMiddleware, (req: Request, res: Response) => {
  const { projectId } = req.params;
  const history = db.getRagQueries(projectId);
  res.json({ history });
});

// Get suggested questions
ragRoutes.get('/projects/:projectId/rag/suggested', authMiddleware, (req: Request, res: Response) => {
  const { projectId } = req.params;
  const project = db.getProjectById(projectId);

  const defaultSuggestions = [
    'What is the current status of this project?',
    'What tasks are still pending?',
    'What are the latest blockers and risks requiring attention?',
    'Who is responsible for the database migration?',
    'Why did we select PostgreSQL over DynamoDB or MongoDB?',
    'Which pull requests and issues are currently open?',
    'What knowledge will the departing engineer need to transfer before leaving?',
    'What should the incoming developer do first?',
  ];

  res.json({ suggestions: defaultSuggestions });
});
