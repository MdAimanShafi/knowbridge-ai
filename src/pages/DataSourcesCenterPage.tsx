import React, { useEffect, useState } from 'react';
import { useProject } from '../context/ProjectContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { safeFetchJson } from '../utils/api.ts';
import {
  SourceConnection,
  SourceRecord,
  SyncJobRecord,
  ConnectorService,
} from '../types/index.ts';
import {
  GitBranch,
  FileText,
  FolderSync,
  Database,
  MessageSquare,
  BookOpen,
  Calendar,
  Users2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  Settings,
  Layers,
  ChevronRight,
  X,
  History,
} from 'lucide-react';

interface Props {
  setCurrentView: (view: string) => void;
}

export const DataSourcesCenterPage: React.FC<Props> = ({ setCurrentView }) => {
  const { activeProject, refreshProjectData } = useProject();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<'CONNECTORS' | 'RECORDS'>('CONNECTORS');
  const [connectors, setConnectors] = useState<SourceConnection[]>([]);
  const [sourceRecords, setSourceRecords] = useState<SourceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncingService, setSyncingService] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<SourceConnection | null>(null);
  const [inspectRecord, setInspectRecord] = useState<SourceRecord | null>(null);
  const [configureService, setConfigureService] = useState<SourceConnection | null>(null);

  // Configuration modal state
  const [repoOwnerInput, setRepoOwnerInput] = useState('');
  const [repoNameInput, setRepoNameInput] = useState('');
  const [branchInput, setBranchInput] = useState('main');
  const [tokenInput, setTokenInput] = useState('');

  // Records tab filters
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const loadData = async () => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
      const connRes = await safeFetchJson<{ connectors: SourceConnection[] }>(
        `/api/projects/${activeProject.id}/connectors`
      );
      if (connRes.ok && connRes.data) {
        setConnectors(connRes.data.connectors);
      }

      const recRes = await safeFetchJson<{ total: number; records: SourceRecord[] }>(
        `/api/projects/${activeProject.id}/source-records`
      );
      if (recRes.ok && recRes.data) {
        setSourceRecords(recRes.data.records);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeProject]);

  const handleSyncNow = async (service: ConnectorService) => {
    if (!activeProject) return;
    setSyncingService(service);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/projects/${activeProject.id}/connectors/${service}/sync`, {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        await loadData();
        await refreshProjectData();
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncingService(null);
    }
  };

  const handleDisconnect = async (service: ConnectorService) => {
    if (!activeProject) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/projects/${activeProject.id}/connectors/${service}/disconnect`, {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !configureService) return;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `/api/projects/${activeProject.id}/connectors/${configureService.service}/connect`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            repoOwner: repoOwnerInput || 'phoenix-retail',
            repoName: repoNameInput || 'ecommerce-core',
            branch: branchInput || 'main',
            accessToken: tokenInput || undefined,
          }),
        }
      );

      if (res.ok) {
        setConfigureService(null);
        await loadData();
        await refreshProjectData();
      }
    } catch (err) {
      console.error('Connection update failed:', err);
    }
  };

  const getServiceIcon = (svc: ConnectorService) => {
    switch (svc) {
      case 'GITHUB':
        return <GitBranch className="w-5 h-5 text-sky-400" />;
      case 'DOCUMENT':
        return <FileText className="w-5 h-5 text-emerald-400" />;
      case 'GOOGLE_DRIVE':
        return <FolderSync className="w-5 h-5 text-amber-400" />;
      case 'JIRA':
        return <Database className="w-5 h-5 text-blue-400" />;
      case 'SLACK':
        return <MessageSquare className="w-5 h-5 text-fuchsia-400" />;
      case 'NOTION':
        return <BookOpen className="w-5 h-5 text-slate-300" />;
      case 'GOOGLE_CALENDAR':
        return <Calendar className="w-5 h-5 text-rose-400" />;
      case 'MS_TEAMS':
        return <Users2 className="w-5 h-5 text-indigo-400" />;
      default:
        return <Database className="w-5 h-5 text-slate-400" />;
    }
  };

  const filteredRecords = sourceRecords.filter((r) => {
    if (platformFilter !== 'ALL' && r.sourcePlatform !== platformFilter) return false;
    if (typeFilter !== 'ALL' && r.recordType !== typeFilter) return false;
    if (searchTerm.trim().length > 0) {
      const q = searchTerm.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q) ||
        r.author.toLowerCase().includes(q) ||
        r.externalSourceId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 border border-slate-800 rounded-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
            <span>Modular Connector Architecture · Multi-Platform Data Ingestion</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Data Sources & Connector Center</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Manage authorized connections to project streams. All imported commits, pull requests, issues,
            and document chunks are indexed with strict provenance and cryptographic content hashes.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('CONNECTORS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'CONNECTORS' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Data Connectors ({connectors.filter((c) => c.status === 'CONNECTED').length} Active)
            </button>
            <button
              onClick={() => setActiveTab('RECORDS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'RECORDS' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Canonical Source Records ({sourceRecords.length})
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: INTEGRATION CONNECTORS CARDS */}
      {activeTab === 'CONNECTORS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {connectors.map((conn) => {
              const isSyncing = syncingService === conn.service;
              const isConnected = conn.status === 'CONNECTED';
              const isAuthReq = conn.status === 'AUTH_REQUIRED';

              return (
                <div
                  key={conn.id}
                  className={`p-5 bg-slate-900 border rounded-xl flex flex-col justify-between transition-all ${
                    isConnected
                      ? 'border-slate-800 hover:border-slate-700 shadow-md'
                      : 'border-slate-800/60 opacity-90'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                        {getServiceIcon(conn.service)}
                      </div>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono rounded font-semibold ${
                          isConnected
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isAuthReq
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {conn.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-white">{conn.name}</h3>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {conn.accountOrWorkspace} · {conn.connectedProject}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Imported Records:</span>
                        <span className="font-mono text-white font-semibold tabular-nums">
                          {conn.importedRecordsCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Permission Status:</span>
                        <span className="font-mono text-sky-400 text-[10px] truncate max-w-[140px]">
                          {conn.permissionStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Last Synchronised:</span>
                        <span className="font-mono text-slate-300 text-[10px]">
                          {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    {isConnected ? (
                      <>
                        <button
                          onClick={() => handleSyncNow(conn.service)}
                          disabled={isSyncing}
                          className="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/40 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedHistory(conn)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="View Sync History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setConfigureService(conn);
                              setRepoOwnerInput(conn.authConfig.repoOwner || '');
                              setRepoNameInput(conn.authConfig.repoName || '');
                              setBranchInput(conn.authConfig.branch || 'main');
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="Configure Connection"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setConfigureService(conn);
                          setRepoOwnerInput('phoenix-retail');
                          setRepoNameInput('ecommerce-core');
                          setBranchInput('main');
                        }}
                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-xs text-center transition-colors"
                      >
                        Connect & Authorise
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: UNIFIED CANONICAL SOURCE RECORDS EXPLORER */}
      {activeTab === 'RECORDS' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search commits, PRs, issues, document chunks, authors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 text-xs"
                />
              </div>

              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none text-xs"
              >
                <option value="ALL">All Platforms</option>
                <option value="GITHUB">GitHub</option>
                <option value="DOCUMENT">Documents</option>
                <option value="GOOGLE_DRIVE">Google Drive</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none text-xs"
              >
                <option value="ALL">All Types</option>
                <option value="COMMIT">Commits</option>
                <option value="PULL_REQUEST">Pull Requests</option>
                <option value="ISSUE">Issues</option>
                <option value="DOCUMENT_CHUNK">Document Chunks</option>
              </select>
            </div>

            <div className="text-slate-400 font-mono text-[11px]">
              Showing <strong className="text-white">{filteredRecords.length}</strong> of {sourceRecords.length} records
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px] font-mono">
                  <th className="py-3 px-4">Platform / Type</th>
                  <th className="py-3 px-4">Title & Context</th>
                  <th className="py-3 px-4">Author / Owner</th>
                  <th className="py-3 px-4">External Source ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            rec.sourcePlatform === 'GITHUB'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {rec.sourcePlatform}
                        </span>
                        <span className="text-slate-500 text-[10px] font-mono">{rec.recordType}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <div className="font-semibold text-slate-200 line-clamp-1">{rec.title}</div>
                      <div className="text-slate-400 text-[11px] line-clamp-1 mt-0.5">{rec.content}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-300 font-medium">
                      {rec.author}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-sky-400">
                      {rec.externalSourceId}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400 text-[10px]">
                      {new Date(rec.createdDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setInspectRecord(rec)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors"
                      >
                        Inspect Record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sync History Modal */}
      {selectedHistory && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="font-bold text-base text-white">{selectedHistory.name}</div>
                <div className="text-slate-400 text-[11px]">Sync Checkpoint & Ingestion History</div>
              </div>
              <button onClick={() => setSelectedHistory(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {selectedHistory.syncHistory.length === 0 ? (
                <div className="text-slate-500 py-6 text-center">No prior sync jobs recorded.</div>
              ) : (
                selectedHistory.syncHistory.map((job) => (
                  <div key={job.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-emerald-400 font-bold">{job.status}</span>
                      <span className="text-slate-400">{new Date(job.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-slate-300 font-medium text-xs">{job.summary}</div>
                    <div className="text-[11px] text-slate-500 flex gap-4">
                      <span>Imported: {job.recordsImported}</span>
                      <span>Duration: {job.durationMs}ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedHistory(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Configuration Modal */}
      {configureService && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="font-bold text-base text-white">Configure {configureService.name}</div>
                <div className="text-slate-400 text-[11px]">Official API & Permission Credentials</div>
              </div>
              <button onClick={() => setConfigureService(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConnection} className="space-y-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Repository Owner / Org</label>
                <input
                  type="text"
                  value={repoOwnerInput}
                  onChange={(e) => setRepoOwnerInput(e.target.value)}
                  placeholder="e.g. phoenix-retail"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Repository Name</label>
                <input
                  type="text"
                  value={repoNameInput}
                  onChange={(e) => setRepoNameInput(e.target.value)}
                  placeholder="e.g. ecommerce-core"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Target Branch</label>
                <input
                  type="text"
                  value={branchInput}
                  onChange={(e) => setBranchInput(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  GitHub Personal Access Token (Optional)
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_••••••••••••••••"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Leave blank to use pre-authorized verified synthetic repository records.
                </span>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setConfigureService(null)}
                  className="px-3.5 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg"
                >
                  Save & Authorise
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Source Record Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="font-bold text-base text-white">{inspectRecord.title}</div>
                <div className="text-sky-400 font-mono text-[11px]">
                  {inspectRecord.sourcePlatform} · {inspectRecord.recordType} · {inspectRecord.externalSourceId}
                </div>
              </div>
              <button onClick={() => setInspectRecord(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg max-h-60 overflow-y-auto font-mono text-slate-300 text-[11px] whitespace-pre-wrap leading-relaxed">
              {inspectRecord.content}
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px] pt-2 border-t border-slate-800 text-slate-400">
              <div>Author: <strong className="text-slate-200">{inspectRecord.author}</strong></div>
              <div>Timestamp: <strong className="text-slate-200">{new Date(inspectRecord.createdDate).toLocaleString()}</strong></div>
              <div>Content Hash: <strong className="text-slate-200 font-mono">{inspectRecord.contentHash.slice(0, 16)}...</strong></div>
              <div>Source URL: <strong className="text-sky-400 truncate block">{inspectRecord.sourceUrl}</strong></div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectRecord(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
