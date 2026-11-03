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
    const res = await safeFetchJson<{ projects: Project[] }>('/api/projects');
    if (res.ok && res.data?.projects) {
      setProjects(res.data.projects);
      if (!activeProject && res.data.projects.length > 0) {
        const phx = res.data.projects.find((p) => p.code === 'PHX-MIG') || res.data.projects[0];
        setActiveProject(phx);
      } else if (activeProject) {
        const updatedActive = res.data.projects.find((p) => p.id === activeProject.id);
        if (updatedActive) setActiveProject(updatedActive);
      }
    }
    setIsLoading(false);
  }, [activeProject]);

  const fetchProjectData = useCallback(async () => {
    if (!activeProject) return;

    const [docsRes, fndsRes] = await Promise.all([
      safeFetchJson<{ documents: ProjectDocument[] }>(`/api/projects/${activeProject.id}/documents`),
      safeFetchJson<{ findings: Finding[] }>(`/api/projects/${activeProject.id}/findings`),
    ]);

    if (docsRes.ok && docsRes.data?.documents) {
      setDocuments(docsRes.data.documents);
    }
    if (fndsRes.ok && fndsRes.data?.findings) {
      setFindings(fndsRes.data.findings);
    }
  }, [activeProject]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (activeProject) {
      fetchProjectData();
    }
  }, [activeProject, fetchProjectData]);

  const createProject = async (data: Partial<Project> & { name: string }) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const resData = await res.json();
        await fetchProjects();
        setActiveProject(resData.project);
        return resData.project;
      }
      return null;
    } catch {
      return null;
    }
  };

  const resetDemoData = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/system/reset-demo', { method: 'POST', headers });
      await fetchProjects();
      if (activeProject) {
        await fetchProjectData();
      }
    } catch (err) {
      console.error('Failed to reset demo seed:', err);
    }
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
