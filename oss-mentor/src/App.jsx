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
  Sun,
  Moon,
  Copy,
  Check,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { parseRepoUrl, fetchReadme, fetchTree, parseIssueUrl, fetchIssue } from './github.js';
import StreamingOutput from './components/StreamingOutput.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import {
  saveSession,
  updateSession,
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
};

const NAV_ITEMS = [
  { id: 'chat', label: 'Mentor Chat', icon: MessageCircle },
  { id: 'repo', label: 'Repo Explainer', icon: Code2 },
  { id: 'issue', label: 'Issue Mentor', icon: GitBranch },
  { id: 'git', label: 'Git Helper', icon: Terminal },
];

export default function App() {
  // Theme state ('dark' or 'light')
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('oss_mentor_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const [activeTab, setActiveTab] = useState('chat');
  const [inputVal, setInputVal] = useState('');
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [ollamaWarning, setOllamaWarning] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Multi-message chat thread state (persisted in database)
  const [messages, setMessages] = useState([]);
  const [repoContext, setRepoContext] = useState(null);
  const [issueContext, setIssueContext] = useState(null);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const repoContextRef = useRef(repoContext);
  useEffect(() => {
    repoContextRef.current = repoContext;
  }, [repoContext]);

  const issueContextRef = useRef(issueContext);
  useEffect(() => {
    issueContextRef.current = issueContext;
  }, [issueContext]);

  const scrollBottomRef = useRef(null);

  // Sync theme with document.documentElement
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('oss_mentor_theme', theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Settings state persisted in localStorage
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('oss_mentor_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Recent sessions list from IndexedDB / localStorage
  const [recentQueries, setRecentQueries] = useState([]);

  // Load last active session on initial mount to survive browser refreshes!
  useEffect(() => {
    const lastSession = getLastActiveSession();
    if (lastSession) {
      setActiveTab(lastSession.type || 'chat');
      setSubmittedQuery(lastSession.query || '');
      setCurrentSessionId(lastSession.id);
      setRepoContext(lastSession.repoContext || null);
      setIssueContext(lastSession.issueContext || null);

      if (Array.isArray(lastSession.messages) && lastSession.messages.length > 0) {
        setMessages(lastSession.messages);
      } else if (lastSession.answer || lastSession.query) {
        // Fallback for older saved format
        setMessages([
          { role: 'user', text: lastSession.query },
          { role: 'assistant', text: lastSession.answer },
        ]);
      }
    }

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

  // Scroll to bottom when new messages arrive or streaming
  useEffect(() => {
    if (messages.length > 0 || isStreaming || isLoading) {
      scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, isLoading]);

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
    setMessages([]);
    setRepoContext(null);
    setIssueContext(null);
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
    setMessages([]);
    setRepoContext(null);
    setIssueContext(null);
    setCurrentSessionId(null);
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    setSubmittedQuery('');
  };

  const getSystemPrompt = (tab = activeTab) => {
    if (tab === 'chat') {
      return 'You are an encouraging, friendly open-source mentor. Answer beginner questions clearly, warmly, and accurately in simple terms. You can answer in any language requested (English, Hindi, etc.).';
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

  /**
   * Main execution logic:
   * Supports BOTH initial URL analysis AND natural-language follow-up questions!
   */
  const executeQuery = async (queryText, tab = activeTab) => {
    const trimmed = queryText.trim();
    if (!trimmed || isLoading || isStreaming) return;

    setError(null);
    setPrompt('');
    setIsLoading(true);
    setSubmittedQuery(trimmed);

    // Append user question to the messages thread using current ref
    const currentMsgs = messagesRef.current || messages;
    const newMessages = [
      ...currentMsgs,
      { role: 'user', text: trimmed, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ];
    setMessages(newMessages);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = Date.now();
      setCurrentSessionId(sessionId);
    }

    try {
      let finalPrompt = '';
      let activeRepo = repoContextRef.current || repoContext;
      let activeIssue = issueContextRef.current || issueContext;

      if (tab === 'repo') {
        // Check if query is a repo URL or a follow-up question
        let isRepoUrl = false;
        let parsed = null;
        try {
          parsed = parseRepoUrl(trimmed);
          isRepoUrl = true;
        } catch {
          isRepoUrl = false;
        }

        if (isRepoUrl && parsed) {
          // New repository provided
          const { owner, repo } = parsed;
          const readme = await fetchReadme(owner, repo);
          let tree = [];
          try {
            tree = await fetchTree(owner, repo);
          } catch {
            // Tree fallback
          }

          const truncatedReadme = readme.slice(0, 3000);
          const fileList = tree.slice(0, 30).join('\n');

          activeRepo = { owner, repo, readme: truncatedReadme, fileList };
          setRepoContext(activeRepo);

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
        } else if (activeRepo) {
          // Follow-up question about the loaded repository!
          const recentThread = (messagesRef.current || messages)
            .slice(-4)
            .map((m) => `${m.role === 'user' ? 'Beginner' : 'Mentor'}: ${m.text}`)
            .join('\n\n');

          finalPrompt = [
            `You are an open-source mentor helping a beginner with the repository "${activeRepo.owner}/${activeRepo.repo}".`,
            `Repository README snippet:`,
            activeRepo.readme.slice(0, 1500),
            '',
            recentThread ? `Previous discussion:\n${recentThread}\n` : '',
            `The beginner asks a follow-up question:`,
            `"${trimmed}"`,
            '',
            `Please answer this follow-up question as an encouraging, patient mentor. Relate their question to this project, provide clear steps, and explain in simple terms without assuming advanced knowledge.`,
          ].filter(Boolean).join('\n');
        } else {
          // General question asked in repo mode without prior repo
          finalPrompt = [
            `You are a patient open-source mentor. A beginner asks:`,
            `"${trimmed}"`,
            '',
            `Please answer their question in an approachable, beginner-friendly way with clear bullet points.`,
          ].join('\n');
        }

        setSystemPrompt(getSystemPrompt('repo'));
      } else if (tab === 'issue') {
        let isIssueUrl = false;
        let parsedIssue = null;
        try {
          parsedIssue = parseIssueUrl(trimmed);
          isIssueUrl = true;
        } catch {
          isIssueUrl = false;
        }

        if (isIssueUrl && parsedIssue) {
          const { owner, repo, number } = parsedIssue;
          const issue = await fetchIssue(owner, repo, number);

          const labelText =
            issue.labels && issue.labels.length > 0 ? issue.labels.join(', ') : 'None';
          const bodyText = issue.body
            ? issue.body.slice(0, 3000)
            : 'No description provided.';

          activeIssue = { owner, repo, number, title: issue.title, labels: labelText, body: bodyText };
          setIssueContext(activeIssue);

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
        } else if (activeIssue) {
          // Follow-up question on the issue
          const recentThread = (messagesRef.current || messages)
            .slice(-4)
            .map((m) => `${m.role === 'user' ? 'Beginner' : 'Mentor'}: ${m.text}`)
            .join('\n\n');

          finalPrompt = [
            `You are an open-source mentor assisting a beginner with issue #${activeIssue.number} (${activeIssue.title}) in repository "${activeIssue.owner}/${activeIssue.repo}".`,
            `Issue details: ${activeIssue.body.slice(0, 1200)}`,
            '',
            recentThread ? `Previous discussion:\n${recentThread}\n` : '',
            `The beginner asks a follow-up question:`,
            `"${trimmed}"`,
            '',
            `Answer their question with step-by-step guidance.`,
          ].filter(Boolean).join('\n');
        } else {
          finalPrompt = [
            `You are a patient open-source mentor. A beginner asks: "${trimmed}".`,
            'Please answer clearly and concisely.',
          ].join('\n');
        }

        setSystemPrompt(getSystemPrompt('issue'));
      } else if (tab === 'git') {
        // Multi-turn context for Git helper
        const contextStr = (messagesRef.current || messages)
          .slice(-3)
          .map((m) => `${m.role === 'user' ? 'User' : 'Mentor'}: ${m.text}`)
          .join('\n\n');
        finalPrompt = contextStr
          ? `Conversation history:\n${contextStr}\n\nUser asks: "${trimmed}"\nAnswer with the exact Git command needed.`
          : trimmed;
        setSystemPrompt(getSystemPrompt('git'));
      } else {
        // 'chat' mode: General open-ended mentor conversation
        const contextStr = (messagesRef.current || messages)
          .slice(-4)
          .map((m) => `${m.role === 'user' ? 'User' : 'Mentor'}: ${m.text}`)
          .join('\n\n');
        finalPrompt = contextStr
          ? `Previous conversation:\n${contextStr}\n\nUser asks: "${trimmed}"\nAnswer helpfully as their open-source mentor.`
          : trimmed;
        setSystemPrompt(getSystemPrompt('chat'));
      }

      setPrompt(finalPrompt);

      // Save session in local database
      const sessionData = {
        id: sessionId,
        type: tab,
        query: currentMsgs.length === 0 ? trimmed : currentMsgs[0].text,
        title: activeRepo ? `${activeRepo.owner}/${activeRepo.repo}` : trimmed.slice(0, 32),
        messages: newMessages,
        repoContext: activeRepo,
        issueContext: activeIssue,
        answer: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      await saveSession(sessionData);

      setRecentQueries((prev) => {
        const filtered = prev.filter((item) => item.id !== sessionId);
        return [sessionData, ...filtered].slice(0, 20);
      });

      setIsLoading(false);
      setIsStreaming(true);
      setInputVal('');
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'An error occurred while processing your request.');
    }
  };

  // Called when Ollama streaming completes: saves assistant answer to thread and database
  const handleStreamingDone = async (accumulatedText) => {
    setIsStreaming(false);
    setPrompt('');

    const currentMsgs = messagesRef.current || messages;
    const updatedMessages = [
      ...currentMsgs,
      {
        role: 'assistant',
        text: accumulatedText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(updatedMessages);

    if (currentSessionId) {
      await updateSession(currentSessionId, {
        messages: updatedMessages,
        answer: accumulatedText,
        repoContext: repoContextRef.current || repoContext,
        issueContext: issueContextRef.current || issueContext,
      });

      setRecentQueries((prev) =>
        prev.map((item) =>
          item.id === currentSessionId
            ? { ...item, messages: updatedMessages, answer: accumulatedText }
            : item
        )
      );
    }
  };

  const handleRegenerate = () => {
    if (submittedQuery) {
      executeQuery(submittedQuery, activeTab);
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

  // When clicking a history item: restore full conversation thread from database!
  const handleHistorySelect = (item) => {
    setActiveTab(item.type || 'chat');
    setInputVal('');
    setSubmittedQuery(item.query);
    setCurrentSessionId(item.id);
    setRepoContext(item.repoContext || null);
    setIssueContext(item.issueContext || null);
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    setPrompt('');

    if (Array.isArray(item.messages) && item.messages.length > 0) {
      setMessages(item.messages);
    } else if (item.answer || item.query) {
      setMessages([
        { role: 'user', text: item.query },
        { role: 'assistant', text: item.answer },
      ]);
    } else {
      setMessages([]);
    }

    saveSession(item);
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopyMessage = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const getPlaceholder = () => {
    if (messages.length > 0) {
      return 'Ask a follow-up question or enter another query...';
    }
    switch (activeTab) {
      case 'chat':
        return "Ask anything (e.g. 'What is a Pull Request?', 'Can you explain in Hindi?')...";
      case 'repo':
        return 'Enter repository... e.g. facebook/react';
      case 'issue':
        return 'Enter issue URL... e.g. https://github.com/owner/repo/issues/123';
      case 'git':
        return 'Paste your Git error here...';
      default:
        return 'Enter a prompt or URL...';
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
  const hasOutput = Boolean(messages.length > 0 || isBusy || error);

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
    <div className="flex h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-200 font-sans overflow-hidden antialiased transition-colors duration-200">
      {/* Left Sidebar */}
      <aside className="w-[270px] bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col justify-between flex-shrink-0 h-full select-none z-20 shadow-xs transition-colors duration-200">
        <div className="flex flex-col h-[calc(100%-76px)]">
          {/* Logo Area */}
          <div className="p-4 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="text-slate-900 dark:text-white font-bold text-sm tracking-tight block">
                    OSS Mentor
                  </span>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium tracking-wide">
                    100% Local · Multi-turn AI
                  </div>
                </div>
              </div>
            </div>

            {/* "+ New Chat" Button */}
            <button
              type="button"
              onClick={handleReset}
              className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-900/40 text-xs font-medium text-indigo-700 dark:text-indigo-300 transition-all cursor-pointer shadow-xs group"
              title="Start a new conversation"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:rotate-90 transition-transform" />
                <span>New Chat</span>
              </div>
              <span className="text-[10px] text-indigo-500/70 dark:text-indigo-400/60 font-mono">⌘N</span>
            </button>
          </div>

          {/* Navigation Links */}
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
                      ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white border border-slate-200/80 dark:border-zinc-700/60 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100/70 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-zinc-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Recent History Section with Search */}
          <div className="flex-1 overflow-y-auto px-2 py-2 border-t border-slate-200 dark:border-zinc-800 mt-1 flex flex-col">
            <div className="flex items-center justify-between px-2 mb-2 text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                <span>Saved Chats ({filteredHistory.length})</span>
              </div>
              {recentQueries.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  title="Clear all saved history"
                  className="hover:text-red-500 transition-colors cursor-pointer text-[10px]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Sidebar Search Input */}
            <div className="relative mb-2 px-1">
              <Search className="w-3 h-3 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history..."
                className="w-full pl-7 pr-6 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[11px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* History List */}
            {filteredHistory.length === 0 ? (
              <div className="px-2 py-4 text-xs text-slate-400 dark:text-zinc-500 italic text-center">
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
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40 font-medium'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Icon
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            isCurrent
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-400 dark:text-zinc-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                          }`}
                        />
                        <span className="truncate text-[11px]">{item.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 transition-opacity cursor-pointer"
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
        <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50">
          <div className="flex items-center justify-between px-2 py-1 rounded-xl">
            {/* User Profile Info */}
            <div
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2.5 cursor-pointer overflow-hidden flex-1"
              title="Click to edit profile & settings"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                {initials}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {settings.profileName}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      ollamaWarning ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                  <span>{settings.profileRole}</span>
                </div>
              </div>
            </div>

            {/* Sun/Moon Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex-shrink-0"
              title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* Settings Gear Button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex-shrink-0 ml-0.5"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-zinc-950 relative transition-colors duration-200">
        {/* Ollama Offline Warning Banner */}
        {ollamaWarning && (
          <div className="w-full px-8 pt-4">
            <div className="max-w-2xl mx-auto rounded-xl p-3 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-center flex items-center justify-center gap-2 shadow-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
              <span>
                Ollama is unreachable. Start local server with:{' '}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                  OLLAMA_ORIGINS=&apos;*&apos; ollama serve
                </code>
              </span>
            </div>
          </div>
        )}

        {/* When hasOutput is FALSE: Centered Landing View */}
        {!hasOutput ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
            {/* Top Sun/Moon Toggle */}
            <div className="absolute top-6 right-6">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-xs"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Dark</span>
                  </>
                )}
              </button>
            </div>

            {/* Greeting Section */}
            <div className="text-center mb-8 space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/40 text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                <Compass className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Beginner Open-Source Mentor</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                Hi {settings.profileName || 'there'},
              </h1>
              <p className="text-base sm:text-lg font-normal text-slate-500 dark:text-zinc-400 leading-relaxed">
                {activeTab === 'chat'
                  ? 'Ask any question or talk to your personal open-source mentor.'
                  : 'What repository, issue, or Git command are you exploring today?'}
              </p>
            </div>

            {/* Input Form (Landing Page) */}
            <form onSubmit={handleSubmit} className="w-full max-w-2xl">
              <div className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-2xl flex items-center p-2.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-all">
                {activeTab === 'git' ? (
                  <Terminal className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2.5 mr-1 flex-shrink-0 self-start mt-2" />
                ) : activeTab === 'chat' ? (
                  <MessageCircle className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2.5 flex-shrink-0" />
                ) : (
                  <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2.5 flex-shrink-0" />
                )}

                {activeTab === 'git' ? (
                  <textarea
                    rows={2}
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Paste your Git error here..."
                    disabled={isBusy}
                    className="bg-transparent border-none outline-none flex-1 px-3 py-1 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none disabled:opacity-50"
                  />
                ) : (
                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder={getPlaceholder()}
                    disabled={isBusy}
                    className="bg-transparent border-none outline-none flex-1 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 disabled:opacity-50"
                  />
                )}

                <button
                  type="submit"
                  disabled={isBusy || !inputVal.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed p-2.5 rounded-xl transition-all cursor-pointer flex-shrink-0 font-medium shadow-xs ml-2"
                  title="Send"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Suggestions */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 text-xs text-slate-500 dark:text-zinc-400">
                <span className="text-slate-400 dark:text-zinc-500">Suggestions:</span>
                {getSuggestions().map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer truncate max-w-xs text-[11px] shadow-xs"
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
                className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:bg-zinc-800/50 shadow-xs hover:shadow-md text-left transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Code2 className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                  Explain a Repo
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
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
                className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:bg-zinc-800/50 shadow-xs hover:shadow-md text-left transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <GitBranch className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                  Demystify an Issue
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Break down bug tickets into actionable tasks for first-time contributors.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleCardClick('git', 'fatal: not a git repository')}
                className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:bg-zinc-800/50 shadow-xs hover:shadow-md text-left transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Terminal className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                  Git Command Helper
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Receive 3-sentence answers and the exact shell command you need.
                </p>
              </button>
            </div>
          </div>
        ) : (
          /* ================= MULTI-TURN CHAT VIEW ================= */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Chat Header Bar */}
            <div className="w-full border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md px-6 py-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-zinc-300">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-900/40">
                  {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
                </span>
                {repoContext ? (
                  <span className="truncate max-w-sm text-slate-900 dark:text-zinc-200 font-mono text-[11px]">
                    Project: {repoContext.owner}/{repoContext.repo}
                  </span>
                ) : issueContext ? (
                  <span className="truncate max-w-sm text-slate-900 dark:text-zinc-200 font-mono text-[11px]">
                    Issue #{issueContext.number}: {issueContext.title}
                  </span>
                ) : submittedQuery ? (
                  <span className="truncate max-w-sm text-slate-900 dark:text-zinc-200 font-mono text-[11px]">
                    {submittedQuery}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
                >
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-indigo-600" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer border border-slate-200 dark:border-zinc-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>New Chat</span>
                </button>
              </div>
            </div>

            {/* Scrollable Message Thread */}
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center">
              {/* Completed Message History */}
              {messages.map((msg, idx) => (
                msg.role === 'user' ? (
                  <div key={idx} className="w-full max-w-3xl mb-4 flex justify-end">
                    <div className="bg-indigo-600 text-white rounded-2xl px-4 py-2.5 text-xs sm:text-sm max-w-xl text-left shadow-xs">
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ) : (
                  <div key={idx} className="w-full max-w-3xl mb-6 space-y-2">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 text-left shadow-xs dark:shadow-2xl w-full">
                      <div className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-zinc-200 leading-relaxed">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {msg.timestamp || 'Saved'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.text, idx)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700/60 rounded-lg transition-all cursor-pointer shadow-xs"
                      >
                        {copiedId === idx ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              ))}

              {/* GitHub Data Loading Indicator */}
              {isLoading && (
                <div className="w-full max-w-3xl mt-2 mb-4 p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center shadow-xs">
                  <div className="flex items-center justify-center space-x-3 text-slate-600 dark:text-zinc-300 text-xs">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600" />
                    </span>
                    <span className="font-mono text-slate-700 dark:text-zinc-200">
                      {activeTab === 'repo'
                        ? 'Fetching repository files and README...'
                        : activeTab === 'issue'
                        ? 'Fetching issue details from GitHub...'
                        : 'Thinking...'}
                    </span>
                  </div>
                </div>
              )}

              {/* Error Box */}
              {error && (
                <div className="w-full max-w-3xl mt-2 mb-4 rounded-xl border border-red-300 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 text-red-700 dark:text-red-300 text-sm text-left shadow-xs">
                  <div className="flex items-center gap-2 font-medium mb-1 text-red-800 dark:text-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>Notice</span>
                  </div>
                  <p className="text-red-600 dark:text-red-300/80 text-xs leading-relaxed">{error}</p>
                </div>
              )}

              {/* Currently Streaming Message */}
              {prompt && (
                <StreamingOutput
                  prompt={prompt}
                  system={systemPrompt}
                  model={settings.ollamaModel}
                  onDone={handleStreamingDone}
                  onRegenerate={handleRegenerate}
                />
              )}

              <div ref={scrollBottomRef} />
            </div>

            {/* Bottom Docked Input Form for Follow-up Questions */}
            <div className="w-full border-t border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md p-4 flex justify-center z-10">
              <form onSubmit={handleSubmit} className="w-full max-w-3xl">
                <div className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-2xl flex items-center p-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-all">
                  {activeTab === 'git' ? (
                    <Terminal className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2.5 mr-1 flex-shrink-0 self-start mt-2" />
                  ) : activeTab === 'chat' ? (
                    <MessageCircle className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2.5 flex-shrink-0" />
                  ) : (
                    <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2.5 flex-shrink-0" />
                  )}

                  {activeTab === 'git' ? (
                    <textarea
                      rows={2}
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder={getPlaceholder()}
                      disabled={isBusy}
                      className="bg-transparent border-none outline-none flex-1 px-3 py-1 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 resize-none disabled:opacity-50"
                    />
                  ) : (
                    <input
                      type="text"
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      placeholder={getPlaceholder()}
                      disabled={isBusy}
                      className="bg-transparent border-none outline-none flex-1 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 disabled:opacity-50"
                    />
                  )}

                  <button
                    type="submit"
                    disabled={isBusy || !inputVal.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed p-2.5 rounded-xl transition-all cursor-pointer flex-shrink-0 font-medium shadow-xs ml-2"
                    title="Send follow-up question"
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
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}
