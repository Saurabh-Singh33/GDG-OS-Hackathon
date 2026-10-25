import { useState, useEffect } from 'react';
import {
  Sparkles,
  Code,
  MessageSquare,
  Terminal,
  Search,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  Settings,
  History,
  Trash2,
} from 'lucide-react';
import { parseRepoUrl, fetchReadme, fetchTree, parseIssueUrl, fetchIssue } from './github.js';
import StreamingOutput from './components/StreamingOutput.jsx';
import SettingsModal from './components/SettingsModal.jsx';

const DEFAULT_SETTINGS = {
  profileName: 'Saurabh',
  profileRole: 'Open Source Contributor',
  ollamaModel: 'gemma:2b',
  ollamaUrl: 'http://localhost:11434',
  mentorTone: 'beginner',
};

const NAV_ITEMS = [
  { id: 'repo', label: 'Repo Explainer', icon: Code },
  { id: 'issue', label: 'Issue Mentor', icon: MessageSquare },
  { id: 'git', label: 'Git Helper', icon: Terminal },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('repo');
  const [inputVal, setInputVal] = useState('');
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [ollamaWarning, setOllamaWarning] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Settings state persisted in localStorage
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('oss_mentor_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // History state persisted in localStorage
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('oss_mentor_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Check Ollama health on mount
  useEffect(() => {
    let isMounted = true;
    async function checkOllama() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const baseUrl = settings.ollamaUrl || 'http://localhost:11434';
        const res = await fetch(`${baseUrl}/api/tags`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (isMounted) {
          setOllamaWarning(!res.ok);
        }
      } catch {
        if (isMounted) {
          setOllamaWarning(true);
        }
      }
    }
    checkOllama();
    return () => {
      isMounted = false;
    };
  }, [settings.ollamaUrl]);

  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('oss_mentor_settings', JSON.stringify(newSettings));
    } catch {
      // Ignore
    }
  };

  const addHistoryItem = (type, query, title) => {
    const newItem = {
      id: Date.now(),
      type,
      query,
      title: title || query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.query !== query);
      const updated = [newItem, ...filtered].slice(0, 15);
      try {
        localStorage.setItem('oss_mentor_history', JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const deleteHistoryItem = (id, e) => {
    e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem('oss_mentor_history', JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('oss_mentor_history');
    } catch {
      // Ignore
    }
  };

  // Reset inputs when switching tabs
  const handleTabChange = (tabId) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    setInputVal('');
    setPrompt('');
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    setSubmittedQuery('');
  };

  const handleReset = () => {
    setInputVal('');
    setPrompt('');
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    setSubmittedQuery('');
  };

  const getSystemPrompt = () => {
    if (activeTab === 'git') {
      return settings.mentorTone === 'concise'
        ? 'You are a terse Git mentor. Answer in 2 sentences max, then give the exact command needed.'
        : 'You are a Git mentor for absolute beginners. Answer in 3 sentences max, then give the exact command they need.';
    }
    return settings.mentorTone === 'concise'
      ? 'You are a direct open-source mentor. Give concise bullet points and direct commands.'
      : 'You are a patient open-source mentor. Explain things for a complete beginner. Never assume they know Git. Be concise and use bullet points.';
  };

  const executeQuery = async (queryText, tab = activeTab) => {
    const trimmed = queryText.trim();
    if (!trimmed || isLoading || isStreaming) return;

    setError(null);
    setPrompt('');
    setIsLoading(true);
    setSubmittedQuery(trimmed);

    try {
      if (tab === 'repo') {
        const { owner, repo } = parseRepoUrl(trimmed);
        const readme = await fetchReadme(owner, repo);
        let tree = [];
        try {
          tree = await fetchTree(owner, repo);
        } catch {
          // Tree fallback
        }

        const truncatedReadme = readme.slice(0, 3000);
        const fileList = tree.slice(0, 30).join('\n');

        const repoPrompt = [
          `Repository: ${owner}/${repo}`,
          '',
          'README Preview:',
          truncatedReadme,
          '',
          fileList ? `Project Files:\n${fileList}\n` : '',
          'Please provide a beginner-friendly explanation of this repository:',
          '- What does this project do in simple terms?',
          '- What programming languages, tools, or tech stack does it use?',
          '- Which key files or directories should a newcomer explore first?',
          '- Clear, beginner-friendly instructions on how to run it locally and make a first contribution.',
        ].join('\n');

        setSystemPrompt(getSystemPrompt());
        setPrompt(repoPrompt);
        addHistoryItem('repo', trimmed, `${owner}/${repo}`);
      } else if (tab === 'issue') {
        const { owner, repo, number } = parseIssueUrl(trimmed);
        const issue = await fetchIssue(owner, repo, number);

        const labelText =
          issue.labels && issue.labels.length > 0 ? issue.labels.join(', ') : 'None';
        const bodyText = issue.body
          ? issue.body.slice(0, 3000)
          : 'No description provided.';

        const issuePrompt = [
          `Repository: ${owner}/${repo}`,
          `Issue #${number}: ${issue.title}`,
          `Labels: ${labelText}`,
          '',
          'Issue Description:',
          bodyText,
          '',
          'Please break down this issue for a beginner:',
          '- What is this issue asking for or reporting in simple English?',
          '- Is this suitable for a beginner or first-time contributor?',
          '- What files, concepts, or tools might be involved?',
          '- What are the step-by-step actions someone should take to solve or test it?',
        ].join('\n');

        setSystemPrompt(getSystemPrompt());
        setPrompt(issuePrompt);
        addHistoryItem('issue', trimmed, `${owner}/${repo} #${number}`);
      } else if (tab === 'git') {
        setSystemPrompt(getSystemPrompt());
        setPrompt(trimmed);
        addHistoryItem('git', trimmed, trimmed.slice(0, 35));
      }

      setIsLoading(false);
      setIsStreaming(true);
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'An error occurred while processing your request.');
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    executeQuery(inputVal, activeTab);
  };

  const handleHistorySelect = (item) => {
    setActiveTab(item.type);
    setInputVal(item.query);
    executeQuery(item.query, item.type);
  };

  // Dynamic placeholder text
  const getPlaceholder = () => {
    switch (activeTab) {
      case 'repo':
        return 'e.g. facebook/react or https://github.com/facebook/react';
      case 'issue':
        return 'Paste issue URL, e.g. https://github.com/owner/repo/issues/123';
      case 'git':
        return "Paste your Git error or ask a question (e.g. 'fatal: not a git repository')...";
      default:
        return 'Enter a prompt or URL...';
    }
  };

  // Quick suggestions based on tab
  const getSuggestions = () => {
    switch (activeTab) {
      case 'repo':
        return [
          'firstcontributions/first-contributions',
          'facebook/react',
          'expressjs/express',
        ];
      case 'issue':
        return ['https://github.com/firstcontributions/first-contributions/issues/1'];
      case 'git':
        return [
          'fatal: not a git repository',
          'How do I undo my last commit?',
          'How do I resolve merge conflicts?',
        ];
      default:
        return [];
    }
  };

  const isBusy = isLoading || isStreaming;
  const hasActiveSession = Boolean(prompt || isBusy || error);

  // User avatar initials
  const initials = (settings.profileName || 'S')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-screen bg-[#0b1120] text-slate-300 font-sans overflow-hidden">
      {/* 2. Left Sidebar */}
      <aside className="w-[260px] bg-[#0f172a] border-r border-[#1e293b] flex flex-col justify-between flex-shrink-0 h-full select-none">
        <div className="flex flex-col h-[calc(100%-80px)]">
          {/* Logo Area */}
          <div className="p-5 border-b border-[#1e293b]/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm shadow-blue-500/20">
                <Sparkles className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <span className="text-white font-bold text-base tracking-tight">
                  OSS Mentor
                </span>
                <div className="text-[10px] text-slate-400 font-medium tracking-wide">
                  100% local · zero APIs
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#1e293b] text-white border-l-2 border-blue-500 shadow-xs'
                      : 'text-slate-400 hover:bg-[#1e293b]/50 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Recent History Section */}
          <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-[#1e293b]/40 mt-1">
            <div className="flex items-center justify-between px-2 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <History className="w-3 h-3 text-slate-400" />
                <span>Recent History</span>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={clearHistory}
                  title="Clear history"
                  className="hover:text-red-400 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="px-2 py-3 text-xs text-slate-500 italic text-center">
                No recent activity
              </div>
            ) : (
              <div className="space-y-1">
                {history.slice(0, 6).map((item) => {
                  const Icon =
                    item.type === 'repo'
                      ? Code
                      : item.type === 'issue'
                      ? MessageSquare
                      : Terminal;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleHistorySelect(item)}
                      className="group flex items-center justify-between px-2.5 py-2 text-xs rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b]/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 flex-shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 transition-opacity"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Profile & Settings Footer in Sidebar */}
        <div className="p-3 border-t border-[#1e293b]/60 bg-[#0c1322]">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-[#1e293b]/40 transition-colors">
            {/* User Profile Info */}
            <div
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2.5 cursor-pointer overflow-hidden flex-1"
              title="Click to edit profile & settings"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                {initials}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-white truncate">
                  {settings.profileName}
                </div>
                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      ollamaWarning ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                  <span>{settings.profileRole}</span>
                </div>
              </div>
            </div>

            {/* Settings Gear Button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b] transition-colors cursor-pointer flex-shrink-0 ml-1"
              title="Open Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 3. Main Content Area */}
      <main
        className={`flex-1 flex flex-col items-center p-8 relative overflow-y-auto ${
          hasActiveSession ? 'justify-start pt-10' : 'justify-center'
        }`}
      >
        {/* Ollama Offline Warning Banner */}
        {ollamaWarning && (
          <div className="w-full max-w-2xl mb-6 rounded-xl p-3 text-sm bg-amber-950/40 border border-amber-800/60 text-amber-300 text-center flex items-center justify-center gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
            <span>
              Ollama doesn&apos;t seem to be running. Start it with:{' '}
              <code className="font-mono bg-amber-900/60 text-amber-200 px-1.5 py-0.5 rounded text-xs">
                OLLAMA_ORIGINS=&apos;*&apos; ollama serve
              </code>
            </span>
          </div>
        )}

        {/* Greeting Section (When no active output) */}
        {!hasActiveSession && (
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight">
              <span className="text-white block">Hi {settings.profileName || 'there'},</span>
              <span className="bg-gradient-to-r from-blue-400 to-teal-300 bg-clip-text text-transparent">
                what would you like to find today?
              </span>
            </h1>
            <p className="text-slate-500 text-sm">
              Use one of the common prompts or enter a GitHub URL to begin
            </p>
          </div>
        )}

        {/* Query Context Pill when session is active */}
        {hasActiveSession && (
          <div className="w-full max-w-3xl flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="px-2 py-0.5 rounded-md bg-[#1e293b] text-blue-400 font-medium">
                {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
              </span>
              {submittedQuery && (
                <span className="truncate max-w-md text-slate-300">
                  {submittedQuery}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-[#1e293b] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New query</span>
            </button>
          </div>
        )}

        {/* Input Area (Pill Container) */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl">
          <div className="w-full bg-[#0f172a] border border-[#1e293b] rounded-2xl flex items-center p-2 shadow-lg focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            <Search className="w-5 h-5 text-slate-500 ml-2.5 flex-shrink-0" />
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={getPlaceholder()}
              disabled={isBusy}
              className="bg-transparent border-none outline-none flex-1 px-3 text-sm text-white placeholder-slate-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isBusy || !inputVal.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed p-2 rounded-xl text-white transition-colors cursor-pointer flex-shrink-0"
              title="Send"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Common Suggestions (Only when idle) */}
          {!hasActiveSession && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs text-slate-500">
              <span>Suggestions:</span>
              {getSuggestions().map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setInputVal(s);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#0f172a] border border-[#1e293b] text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer truncate max-w-xs"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Loading Indicator while fetching GitHub data */}
        {isLoading && (
          <div className="w-full max-w-3xl mt-6 p-6 rounded-2xl bg-[#0f172a] border border-[#1e293b] text-center shadow-lg">
            <div className="flex items-center justify-center space-x-3 text-slate-400 text-sm">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
              </span>
              <span className="font-medium text-slate-300">
                {activeTab === 'repo'
                  ? 'Fetching repository files and README...'
                  : activeTab === 'issue'
                  ? 'Fetching issue details from GitHub...'
                  : 'Preparing response...'}
              </span>
            </div>
          </div>
        )}

        {/* Error Box */}
        {error && (
          <div className="w-full max-w-3xl mt-4 rounded-2xl border border-red-800/60 bg-red-950/40 p-4 text-red-300 text-sm text-left shadow-lg">
            <div className="flex items-center gap-2 font-semibold mb-1 text-red-200">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Error</span>
            </div>
            <p className="text-red-300/90">{error}</p>
          </div>
        )}

        {/* 4. The Output Area */}
        {prompt && (
          <StreamingOutput
            prompt={prompt}
            system={systemPrompt}
            model={settings.ollamaModel}
            onDone={() => setIsStreaming(false)}
          />
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={saveSettings}
        onClearHistory={clearHistory}
        historyCount={history.length}
      />
    </div>
  );
}
