import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ProjectProvider, useProject } from './context/ProjectContext.tsx';
import { Header } from './components/layout/Header.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { ProjectWorkspacePage } from './pages/ProjectWorkspacePage.tsx';
import { EvidenceCenterPage } from './pages/EvidenceCenterPage.tsx';
import { ReviewCenterPage } from './pages/ReviewCenterPage.tsx';
import { HandoverBuilderPage } from './pages/HandoverBuilderPage.tsx';
import { TaskRiskPage } from './pages/TaskRiskPage.tsx';
import { GitHubIntegrationPage } from './pages/GitHubIntegrationPage.tsx';
import { ActivityAuditPage } from './pages/ActivityAuditPage.tsx';
import { DocumentationHubPage } from './pages/DocumentationHubPage.tsx';
import { KnowledgeGraph3D } from './components/knowledgeGraph/KnowledgeGraph3D.tsx';
import { ProjectAssistantPage } from './pages/ProjectAssistantPage.tsx';
import { DataSourcesCenterPage } from './pages/DataSourcesCenterPage.tsx';
import { ProjectSetupPage } from './pages/ProjectSetupPage.tsx';
import { EvidenceInspectorModal } from './components/common/EvidenceInspectorModal.tsx';
import { NewProjectWizardModal } from './components/common/NewProjectWizardModal.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { Finding } from './types/index.ts';

function AppContent() {
  const { user, isLoading } = useAuth();
  const { activeProject } = useProject();
  const [currentView, setCurrentView] = useState<string>('workspace');
  const [inspectingFinding, setInspectingFinding] = useState<Finding | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isSidebarOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isSidebarOpen]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-xs font-mono text-slate-400">Initializing KNOWBRIDGE AI Platform...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardPage
            setCurrentView={setCurrentView}
            onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
            onInspectFinding={(f) => setInspectingFinding(f)}
          />
        );
      case 'workspace':
      case 'reconstruct':
        return (
          <ProjectWorkspacePage
            setCurrentView={setCurrentView}
            onInspectFinding={(f) => setInspectingFinding(f)}
          />
        );
      case 'assistant':
        return <ProjectAssistantPage onInspectFinding={(f) => setInspectingFinding(f)} />;
      case 'connectors':
      case 'datasources':
        return <DataSourcesCenterPage setCurrentView={setCurrentView} />;
      case 'setup':
        return <ProjectSetupPage setCurrentView={setCurrentView} />;
      case 'evidence':
        return <EvidenceCenterPage onInspectFinding={(f) => setInspectingFinding(f)} />;
      case 'reviews':
        return <ReviewCenterPage onInspectFinding={(f) => setInspectingFinding(f)} />;
      case 'handover':
        return <HandoverBuilderPage onInspectFinding={(f) => setInspectingFinding(f)} />;
      case 'tasks':
      case 'risks':
        return <TaskRiskPage onInspectFinding={(f) => setInspectingFinding(f)} />;
      case 'github':
        return <GitHubIntegrationPage />;
      case 'activity':
        return <ActivityAuditPage />;
      case 'graph':
      case 'knowledge-graph':
        return <KnowledgeGraph3D onSelectFinding={(f) => setInspectingFinding(f)} />;
      case 'docs':
        return <DocumentationHubPage />;
      default:
        return (
          <ProjectWorkspacePage
            setCurrentView={setCurrentView}
            onInspectFinding={(f) => setInspectingFinding(f)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-600 selection:text-white">
      {/* Top Bar adhering to Top Bar Contract */}
      <Header
        setCurrentView={setCurrentView}
        onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
        onOpenNavigation={() => setIsSidebarOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        {isSidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
          isMobileOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Workspace Canvas */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-950/90">{renderActiveView()}</main>
      </div>

      {/* Global Modals */}
      <EvidenceInspectorModal
        finding={inspectingFinding}
        isOpen={Boolean(inspectingFinding)}
        onClose={() => setInspectingFinding(null)}
      />

      <NewProjectWizardModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onProjectCreated={() => {
          setCurrentView('setup');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <AppContent />
      </ProjectProvider>
    </AuthProvider>
  );
}
