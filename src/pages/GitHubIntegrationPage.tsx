import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { GitHubConnection } from '../types/index.ts';
import { safeFetchJson } from '../utils/api.ts';
import {
  Github,
  GitPullRequest,
  GitCommit,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';

export const GitHubIntegrationPage: React.FC = () => {
  const { activeProject, refreshProjectData } = useProject();
  const { token } = useAuth();
  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Form fields for connecting new repo
  const [owner, setOwner] = useState('phoenix-retail');
  const [repo, setRepo] = useState('storefront-platform-core');
  const [branch, setBranch] = useState('main');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      if (!activeProject) return;
      const res = await safeFetchJson<{ connection: GitHubConnection }>(
        `/api/integrations/github/status/${activeProject.id}`
      );
      if (res.ok && res.data?.connection) {
        setConnection(res.data.connection);
      }
    }
    fetchStatus();
  }, [activeProject]);

  const handleSync = async () => {
    if (!activeProject) return;
    setIsSyncing(true);
    setSyncMsg('');
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/integrations/github/sync/${activeProject.id}`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setSyncMsg(`Successfully synchronized repo! Extracted ${data.count} code-level findings.`);
        await refreshProjectData();
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    setIsConnecting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/integrations/github/connect', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: activeProject.id,
          repoOwner: owner,
          repoName: repo,
          branch,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConnection(data.connection);
      }
    } catch (err) {
      console.error('Connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <div className="text-xs font-mono text-sky-400 mb-1">CODEBASE INTEGRATION WORKSTREAM</div>
        <h1 className="text-2xl font-bold text-white tracking-tight">GitHub Integration & Code Sync</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Preserve code-level knowledge: connect project repositories to track unmerged branches,
          in-flight pull requests, and telemetry blockers without exposing secrets.
        </p>
      </div>

      {syncMsg && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 rounded-lg">
          {syncMsg}
        </div>
      )}

      {connection ? (
        <div className="space-y-6">
          {/* Active Repo Card */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white">
                  <Github className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {connection.repoOwner} / {connection.repoName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>Default Branch: <strong className="text-sky-400 font-mono">{connection.branch}</strong></span>
                    <span>·</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Authorized Connection</span>
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors flex items-center gap-2 shadow-sm self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Synchronizing Repository...' : 'Sync Repository Findings'}</span>
              </button>
            </div>

            {/* Metric counters */}
            <div className="grid grid-cols-3 gap-4 pt-2 text-xs">
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="text-slate-400 mb-1 flex items-center gap-1.5">
                  <GitPullRequest className="w-3.5 h-3.5 text-sky-400" />
                  <span>Open Pull Requests</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {connection.openPRsCount} In-Flight
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="text-slate-400 mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tracked Issues</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {connection.openIssuesCount} Open
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="text-slate-400 mb-1 flex items-center gap-1.5">
                  <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Analyzed Commits</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {connection.recentCommitsCount} Commits
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800">
              <span>Last synchronized: {connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : 'Just now'}</span>
              <span className="text-slate-400 font-mono">Scoped permissions: read:repository, read:org</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl max-w-xl space-y-4">
          <div className="flex items-center gap-3">
            <Github className="w-8 h-8 text-sky-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Connect GitHub Repository</h3>
              <p className="text-xs text-slate-400">Authorize access to synchronize repo code context</p>
            </div>
          </div>

          <form onSubmit={handleConnect} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Organization / Owner</label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Repository Name</label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Default Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={isConnecting}
              className="w-full py-2 px-4 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Github className="w-4 h-4" />
              <span>{isConnecting ? 'Connecting...' : 'Authorize Repository'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
