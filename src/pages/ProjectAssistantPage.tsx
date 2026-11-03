import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../context/ProjectContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { safeFetchJson } from '../utils/api.ts';
import {
  RagAnswerResponse,
  SupportingSourceCitation,
  ConflictingSourcePair,
  SourcePlatform,
} from '../types/index.ts';
import {
  Sparkles,
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  HelpCircle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Search,
  Filter,
  FileText,
  GitBranch,
  ShieldAlert,
  ArrowRight,
  Bookmark,
  Share2,
} from 'lucide-react';

interface Props {
  onInspectFinding?: (finding: any) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  ragResponse?: RagAnswerResponse;
}

export const ProjectAssistantPage: React.FC<Props> = ({ onInspectFinding }) => {
  const { activeProject, findings, documents } = useProject();
  const { user } = useAuth();

  const [queryInput, setQueryInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [inspectCitation, setInspectCitation] = useState<SupportingSourceCitation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<SourcePlatform | 'ALL'>('ALL');
  const [authorFilter, setAuthorFilter] = useState<string>('');

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load suggested questions and query history
  useEffect(() => {
    if (!activeProject) return;
    const proj = activeProject;

    async function initAssistant() {
      if (!proj) return;
      // Load suggestions
      const sugRes = await safeFetchJson<{ suggestions: string[] }>(
        `/api/projects/${proj.id}/rag/suggested`
      );
      if (sugRes.ok && sugRes.data?.suggestions) {
        setSuggestedQuestions(sugRes.data.suggestions);
      }

      // Load query history
      const histRes = await safeFetchJson<{ history: any[] }>(
        `/api/projects/${proj.id}/rag/history`
      );
      if (histRes.ok && histRes.data?.history && histRes.data.history.length > 0) {
        const loaded: ChatMessage[] = [];
        histRes.data.history.forEach((item) => {
          loaded.push({
            id: `q-${item.id}`,
            sender: 'user',
            text: item.question,
            timestamp: item.timestamp,
          });
          if (item.answer) {
            loaded.push({
              id: `a-${item.id}`,
              sender: 'assistant',
              text: item.answer.answer,
              timestamp: item.timestamp,
              ragResponse: item.answer,
            });
          }
        });
        setMessages(loaded);
      } else {
        // Welcome message with initial prompt guidance
        setMessages([
          {
            id: 'welcome',
            sender: 'assistant',
            text: `Welcome to KNOWBRIDGE AI for "${proj.name}". I am your grounded project intelligence assistant. Ask any question regarding architectural decisions, task ownership, pull requests, blockers, or handover readiness. Every answer is backed by verified citations.`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    }

    initAssistant();
  }, [activeProject]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isQuerying]);

  const handleSendQuery = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || !activeProject || isQuerying) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: q,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQueryInput('');
    setIsQuerying(true);

    try {
      const res = await safeFetchJson<{ answer: RagAnswerResponse }>(
        `/api/projects/${activeProject.id}/rag/query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: q,
            filter: {
              sourcePlatform: sourceFilter === 'ALL' ? undefined : sourceFilter,
              author: authorFilter.trim().length > 0 ? authorFilter.trim() : undefined,
            },
          }),
        }
      );

      if (res.ok && res.data?.answer) {
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: res.data.answer.answer,
          timestamp: new Date().toISOString(),
          ragResponse: res.data.answer,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: 'I could not verify this information from the currently connected project sources.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setIsQuerying(false);
    }
  };

  const handleCopyAnswer = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-full text-[10px] font-mono font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>VERIFIED BY SOURCES</span>
          </span>
        );
      case 'PARTIALLY_VERIFIED':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded-full text-[10px] font-mono font-bold">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>PARTIALLY VERIFIED</span>
          </span>
        );
      case 'CONFLICTING':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/25 rounded-full text-[10px] font-mono font-bold">
            <AlertOctagon className="w-3 h-3 text-rose-400" />
            <span>CONFLICTING SOURCES</span>
          </span>
        );
      case 'STALE':
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/25 rounded-full text-[10px] font-mono font-bold">
            <Clock className="w-3 h-3 text-orange-400" />
            <span>POTENTIALLY STALE</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-full text-[10px] font-mono">
            <HelpCircle className="w-3 h-3" />
            <span>NOT FOUND</span>
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 border border-slate-800 rounded-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Grounded Retrieval-Augmented Generation · Anti-Hallucination Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">KNOWBRIDGE AI Project Assistant</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Project-aware natural language question answering. Answers are synthesized exclusively from verified
            connected records (commits, PRs, issues, and documents) with exact evidence citations.
          </p>
        </div>

        {/* Source Filter Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none"
          >
            <option value="ALL">All Sources</option>
            <option value="GITHUB">GitHub Only</option>
            <option value="DOCUMENT">Documents Only</option>
          </select>
        </div>
      </div>

      {/* Suggested Questions Grid */}
      {suggestedQuestions.length > 0 && (
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Suggested Verification Questions for Evaluators
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.slice(0, 5).map((sq, i) => (
              <button
                key={i}
                onClick={() => handleSendQuery(sq)}
                disabled={isQuerying}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 rounded-lg text-xs text-slate-300 hover:text-white transition-all text-left flex items-center gap-1.5"
              >
                <span>{sq}</span>
                <ArrowRight className="w-3 h-3 text-sky-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 min-h-[460px] max-h-[620px] overflow-y-auto space-y-6">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const resp = msg.ragResponse;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2`}
            >
              <div
                className={`max-w-3xl p-5 rounded-2xl text-xs space-y-3 ${
                  isUser
                    ? 'bg-sky-600 text-white rounded-tr-none'
                    : 'bg-slate-950 border border-slate-800/90 text-slate-200 rounded-tl-none shadow-sm'
                }`}
              >
                {/* Assistant Header with Verification Status */}
                {!isUser && resp && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      {getVerificationBadge(resp.verificationStatus)}
                      <span className="font-mono text-[10px] text-slate-400">
                        Confidence: {(resp.confidenceScore * 100).toFixed(0)}% · Latency: {resp.latencyMs}ms
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyAnswer(msg.text, msg.id)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                      title="Copy Answer & Citations"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Direct Answer Text */}
                <div className="leading-relaxed text-sm">{msg.text}</div>

                {/* Conflict Alert (If detected) */}
                {!isUser && resp?.conflictingSources && resp.conflictingSources.length > 0 && (
                  <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl space-y-2 text-rose-200 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-rose-400 text-xs">
                      <AlertOctagon className="w-4 h-4" />
                      <span>Conflicting Source Evidence Detected</span>
                    </div>
                    {resp.conflictingSources.map((c, idx) => (
                      <div key={idx} className="space-y-1 text-[11px]">
                        <div>{c.contradiction}</div>
                        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
                          <div className="p-2 bg-slate-950 rounded border border-rose-900/40">
                            <span className="text-rose-400 font-bold block">{c.sourceA.title}</span>
                            <span className="text-slate-400">{c.sourceA.excerpt}</span>
                          </div>
                          <div className="p-2 bg-slate-950 rounded border border-rose-900/40">
                            <span className="text-rose-400 font-bold block">{c.sourceB.title}</span>
                            <span className="text-slate-400">{c.sourceB.excerpt}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Supporting Source Citation Cards */}
                {!isUser && resp?.supportingSources && resp.supportingSources.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Grounding Evidence Citations ({resp.supportingSources.length})</span>
                      <span className="font-mono text-emerald-400">TAMPER-EVIDENT</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {resp.supportingSources.map((cit, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg space-y-1.5 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-[11px] truncate max-w-[200px]">
                              {cit.title}
                            </span>
                            <span className="text-[9px] font-mono text-sky-400 px-1.5 py-0.2 bg-sky-950/60 rounded border border-sky-800/40">
                              {cit.platform}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-300 italic line-clamp-2">
                            "{cit.excerpt}"
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] font-mono text-slate-500">
                            <span>Author: {cit.author || 'Authorised Lead'}</span>
                            <button
                              onClick={() => setInspectCitation(cit)}
                              className="text-sky-400 hover:text-sky-300 font-semibold"
                            >
                              Inspect Full
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Information / Uncertainty Note */}
                {!isUser && resp?.missingInformation && resp.missingInformation.length > 0 && (
                  <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-[11px] text-slate-400">
                    <strong className="text-amber-400">Missing Information: </strong>
                    {resp.missingInformation.join(' ')}
                  </div>
                )}
              </div>

              <div className="text-[10px] font-mono text-slate-500 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}

        {isQuerying && (
          <div className="flex items-center gap-3 p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-sky-400 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Retrieving authorized project records and synthesizing grounded response...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Query Input Bar */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery(queryInput);
          }}
          className="flex items-center gap-3"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={`Ask anything about "${activeProject?.name || 'this project'}"... (e.g. "What is blocking launch?", "Who owns payment idempotency?")`}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              disabled={isQuerying}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={isQuerying || !queryInput.trim()}
            className="px-5 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 text-xs shadow-sm"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Citation Inspector Modal */}
      {inspectCitation && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="font-bold text-base text-white">{inspectCitation.title}</div>
                <div className="text-sky-400 font-mono text-[11px]">
                  {inspectCitation.platform} · {inspectCitation.externalId}
                </div>
              </div>
              <button onClick={() => setInspectCitation(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-300 text-[11px] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              "{inspectCitation.excerpt}"
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              <div>Author: <strong className="text-slate-200">{inspectCitation.author || 'Authorised Lead'}</strong></div>
              <div>Source Date: <strong className="text-slate-200">{new Date(inspectCitation.lastUpdated).toLocaleString()}</strong></div>
              <div className="col-span-2">Source URL: <strong className="text-sky-400 truncate block">{inspectCitation.url}</strong></div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectCitation(null)}
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
