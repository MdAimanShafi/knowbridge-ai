import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useProject } from '../../context/ProjectContext.tsx';
import { LogOut, User as UserIcon, RefreshCw, FileDown, ShieldCheck } from 'lucide-react';

interface Props {
  currentView: string;
  setCurrentView: (view: string) => void;
  onOpenNewProjectModal: () => void;
}

export const Header: React.FC<Props> = ({ currentView, setCurrentView, onOpenNewProjectModal }) => {
  const { user, logout, demoLogin, loginWithGoogle } = useAuth();
  const { activeProject, resetDemoData } = useProject();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleResetDemo = async () => {
    setIsResetting(true);
    await resetDemoData();
    setIsResetting(false);
    setShowUserMenu(false);
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900 border-b border-slate-800 shrink-0">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setCurrentView('workspace')}
          className="text-lg font-bold tracking-tight text-white hover:text-sky-400 transition-colors whitespace-nowrap shrink-0 text-left"
        >
          KNOWBRIDGE AI
        </button>
      </div>

      {/* Zone 2: 4–5 clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
        <button
          onClick={() => setCurrentView('dashboard')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            currentView === 'dashboard' ? 'text-white border-b-2 border-sky-500' : ''
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setCurrentView('workspace')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            currentView === 'workspace' ? 'text-white border-b-2 border-sky-500' : ''
          }`}
        >
          Workflow
        </button>
        <button
          onClick={() => setCurrentView('assistant')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 flex items-center gap-1.5 ${
            currentView === 'assistant' ? 'text-white border-b-2 border-sky-500' : ''
          }`}
        >
          <span>AI Assistant</span>
          <span className="text-[10px] text-emerald-400 font-mono">RAG</span>
        </button>
        <button
          onClick={() => setCurrentView('connectors')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            currentView === 'connectors' ? 'text-white border-b-2 border-sky-500' : ''
          }`}
        >
          Data Sources
        </button>
        <button
          onClick={() => setCurrentView('graph')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            currentView === 'graph' ? 'text-white border-b-2 border-sky-500' : ''
          }`}
        >
          3D Graph
        </button>
        <button
          onClick={() => setCurrentView('reviews')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            currentView === 'reviews' ? 'text-white border-b-2 border-sky-500' : ''
          }`}
        >
          Reviews
        </button>
        <button
          onClick={() => setCurrentView('handover')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            currentView === 'handover' ? 'text-white border-b-2 border-sky-500' : ''
          }`}
        >
          Dossier
        </button>
        <button
          onClick={() => setCurrentView('docs')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            currentView === 'docs' ? 'text-white border-b-2 border-sky-500' : ''
          }`}
        >
          Documentation
        </button>
      </nav>

      {/* Zone 3: 1 primary action / account selector */}
      <div className="flex items-center gap-3 shrink-0 relative">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <div className="w-5 h-5 rounded-full bg-sky-600 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                user?.name?.charAt(0) || 'A'
              )}
            </div>
            <span className="hidden sm:inline max-w-[120px] truncate">{user?.name || 'Alex Rivera'}</span>
          </button>

          {/* User Account Popover */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 text-xs">
              <div className="px-4 py-2 border-b border-slate-800">
                <div className="font-semibold text-slate-100">{user?.name}</div>
                <div className="text-slate-400 text-[11px] truncate">{user?.email}</div>
                <div className="text-sky-400 text-[10px] mt-1 font-mono">{user?.title}</div>
              </div>

              <div className="px-2 py-1.5 border-b border-slate-800">
                <button
                  onClick={async () => {
                    setIsGoogleLoading(true);
                    await loginWithGoogle();
                    setIsGoogleLoading(false);
                    setShowUserMenu(false);
                  }}
                  disabled={isGoogleLoading}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 rounded text-slate-200 transition-colors text-left"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{isGoogleLoading ? 'Connecting...' : 'Sign in with Google'}</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">Firebase</span>
                </button>
              </div>

              <div className="px-2 py-1.5 border-b border-slate-800">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Switch Judge Persona
                </div>
                <button
                  onClick={() => {
                    demoLogin('alex');
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-slate-300 transition-colors"
                >
                  Alex Rivera (Successor Lead)
                </button>
                <button
                  onClick={() => {
                    demoLogin('sarah');
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-slate-300 transition-colors"
                >
                  Sarah Lin (Departing Architect)
                </button>
                <button
                  onClick={() => {
                    demoLogin('marcus');
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-slate-300 transition-colors"
                >
                  Marcus Vance (Reviewer Director)
                </button>
              </div>

              <div className="px-2 py-1.5 border-b border-slate-800">
                <button
                  onClick={handleResetDemo}
                  disabled={isResetting}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 text-slate-300 transition-colors text-left"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>{isResetting ? 'Resetting Store...' : 'Reset Demo Seed Data'}</span>
                </button>
              </div>

              <div className="px-2 pt-1">
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-red-950/40 text-red-400 transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
