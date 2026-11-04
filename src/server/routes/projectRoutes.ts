import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { authMiddleware, AuthenticatedRequest } from '../auth.ts';
import { buildSuccessorOnboardingPlan } from '../onboardingService.ts';
import {
  hasProjectRole,
  normalizeProjectRole,
  projectIdParam,
  projectWriterRoles,
  requireProjectAccess,
} from '../accessControl.ts';

export const projectRoutes = Router();
const projectMemberAccess = requireProjectAccess(projectIdParam('id'));
const projectWriterAccess = requireProjectAccess(projectIdParam('id'), projectWriterRoles);

function validateProjectUpdates(updates: Record<string, unknown>): string | null {
  const stringLimits: Record<string, number> = {
    name: 200,
    code: 30,
    description: 5000,
    category: 100,
    departingMemberName: 200,
    departingMemberRole: 200,
    successorName: 200,
    targetHandoverDate: 40,
    objectives: 5000,
    startDate: 40,
    expectedCompletionDate: 40,
    projectDocumentationNotes: 10000,
  };
  for (const [field, value] of Object.entries(updates)) {
    if (
      stringLimits[field] !== undefined &&
      value !== undefined &&
      (typeof value !== 'string' || value.length > stringLimits[field])
    ) {
      return `Invalid ${field}.`;
    }
  }
  if (
    updates.status !== undefined &&
    !['ACTIVE', 'HANDOVER_IN_PROGRESS', 'HANDOVER_COMPLETE', 'ARCHIVED'].includes(String(updates.status))
  ) {
    return 'Unsupported project status.';
  }
  if (updates.setupCompleted !== undefined && typeof updates.setupCompleted !== 'boolean') {
    return 'setupCompleted must be a boolean.';
  }
  if (
    updates.currentSetupStep !== undefined &&
    (!Number.isInteger(updates.currentSetupStep) ||
      Number(updates.currentSetupStep) < 1 ||
      Number(updates.currentSetupStep) > 5)
  ) {
    return 'currentSetupStep must be an integer between 1 and 5.';
  }
  for (const field of ['techStack', 'knownRisks', 'existingDependencies'] as const) {
    const value = updates[field];
    if (
      value !== undefined &&
      (!Array.isArray(value) ||
        value.length > 100 ||
        value.some((entry) => typeof entry !== 'string' || entry.length > 500))
    ) {
      return `${field} must be an array of at most 100 strings (500 characters each).`;
    }
  }
  for (const field of ['teamMembers', 'importantDeadlines'] as const) {
    const value = updates[field];
    if (
      value !== undefined &&
      (!Array.isArray(value) ||
        value.length > 100 ||
        value.some((item) => !item || typeof item !== 'object' || Array.isArray(item)))
    ) {
      return `${field} must be an array of at most 100 objects.`;
    }
  }
  return null;
}

projectRoutes.get('/', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user!;
  const projects = await db.getProjectsForUser(user.id);
  res.json({ projects });
});

projectRoutes.get('/:id/onboarding', authMiddleware, projectMemberAccess, async (req: Request, res: Response) => {
  const project = await db.getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }
  const [documents, findings] = await Promise.all([
    db.getDocuments(project.id),
    db.getFindings(project.id),
  ]);
  return res.json({ onboarding: buildSuccessorOnboardingPlan(project, documents, findings) });
});

projectRoutes.post('/', authMiddleware, async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user!;
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
  } = req.body || {};

  if (typeof name !== 'string' || !name.trim() || name.length > 200) {
    return res.status(400).json({ error: 'Project name is required and must be 200 characters or fewer.' });
  }
  const validationError = validateProjectUpdates({
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
  });
  if (validationError) return res.status(400).json({ error: validationError });

  const project = await db.createProject({
    name: name.trim(),
    code: typeof code === 'string' ? code.slice(0, 30) : undefined,
    description: typeof description === 'string' ? description.slice(0, 5000) : undefined,
    category: typeof category === 'string' ? category.slice(0, 100) : undefined,
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
  if (!project) return res.status(500).json({ error: 'Could not create project.' });

  const projectOwner = await db.findUserById(user.id);
  if (!projectOwner) return res.status(401).json({ error: 'Authenticated user no longer exists.' });
  await db.addProjectMember(project.id, projectOwner, 'OWNER');
  await db.logActivity({
    projectId: project.id,
    userId: user.id,
    userName: user.name,
    action: 'Project Created',
    category: 'PROJECT',
    details: `Workspace "${project.name}" created with code ${project.code}.`,
  });
  return res.status(201).json({ project });
});

projectRoutes.get('/:id', authMiddleware, projectMemberAccess, async (req: Request, res: Response) => {
  const project = await db.getProjectById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  return res.json({ project });
});

projectRoutes.put('/:id', authMiddleware, projectWriterAccess, async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user!;
  const editableFields = [
    'name',
    'code',
    'description',
    'category',
    'status',
    'departingMemberName',
    'departingMemberRole',
    'successorName',
    'targetHandoverDate',
    'objectives',
    'startDate',
    'expectedCompletionDate',
    'teamMembers',
    'techStack',
    'importantDeadlines',
    'knownRisks',
    'existingDependencies',
    'projectDocumentationNotes',
    'setupCompleted',
    'currentSetupStep',
  ] as const;
  const updates = Object.fromEntries(
    editableFields
      .filter((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field))
      .map((field) => [field, req.body[field]])
  );
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Provide project fields to update.' });
  const validationError = validateProjectUpdates(updates);
  if (validationError) return res.status(400).json({ error: validationError });
  if (typeof updates.name === 'string' && !updates.name.trim()) return res.status(400).json({ error: 'Project name is required.' });

  const project = await db.updateProject(req.params.id, updates);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  await db.logActivity({
    projectId: project.id,
    userId: user.id,
    userName: user.name,
    action: 'Project Updated',
    category: 'PROJECT',
    details: `Workspace metadata updated by ${user.name}.`,
  });
  return res.json({ project });
});

projectRoutes.get('/:id/members', authMiddleware, projectMemberAccess, async (req: Request, res: Response) => {
  const members = await db.getProjectMembers(req.params.id);
  return res.json({ members });
});

projectRoutes.post('/:id/members', authMiddleware, projectWriterAccess, async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user!;
  const { userId, role: requestedRole } = req.body || {};
  if (typeof userId !== 'string' || !userId) return res.status(400).json({ error: 'userId is required.' });
  const userToAdd = await db.findUserById(userId);
  if (!userToAdd) return res.status(404).json({ error: 'User to add was not found.' });

  const role = normalizeProjectRole(typeof requestedRole === 'string' ? requestedRole : 'MEMBER');
  if (!role) return res.status(400).json({ error: 'Unsupported project role.' });
  if (role === 'OWNER' && userId !== user.id) {
    return res.status(409).json({ error: 'Project ownership transfer is not supported by this endpoint.' });
  }
  const members = await db.getProjectMembers(req.params.id);
  const existingMember = members.find((member) => member.userId === userId);
  if (existingMember && normalizeProjectRole(existingMember.role) === 'OWNER' && role !== 'OWNER') {
    return res.status(409).json({ error: 'Project ownership cannot be changed through member updates.' });
  }
  const isOwnerOrAdmin = await hasProjectRole(req.params.id, user.id, ['OWNER', 'ADMIN']);
  const isOwner = await hasProjectRole(req.params.id, user.id, ['OWNER']);
  if ((role === 'OWNER' || role === 'ADMIN') && !isOwner) {
    return res.status(403).json({ error: 'Only a project owner may grant OWNER or ADMIN access.' });
  }
  if (!isOwnerOrAdmin && ['MANAGER'].includes(role)) {
    return res.status(403).json({ error: 'Only a project owner or admin may grant manager access.' });
  }

  const member = await db.addProjectMember(req.params.id, userToAdd, role);
  await db.logActivity({
    projectId: req.params.id,
    userId: user.id,
    userName: user.name,
    action: 'Project Member Added',
    category: 'PROJECT',
    details: `${user.name} added ${userToAdd.name} with ${role} access.`,
  });
  return res.status(201).json({ member });
});

projectRoutes.delete('/:id/members/:userId', authMiddleware, projectWriterAccess, async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user!;
  const members = await db.getProjectMembers(req.params.id);
  const member = members.find((item) => item.userId === req.params.userId);
  if (!member) return res.status(404).json({ error: 'Project member not found.' });
  const targetRole = normalizeProjectRole(member.role);
  if (targetRole === 'OWNER') return res.status(409).json({ error: 'Project ownership cannot be removed.' });
  if (['ADMIN', 'MANAGER'].includes(targetRole || '') && !(await hasProjectRole(req.params.id, user.id, ['OWNER']))) {
    return res.status(403).json({ error: 'Only a project owner may remove an admin or manager.' });
  }
  const removed = await db.removeProjectMember(req.params.id, req.params.userId);
  if (!removed) {
    return res.status(404).json({ error: 'Project member not found.' });
  }
  await db.logActivity({
    projectId: req.params.id,
    userId: user.id,
    userName: user.name,
    action: 'Project Member Removed',
    category: 'PROJECT',
    details: `${user.name} removed ${member.userName} from the project.`,
  });
  return res.json({ success: true });
});
