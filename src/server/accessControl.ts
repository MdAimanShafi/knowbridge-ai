import { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

export type ProjectRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'REVIEWER';
export type LegacyProjectRole = ProjectRole | 'LEAD';
export type AuthenticatedRequest = Request & {
  user?: { id: string; email: string; name: string; role: string };
};

const PROJECT_WRITERS: ProjectRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const PROJECT_CONTRIBUTORS: ProjectRole[] = [...PROJECT_WRITERS, 'MEMBER'];
const PROJECT_REVIEWERS: ProjectRole[] = [...PROJECT_WRITERS, 'REVIEWER'];

export function normalizeProjectRole(role: string | undefined): ProjectRole | null {
  const normalized = String(role || '').toUpperCase();
  if (normalized === 'LEAD') return 'MANAGER';
  return ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'REVIEWER'].includes(normalized)
    ? (normalized as ProjectRole)
    : null;
}

export async function hasProjectMembership(projectId: string, userId: string): Promise<boolean> {
  if (!projectId || !userId) return false;
  const members = await db.getProjectMembers(projectId);
  return members.some((member) => member.projectId === projectId && member.userId === userId);
}

export async function hasProjectRole(
  projectId: string,
  userId: string,
  roles: ProjectRole[]
): Promise<boolean> {
  if (!projectId || !userId) return false;
  const members = await db.getProjectMembers(projectId);
  const member = members.find((item) => item.projectId === projectId && item.userId === userId);
  const role = normalizeProjectRole(member?.role);
  return role !== null && roles.includes(role);
}

export function requireProjectAccess(
  getProjectId: (req: Request) => Promise<string | undefined> | string | undefined,
  allowedRoles?: ProjectRole[]
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = await getProjectId(req);
      if (!projectId) return res.status(404).json({ error: 'Project not found.' });
      const project = await db.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: 'Project not found.' });

      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId || !(await hasProjectMembership(projectId, userId))) {
        return res.status(403).json({ error: 'Project membership is required to access this resource.' });
      }
      if (allowedRoles && !(await hasProjectRole(projectId, userId, allowedRoles))) {
        return res.status(403).json({ error: 'Your project role does not permit this action.' });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export function requireResourceProjectAccess(
  resolveProjectId: (req: Request) => Promise<string | null | undefined> | string | null | undefined,
  allowedRoles?: ProjectRole[],
  resourceName = 'Resource'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = await resolveProjectId(req);
      if (!projectId) return res.status(404).json({ error: `${resourceName} not found.` });
      const project = await db.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: `${resourceName} not found.` });

      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId || !(await hasProjectMembership(projectId, userId))) {
        return res.status(403).json({ error: 'Project membership is required to access this resource.' });
      }
      if (allowedRoles && !(await hasProjectRole(projectId, userId, allowedRoles))) {
        return res.status(403).json({ error: 'Your project role does not permit this action.' });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export function projectIdParam(paramName = 'projectId') {
  return (req: Request) => req.params[paramName];
}

export function documentProjectId(paramName = 'id') {
  return async (req: Request) => (await db.getDocumentById(req.params[paramName]))?.projectId;
}

export function findingProjectId(paramName = 'id') {
  return async (req: Request) => (await db.getFindingById(req.params[paramName]))?.projectId;
}

export function handoverProjectId(paramName = 'id') {
  return async (req: Request) => (await db.getHandoverReportById(req.params[paramName]))?.projectId;
}

export const projectWriterRoles = PROJECT_WRITERS;
export const projectContributorRoles = PROJECT_CONTRIBUTORS;
export const projectReviewerRoles = PROJECT_REVIEWERS;
