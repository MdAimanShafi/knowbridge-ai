import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useProject } from '../../context/ProjectContext.tsx';
import { LogOut, Menu, Plus, RefreshCw, Workflow } from 'lucide-react';

interface Props {
  setCurrentView: (view: string) => void;
  onOpenNewProjectModal: () => void;
  onOpenNavigation: () => void;
}

export const Header: React.FC<Props> = ({
  setCurrentView,
  onOpenNewProjectModal,
  onOpenNavigation,
}) => {
  const { user, logout, demoLogin } = useAuth();
  const { activeProject, resetDemoData } = useProject();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleResetDemo = async () => {
    if (!window.confirm('Reset the demo workspace to its original seed data? Current demo changes will be lost.')) {
      return;
    }

    setIsResetting(true);
    setResetError('');
    try {
      await resetDemoData();
      setShowUserMenu(false);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Failed to reset demo data.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-3 backdrop-blur-xl sm:px-5 lg:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenNavigation}
          aria-label="Open navigation"
          aria-controls="app-navigation"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setCurrentView('workspace')}
          className="group flex min-w-0 items-center gap-2.5 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-400/20 transition group-hover:bg-sky-500/15">
            <Workflow className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-tight text-white sm:text-base">
              KNOWBRIDGE <span className="text-sky-400">AI</span>
            </span>
            <span className="hidden truncate text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 sm:block">
              Project continuity
            </span>
          </span>
        </button>
        <span className="mx-1 hidden h-8 w-px bg-slate-800 md:block" />
        <div className="hidden min-w-0 md:block">
          <div className="max-w-[260px] truncate text-xs font-medium text-slate-200">
            {activeProject?.name || 'Select a project'}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
            {activeProject?.code || 'WORKSPACE'}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenNewProjectModal}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-sky-500 px-3 text-xs font-semibold text-slate-950 shadow-lg shadow-sky-950/20 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:px-3.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New project</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu((isOpen) => !isOpen)}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-700 hover:bg-slate-800 sm:px-2.5"
          >
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-sky-600 text-[11px] font-bold text-white">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                user?.name?.charAt(0) || 'A'
              )}
            </span>
            <span className="hidden max-w-[120px] truncate sm:inline">{user?.name || 'Account'}</span>
            <span className="hidden rounded-md bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] uppercase text-slate-400 sm:inline">
              {user?.role || 'Member'}
            </span>
          </button>

          {showUserMenu && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 text-xs shadow-2xl shadow-black/40"
            >
              <div className="border-b border-slate-800 px-4 py-3">
                <div className="font-semibold text-slate-100">{user?.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-slate-400">{user?.email}</div>
                <div className="mt-1.5 text-[10px] text-sky-400">{user?.title}</div>
              </div>

              <div className="border-b border-slate-800 p-2">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Demo personas
                </div>
                {([
                  ['alex', 'Alex Rivera · Successor'],
                  ['sarah', 'Sarah Lin · Architect'],
                  ['marcus', 'Marcus Vance · Reviewer'],
                ] as const).map(([role, label]) => (
                  <button
                    key={role}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      void demoLogin(role);
                      setShowUserMenu(false);
                    }}
                    className="w-full rounded-lg px-2 py-2 text-left text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {['demo@knowbridge.ai', 'sarah.lin@phoenix-retail.com', 'marcus.vance@phoenix-retail.com'].includes(
                user?.email.toLowerCase() || ''
              ) && (
                <div className="border-b border-slate-800 p-2">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleResetDemo()}
                    disabled={isResetting}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                    <span>{isResetting ? 'Resetting demo data...' : 'Reset demo data'}</span>
                  </button>
                  {resetError && (
                    <p role="alert" className="px-2 pt-2 text-[11px] leading-relaxed text-rose-400">
                      {resetError}
                    </p>
                  )}
                </div>
              )}

              <div className="p-2">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-rose-400 transition hover:bg-rose-500/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
