import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware } from '../auth.ts';

export const projectRoutes = Router();

// List all projects
projectRoutes.get('/', authMiddleware, (_req: Request, res: Response) => {
  const projects = db.getProjects();
  res.json({ projects });
});

// Create project
projectRoutes.post('/', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const {
    name,
    code,
    description,
    category,
    departingMemberName,
    departingMemberRole,
    successorName,
    targetHandoverDate,
    objectives,
    startDate,
    expectedCompletionDate,
    teamMembers,
    techStack,
    importantDeadlines,
    knownRisks,
    existingDependencies,
    projectDocumentationNotes,
    setupCompleted,
    currentSetupStep,
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required.' });
  }

  const project = db.createProject({
    name,
    code: code || name.replace(/[^A-Za-z0-9]/g, '').substring(0, 5).toUpperCase(),
    description,
    category,
    ownerId: user.id,
    ownerName: user.name,
    departingMemberName,
    departingMemberRole,
    successorName,
    targetHandoverDate,
    objectives,
    startDate,
    expectedCompletionDate,
    teamMembers,
    techStack,
    importantDeadlines,
    knownRisks,
    existingDependencies,
    projectDocumentationNotes,
    setupCompleted,
    currentSetupStep,
  });

  // Add creator as OWNER member
  db.addProjectMember(project!.id, user, 'OWNER');

  db.logActivity({
    projectId: project!.id,
    userId: user.id,
    userName: user.name,
    action: 'Project Created',
    category: 'PROJECT',
    details: `Workspace "${project!.name}" created with code ${project!.code}.`,
  });

  res.status(201).json({ project });
});

// Get single project
projectRoutes.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const project = db.getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  res.json({ project });
});

// Update project
projectRoutes.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const project = db.updateProject(req.params.id, req.body);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  db.logActivity({
    projectId: project.id,
    userId: user.id,
    userName: user.name,
    action: 'Project Updated',
    category: 'PROJECT',
    details: `Workspace metadata updated by ${user.name}.`,
  });

  res.json({ project });
});

// Get project members
projectRoutes.get('/:id/members', authMiddleware, (req: Request, res: Response) => {
  const members = db.getProjectMembers(req.params.id);
  res.json({ members });
});

// Add project member
projectRoutes.post('/:id/members', authMiddleware, (req: Request, res: Response) => {
  const { userId, role } = req.body;
  const userToAdd = db.findUserById(userId);
  if (!userToAdd) {
    return res.status(404).json({ error: 'User to add was not found.' });
  }
  const member = db.addProjectMember(req.params.id, userToAdd, role || 'MEMBER');
  res.status(201).json({ member });
});
