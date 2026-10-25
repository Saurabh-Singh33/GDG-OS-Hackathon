import { useState, useEffect, useRef } from 'react';
import {
  Code2,
  GitBranch,
  Terminal,
  MessageCircle,
  Search,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  Settings,
  History,
  Trash2,
  Compass,
  Sparkles,
  Plus,
  X,
} from 'lucide-react';
import { parseRepoUrl, fetchReadme, fetchTree, parseIssueUrl, fetchIssue } from './github.js';
import StreamingOutput from './components/StreamingOutput.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import {
  saveSession,
  updateSessionAnswer,
  getAllSessions,
  deleteSession,
  clearAllSessions,
  getLastActiveSession,
  clearLastActiveSession,
} from './db.js';

const DEFAULT_SETTINGS = {
  profileName: 'Saurabh',
  profileRole: 'Open Source Contributor',
  ollamaModel: 'gemma:2b',
  ollamaUrl: 'http://localhost:11434',
  mentorTone: 'beginner',
  theme: 'midnight',
};

const NAV_ITEMS = [
  { id: 'chat', label: 'Mentor Chat', icon: MessageCircle },
  { id: 'repo', label: 'Repo Explainer', icon: Code2 },
  { id: 'issue', label: 'Issue Mentor', icon: GitBranch },
  { id: 'git', label: 'Git Helper', icon: Terminal },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [inputVal, setInputVal] = useState('');
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [savedAnswer, setSavedAnswer] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [ollamaWarning, setOllamaWarning] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const scrollBottomRef = useRef(null);

  // Settings state persisted in localStorage
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('oss_mentor_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Recent sessions list (from IndexedDB / localStorage)
  const [recentQueries, setRecentQueries] = useState([]);

  // Load last active session on initial mount to survive browser refreshes!
  useEffect(() => {
    const lastSession = getLastActiveSession();
    if (lastSession && (lastSession.answer || lastSession.query)) {
      setActiveTab(lastSession.type || 'chat');
      setSubmittedQuery(lastSession.query || '');
      setPrompt(lastSession.prompt || lastSession.query || '');
      setSavedAnswer(lastSession.answer || '');
      setCurrentSessionId(lastSession.id);
    }

    // Load full history list from local database
    async function loadHistory() {
      const sessions = await getAllSessions();
      setRecentQueries(sessions.slice(0, 20));
    }
    loadHistory();
  }, []);

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

  // Scroll to bottom when streaming or error updates in chat view
  useEffect(() => {
    if (prompt || isStreaming) {
      scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [prompt, isStreaming]);

  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('oss_mentor_settings', JSON.stringify(newSettings));
    } catch {
      // Ignore
    }
  };

  const handleDeleteSession = async (id, e) => {
    e.stopPropagation();
    await deleteSession(id);
    setRecentQueries((prev) => prev.filter((item) => item.id !== id));
    if (currentSessionId === id) {
      handleReset();
    }
  };

  const handleClearHistory = async () => {
    await clearAllSessions();
    setRecentQueries([]);
  };

  const handleTabChange = (tabId) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    setInputVal('');
    setPrompt('');
    setSavedAnswer('');
    setCurrentSessionId(null);
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    setSubmittedQuery('');
  };

  const handleReset = () => {
    clearLastActiveSession();
    setInputVal('');
    setPrompt('');
    setSavedAnswer('');
    setCurrentSessionId(null);
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    setSubmittedQuery('');
  };

  const getSystemPrompt = (tab = activeTab) => {
    if (tab === 'chat') {
      return 'You are an encouraging, friendly open-source mentor. Answer beginner questions clearly, warmly, and accurately. You can answer in any language requested (English, Hindi, etc.).';
    }
    if (tab === 'git') {
      return settings.mentorTone === 'concise'
        ? 'You are a terse Git mentor. Answer in 2 sentences max, then give the exact command needed.'
        : 'You are a Git mentor for absolute beginners. Answer in 3 sentences max, then give the exact command they need.';
    }
    return settings.mentorTone === 'concise'
      ? 'You are a direct open-source mentor. Give concise bullet points and direct commands.'
      : 'You are a patient open-source mentor. Explain things for a complete beginner. Never assume they know Git. Be concise and use bullet points.';
  };

  // Main execution logic for all tools including Chat
  const executeQuery = async (queryText, tab = activeTab, forceRegenerate = false) => {
    const trimmed = queryText.trim();
    if (!trimmed || isLoading || isStreaming) return;

    setError(null);
    setPrompt('');
    setSavedAnswer('');
    setIsLoading(true);
    setSubmittedQuery(trimmed);

    const sessionId = Date.now();
    setCurrentSessionId(sessionId);

    try {
      let finalPrompt = '';
      let displayTitle = trimmed;

      if (tab === 'chat') {
        finalPrompt = trimmed;
        displayTitle = trimmed.length > 30 ? trimmed.slice(0, 30) + '...' : trimmed;
        setSystemPrompt(getSystemPrompt('chat'));
      } else if (tab === 'repo') {
        const { owner, repo } = parseRepoUrl(trimmed);
        displayTitle = `${owner}/${repo}`;
        const readme = await fetchReadme(owner, repo);
        let tree = [];
        try {
          tree = await fetchTree(owner, repo);
        } catch {
          // Tree fallback
        }

        const truncatedReadme = readme.slice(0, 3000);
        const fileList = tree.slice(0, 30).join('\n');

        finalPrompt = [
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

        setSystemPrompt(getSystemPrompt('repo'));
      } else if (tab === 'issue') {
        const { owner, repo, number } = parseIssueUrl(trimmed);
        displayTitle = `${owner}/${repo} #${number}`;
        const issue = await fetchIssue(owner, repo, number);

        const labelText =
          issue.labels && issue.labels.length > 0 ? issue.labels.join(', ') : 'None';
        const bodyText = issue.body
          ? issue.body.slice(0, 3000)
          : 'No description provided.';

        finalPrompt = [
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

        setSystemPrompt(getSystemPrompt('issue'));
      } else if (tab === 'git') {
        finalPrompt = trimmed;
        displayTitle = trimmed.slice(0, 35);
        setSystemPrompt(getSystemPrompt('git'));
      }

      setPrompt(finalPrompt);

      // Save initial session to database
      const newSession = {
        id: sessionId,
        type: tab,
        query: trimmed,
        title: displayTitle,
        prompt: finalPrompt,
        answer: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      await saveSession(newSession);

      // Update in-memory recent list
      setRecentQueries((prev) => {
        const filtered = prev.filter((item) => item.query !== trimmed);
        return [newSession, ...filtered].slice(0, 20);
      });

      setIsLoading(false);
      setIsStreaming(true);
      setInputVal('');
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'An error occurred while processing your request.');
    }
  };

  // Called when Ollama streaming finishes: permanently saves the answer to database!
  const handleStreamingDone = async (accumulatedText) => {
    setIsStreaming(false);
    setSavedAnswer(accumulatedText);
    if (currentSessionId) {
      await updateSessionAnswer(currentSessionId, accumulatedText);

      // Sync recent list in-memory state
      setRecentQueries((prev) =>
        prev.map((item) =>
          item.id === currentSessionId ? { ...item, answer: accumulatedText } : item
        )
      );
    }
  };

  const handleRegenerate = () => {
    if (submittedQuery) {
      setSavedAnswer('');
      executeQuery(submittedQuery, activeTab, true);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    executeQuery(inputVal, activeTab);
  };

  const handleSuggestionClick = (sampleText) => {
    setInputVal(sampleText);
    executeQuery(sampleText, activeTab);
  };

  // When clicking a history item: restore saved answer INSTANTLY from database!
  const handleHistorySelect = (item) => {
    setActiveTab(item.type || 'chat');
    setInputVal('');
    setSubmittedQuery(item.query);
    setPrompt(item.prompt || item.query);
    setSavedAnswer(item.answer || '');
    setCurrentSessionId(item.id);
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);

    // Save as last active so refresh also preserves this session
    saveSession(item);
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getPlaceholder = () => {
    switch (activeTab) {
      case 'chat':
        return "Ask anything (e.g. 'What is a Pull Request?', 'Can you explain Git in Hindi?')...";
      case 'repo':
        return 'Enter repository, e.g. facebook/react or https://github.com/facebook/react';
      case 'issue':
        return 'Enter issue URL, e.g. https://github.com/owner/repo/issues/123';
      case 'git':
        return 'Paste your Git error here...';
      default:
        return 'Ask a question or enter a URL...';
    }
  };

  const getSuggestions = () => {
    switch (activeTab) {
      case 'chat':
        return [
          'What is a pull request and how do I open one?',
          'How do open source licenses work?',
          'Can you explain open-source in Hindi?',
        ];
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

  // Filter history by search term
  const filteredHistory = recentQueries.filter((item) => {
    if (!historySearch.trim()) return true;
    const term = historySearch.toLowerCase();
    return (
      item.title?.toLowerCase().includes(term) ||
      item.query?.toLowerCase().includes(term) ||
      item.answer?.toLowerCase().includes(term)
    );
  });

  const isBusy = isLoading || isStreaming;
  // Preserved session check (survives refresh!)
  const hasOutput = Boolean(prompt || isBusy || error || savedAnswer);

  const initials = (settings.profileName || 'S')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleCardClick = (tabId, sampleQuery) => {
    setActiveTab(tabId);
    setInputVal(sampleQuery);
    executeQuery(sampleQuery, tabId);
  };

  return (
    <div
      className={`theme-${settings.theme || 'midnight'} flex h-screen bg-[#0a0d14] text-slate-300 font-sans overflow-hidden antialiased`}
    >
      {/* Left Sidebar */}
      <aside className="w-[270px] bg-[#0e111a]/95 backdrop-blur-xl border-r border-white/[0.08] flex flex-col justify-between flex-shrink-0 h-full select-none z-20 shadow-xl">
        <div className="flex flex-col h-[calc(100%-80px)]">
          {/* Logo Area */}
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="text-white font-bold text-sm tracking-tight block">
                    OSS Mentor
                  </span>
                  <div className="text-[10px] text-slate-400 font-medium tracking-wide">
                    Local Database · Zero Cloud
                  </div>
                </div>
              </div>
            </div>

            {/* "+ New Chat" Button */}
            <button
              type="button"
              onClick={handleReset}
              className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-xs font-medium text-indigo-200 transition-all cursor-pointer shadow-xs group"
              title="Start a new chat or query"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400 group-hover:rotate-90 transition-transform" />
                <span>New Chat</span>
              </div>
              <span className="text-[10px] text-indigo-300/60 font-mono">⌘N</span>
            </button>
          </div>

          {/* Navigation Links (Chat, Repo, Issue, Git) */}
          <nav className="p-2 space-y-1 mt-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.09] text-white border border-white/[0.12] shadow-sm'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Recent History Section with Search */}
          <div className="flex-1 overflow-y-auto px-2 py-2 border-t border-white/[0.06] mt-1 flex flex-col">
            <div className="flex items-center justify-between px-2 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>History ({filteredHistory.length})</span>
              </div>
              {recentQueries.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  title="Clear all saved history"
                  className="hover:text-red-400 transition-colors cursor-pointer text-[10px]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Sidebar Search Input */}
            <div className="relative mb-2 px-1">
              <Search className="w-3 h-3 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history..."
                className="w-full pl-7 pr-6 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500/60 transition-colors"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* History List */}
            {filteredHistory.length === 0 ? (
              <div className="px-2 py-4 text-xs text-slate-500 italic text-center">
                {historySearch ? 'No matches found' : 'No saved conversations'}
              </div>
            ) : (
              <div className="space-y-1 overflow-y-auto flex-1">
                {filteredHistory.map((item) => {
                  const Icon =
                    item.type === 'chat'
                      ? MessageCircle
                      : item.type === 'repo'
                      ? Code2
                      : item.type === 'issue'
                      ? GitBranch
                      : Terminal;
                  const isCurrent = currentSessionId === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleHistorySelect(item)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 text-xs rounded-xl transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isCurrent ? 'text-indigo-400' : 'text-slate-400 group-hover:text-indigo-400'}`} />
                        <span className="truncate text-[11px]">{item.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 transition-opacity cursor-pointer"
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
        <div className="p-3 border-t border-white/[0.06] bg-[#0b0e16]/80">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-white/[0.05] transition-colors">
            {/* User Profile Info */}
            <div
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2.5 cursor-pointer overflow-hidden flex-1"
              title="Click to edit profile & settings"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
                {initials}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-white truncate">
                  {settings.profileName}
                </div>
                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      ollamaWarning ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer flex-shrink-0 ml-1"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-ambient-glow relative">
        {/* Ollama Offline Warning Banner */}
        {ollamaWarning && (
          <div className="w-full px-8 pt-4">
            <div className="max-w-2xl mx-auto rounded-xl p-3 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 text-center flex items-center justify-center gap-2 shadow-sm backdrop-blur-md">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>
                Ollama is unreachable. Start local server with:{' '}
                <code className="font-mono bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                  OLLAMA_ORIGINS=&apos;*&apos; ollama serve
                </code>
              </span>
            </div>
          </div>
        )}

        {/* When hasOutput is FALSE: Centered Landing View */}
        {!hasOutput ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
            {/* Greeting Section */}
            <div className="text-center mb-8 space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-xs font-medium text-slate-300 mb-2">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span>Personal Open-Source Assistant</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Hi {settings.profileName || 'there'},
              </h1>
              <p className="text-base sm:text-lg font-normal text-slate-400 leading-relaxed">
                {activeTab === 'chat'
                  ? 'Ask any question or talk to your personal open-source mentor.'
                  : 'What repository, issue, or Git command are you exploring today?'}
              </p>
            </div>

            {/* Input Form (Centered) */}
            <form onSubmit={handleSubmit} className="w-full max-w-2xl">
              <div className="w-full bg-[#11141c]/90 backdrop-blur-xl border border-white/[0.12] hover:border-white/[0.22] focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-2xl flex items-center p-2.5 shadow-2xl transition-all">
                {activeTab === 'git' ? (
                  <Terminal className="w-4 h-4 text-slate-400 ml-2.5 mr-1 flex-shrink-0 self-start mt-2" />
                ) : activeTab === 'chat' ? (
                  <MessageCircle className="w-4 h-4 text-slate-400 ml-2.5 flex-shrink-0" />
                ) : (
                  <Search className="w-4 h-4 text-slate-400 ml-2.5 flex-shrink-0" />
                )}

                {activeTab === 'git' ? (
                  <textarea
                    rows={2}
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Paste your Git error here..."
                    disabled={isBusy}
                    className="bg-transparent border-none outline-none flex-1 px-3 py-1 text-xs sm:text-sm text-white placeholder-slate-500 resize-none disabled:opacity-50"
                  />
                ) : (
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder={getPlaceholder()}
                    disabled={isBusy}
                    className="bg-transparent border-none outline-none flex-1 px-3.5 text-xs sm:text-sm text-white placeholder-slate-500 disabled:opacity-50"
                  />
                )}

                <button
                  type="submit"
                  disabled={isBusy || !inputVal.trim()}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed p-2.5 rounded-xl transition-all cursor-pointer flex-shrink-0 font-medium shadow-md shadow-indigo-500/25 ml-2"
                  title="Send"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Suggestions */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 text-xs text-slate-400">
                <span className="text-slate-400">Suggestions:</span>
                {getSuggestions().map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.16] transition-colors cursor-pointer truncate max-w-xs text-[11px]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </form>

            {/* Quick Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mt-8">
              <button
                type="button"
                onClick={() => handleCardClick('repo', 'firstcontributions/first-contributions')}
                className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-indigo-500/40 text-left transition-all group cursor-pointer shadow-lg"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-105 transition-transform">
                  <Code2 className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">
                  Explain a Repo
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Deconstruct architectures, tech stacks, and step-by-step setup guides.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCardClick(
                    'issue',
                    'https://github.com/firstcontributions/first-contributions/issues/1'
                  )
                }
                className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-indigo-500/40 text-left transition-all group cursor-pointer shadow-lg"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-105 transition-transform">
                  <GitBranch className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
                  Demystify an Issue
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Break down bug tickets into actionable tasks for first-time contributors.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleCardClick('git', 'fatal: not a git repository')}
                className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-indigo-500/40 text-left transition-all group cursor-pointer shadow-lg"
              >
                <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-3 group-hover:scale-105 transition-transform">
                  <Terminal className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-white group-hover:text-teal-300 transition-colors">
                  Git Command Helper
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Receive 3-sentence answers and the exact shell command you need.
                </p>
              </button>
            </div>
          </div>
        ) : (
          /* ================= CHAT VIEW (Answers Persisted in Database) ================= */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Chat Header Bar */}
            <div className="w-full border-b border-white/[0.06] bg-[#0e111a]/70 backdrop-blur-md px-8 py-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 font-medium border border-indigo-500/30">
                  {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
                </span>
                {submittedQuery && (
                  <span className="truncate max-w-lg text-slate-200 font-mono text-[11px]">
                    {submittedQuery}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/[0.08] transition-colors cursor-pointer border border-white/[0.06] hover:border-white/[0.14]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New Question</span>
              </button>
            </div>

            {/* Scrollable Output Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center">
              {/* User Prompt Query Bubble */}
              {submittedQuery && (
                <div className="w-full max-w-3xl mb-4 flex justify-end">
                  <div className="bg-indigo-600/20 border border-indigo-500/30 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-indigo-100 max-w-xl text-left shadow-md">
                    <p className="font-mono">{submittedQuery}</p>
                  </div>
                </div>
              )}

              {/* Loading Indicator while fetching GitHub data */}
              {isLoading && (
                <div className="w-full max-w-3xl mt-4 p-6 rounded-2xl bg-[#11141c]/90 backdrop-blur-xl border border-white/[0.1] text-center shadow-2xl">
                  <div className="flex items-center justify-center space-x-3 text-slate-300 text-xs">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
                    </span>
                    <span className="font-mono text-slate-200">
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
                <div className="w-full max-w-3xl mt-4 rounded-xl border border-red-500/30 bg-red-500/10 backdrop-blur-md p-4 text-red-300 text-sm text-left shadow-lg">
                  <div className="flex items-center gap-2 font-medium mb-1 text-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span>Error</span>
                  </div>
                  <p className="text-red-300/80 text-xs leading-relaxed">{error}</p>
                </div>
              )}

              {/* Markdown Output Card with Persistent Answer */}
              {prompt && (
                <StreamingOutput
                  prompt={prompt}
                  system={systemPrompt}
                  model={settings.ollamaModel}
                  initialOutput={savedAnswer}
                  onDone={handleStreamingDone}
                  onRegenerate={handleRegenerate}
                />
              )}

              <div ref={scrollBottomRef} />
            </div>

            {/* Bottom Docked Input Form */}
            <div className="w-full border-t border-white/[0.08] bg-[#0c0f17]/90 backdrop-blur-xl p-4 flex justify-center z-10">
              <form onSubmit={handleSubmit} className="w-full max-w-3xl">
                <div className="w-full bg-[#11141c]/90 backdrop-blur-xl border border-white/[0.12] hover:border-white/[0.22] focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-2xl flex items-center p-2 shadow-xl transition-all">
                  {activeTab === 'git' ? (
                    <Terminal className="w-4 h-4 text-slate-400 ml-2.5 mr-1 flex-shrink-0 self-start mt-2" />
                  ) : activeTab === 'chat' ? (
                    <MessageCircle className="w-4 h-4 text-slate-400 ml-2.5 flex-shrink-0" />
                  ) : (
                    <Search className="w-4 h-4 text-slate-400 ml-2.5 flex-shrink-0" />
                  )}

                  {/* Dynamic Input in Chat View */}
                  {activeTab === 'git' ? (
                    <textarea
                      rows={2}
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder="Paste your Git error here..."
                      disabled={isBusy}
                      className="bg-transparent border-none outline-none flex-1 px-3 py-1 text-xs sm:text-sm text-white placeholder-slate-500 resize-none disabled:opacity-50"
                    />
                  ) : (
                    <input
                      type="text"
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      placeholder={getPlaceholder()}
                      disabled={isBusy}
                      className="bg-transparent border-none outline-none flex-1 px-3.5 text-xs sm:text-sm text-white placeholder-slate-500 disabled:opacity-50"
                    />
                  )}

                  <button
                    type="submit"
                    disabled={isBusy || !inputVal.trim()}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed p-2.5 rounded-xl transition-all cursor-pointer flex-shrink-0 font-medium shadow-md shadow-indigo-500/25 ml-2"
                    title="Send"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={saveSettings}
        onClearHistory={handleClearHistory}
        historyCount={recentQueries.length}
      />
    </div>
  );
}
