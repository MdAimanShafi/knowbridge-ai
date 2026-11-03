import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Project, ProjectDocument, Finding } from '../types/index.ts';
import { useAuth } from './AuthContext.tsx';
import { safeFetchJson } from '../utils/api.ts';

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  documents: ProjectDocument[];
  findings: Finding[];
  isLoading: boolean;
  setActiveProject: (proj: Project | null) => void;
  refreshProjects: () => Promise<void>;
  refreshProjectData: () => Promise<void>;
  createProject: (data: Partial<Project> & { name: string }) => Promise<Project | null>;
  resetDemoData: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProjects = useCallback(async () => {
    if (!token) {
      setProjects([]);
      setActiveProject(null);
      setIsLoading(false);
      return;
    }

    const res = await safeFetchJson<{ projects: Project[] }>('/api/projects');
    if (res.ok && res.data?.projects) {
      setProjects(res.data.projects);
      if (!activeProject && res.data.projects.length > 0) {
        const phoenix = res.data.projects.find((project) => project.code === 'PHX-MIG');
        setActiveProject(phoenix || res.data.projects[0]);
      } else if (activeProject) {
        const updatedActive = res.data.projects.find((project) => project.id === activeProject.id);
        setActiveProject(
          updatedActive ||
            res.data.projects.find((project) => project.code === 'PHX-MIG') ||
            res.data.projects[0] ||
            null
        );
      }
    } else if (res.status === 401) {
      setProjects([]);
      setActiveProject(null);
    }
    setIsLoading(false);
  }, [activeProject, token]);

  const fetchProjectData = useCallback(async () => {
    if (!activeProject || !token) {
      setDocuments([]);
      setFindings([]);
      return;
    }

    const [docsRes, findingsRes] = await Promise.all([
      safeFetchJson<{ documents: ProjectDocument[] }>(`/api/projects/${activeProject.id}/documents`),
      safeFetchJson<{ findings: Finding[] }>(`/api/projects/${activeProject.id}/findings`),
    ]);

    if (docsRes.ok && docsRes.data?.documents) {
      setDocuments(docsRes.data.documents);
    }
    if (findingsRes.ok && findingsRes.data?.findings) {
      setFindings(findingsRes.data.findings);
    }
  }, [activeProject, token]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    void fetchProjectData();
  }, [fetchProjectData]);

  const createProject = async (data: Partial<Project> & { name: string }) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;

      const response = await res.json();
      await fetchProjects();
      setActiveProject(response.project);
      return response.project;
    } catch {
      return null;
    }
  };

  const resetDemoData = async () => {
    const res = await safeFetchJson<{ success: boolean }>('/api/system/reset-demo', { method: 'POST' });
    if (!res.ok || !res.data?.success) {
      throw new Error(res.error || 'Failed to reset demo data.');
    }
    await fetchProjects();
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        documents,
        findings,
        isLoading,
        setActiveProject,
        refreshProjects: fetchProjects,
        refreshProjectData: fetchProjectData,
        createProject,
        resetDemoData,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};
