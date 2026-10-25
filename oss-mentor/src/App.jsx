import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  FolderGit2,
  GitPullRequest,
  Terminal,
  MessageSquareCode,
  Search,
  SendHorizontal,
  RotateCcw,
  AlertCircle,
  Settings,
  History,
  Trash2,
  Compass,
  Sparkles,
  BrainCircuit,
  Plus,
  X,
  Sun,
  Moon,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Download,
  FileCode2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import {
  parseRepoUrl,
  fetchReadme,
  fetchTree,
  fetchContributing,
  parseIssueUrl,
  fetchIssue,
} from './github.js';
import { streamOllama } from './ollama.js';
import SettingsModal from './components/SettingsModal.jsx';
import MermaidDiagram from './components/MermaidDiagram.jsx';
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
  { id: 'chat', label: 'Mentor Chat', icon: MessageSquareCode },
  { id: 'repo', label: 'Repo Explainer', icon: FolderGit2 },
  { id: 'issue', label: 'Issue Mentor', icon: GitPullRequest },
  { id: 'git', label: 'Git Helper', icon: Terminal },
];

/**
 * Memoized Chat Message Item
 * Prevents re-rendering message bubbles and unmounting child components (like Mermaid diagrams)
 * when the user types in the input box.
 */
const ChatMessageItem = memo(function ChatMessageItem({
  msg,
  idx,
  isLast,
  isStreaming,
  initials,
  ollamaModel,
  markdownComponents,
  speakingId,
  copiedId,
  onRegenerate,
  onSpeak,
  onCopy,
}) {
  const isSkillDocument = Boolean(
    msg.text &&
      (msg.text.includes('Agent Skill Guide') ||
        msg.text.includes('SKILL.md') ||
        msg.text.includes('## 1. Project Overview & Architecture') ||
        msg.isSkill)
  );

  const handleDownloadSkillMd = (text) => {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SKILL.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (msg.role === 'user') {
    return (
      <div className="w-full mb-6 flex justify-end items-end gap-3 px-2 sm:px-4 lg:px-6">
        <div className="flex flex-col items-end max-w-2xl lg:max-w-3xl xl:max-w-4xl">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl rounded-tr-sm px-4.5 py-3 text-xs sm:text-sm text-left shadow-sm shadow-indigo-500/10 leading-relaxed font-normal">
            <p className="whitespace-pre-wrap">{msg.text}</p>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 mr-1">
            {msg.timestamp || 'You'}
          </span>
        </div>
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0 shadow-xs mb-4">
          {initials}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mb-6 flex items-start gap-3.5 px-2 sm:px-4 lg:px-6">
      {/* Sleek Lucide Sparkles AI Mentor Avatar */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs shadow-indigo-500/25 flex-shrink-0 mt-0.5 border border-indigo-400/20">
        <Sparkles className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 space-y-2 min-w-0 w-full">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800/90 rounded-2xl p-5 sm:p-7 text-left shadow-xs dark:shadow-2xl w-full transition-colors">
          {/* Refined Assistant Sub-header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200 tracking-tight">
                OSS Mentor
              </span>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/40">
                {ollamaModel || 'gemma:2b'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
              {msg.timestamp || 'Just now'}
            </span>
          </div>

          {/* Placeholder Thinking... Indicator */}
          {msg.isThinking && !msg.text ? (
            <div className="flex items-center gap-3.5 py-3 px-1">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex-shrink-0 shadow-2xs">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                </span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100 tracking-wide">
                    OSS Mentor is thinking...
                  </span>
                  <div className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-400 animate-bounce" />
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal mt-0.5">
                  {msg.statusText && msg.statusText !== 'Thinking...' && msg.statusText !== 'OSS Mentor is thinking...'
                    ? msg.statusText
                    : 'Analyzing open-source context & preparing guidance...'}
                </span>
              </div>
            </div>
          ) : (
            /* Markdown Output with prose & prose-invert */
            <div className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-zinc-200 leading-relaxed text-sm">
              <ReactMarkdown components={markdownComponents}>
                {msg.text}
              </ReactMarkdown>

              {/* Streaming Active Pulse Indicator */}
              {msg.isStreaming && (
                <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 text-[11px] mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
                  <span>OSS Mentor is generating response...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action bar (Timestamp, Saved badge, Download SKILL.md, Regenerate, Speak, Copy) */}
        {!msg.isThinking && msg.text && (
          <div className="flex items-center justify-between px-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                {msg.timestamp || 'Saved'}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-700" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Saved in local DB
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Download SKILL.md Button if content is an Agent Skill Guide */}
              {isSkillDocument && !msg.isStreaming && (
                <button
                  type="button"
                  onClick={() => handleDownloadSkillMd(msg.text)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-300/80 dark:border-emerald-800/80 rounded-lg transition-all cursor-pointer shadow-xs"
                  title="Download as SKILL.md for AI coding agents"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Download SKILL.md</span>
                </button>
              )}

              {/* Regenerate Button on last message */}
              {isLast && !isStreaming && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700/60 rounded-lg transition-all cursor-pointer shadow-xs"
                  title="Regenerate this response"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </button>
              )}

              {/* Speak Button (Offline Web Speech API) */}
              <button
                type="button"
                onClick={() => onSpeak(msg.text, idx)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700/60 rounded-lg transition-all cursor-pointer shadow-xs"
                title={speakingId === idx ? 'Stop speaking' : 'Read aloud with browser TTS'}
              >
                {speakingId === idx ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                    <span className="text-indigo-600 dark:text-indigo-400">Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                    <span>Speak</span>
                  </>
                )}
              </button>

              {/* Copy Button */}
              <button
                type="button"
                onClick={() => onCopy(msg.text, idx)}
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
        )}
      </div>
    </div>
  );
});

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
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [ollamaWarning, setOllamaWarning] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);

  // Clean up any ongoing TTS speech when component unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
    setMessages([]);
    setRepoContext(null);
    setIssueContext(null);
    setCurrentSessionId(null);
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    setSubmittedQuery('');
  };

  const MERMAID_INSTRUCTION =
    'When generating a Mermaid diagram (using ```mermaid with "graph TD"): ALWAYS use meaningful, concrete action names describing the exact developer step (for example: A["1. Create Branch: git checkout -b feat"] --> B["2. Make Code Changes & Test"] --> C["3. Stage: git add ."] --> D["4. Commit: git commit -m \'feat: ...\'"] --> E["5. Push: git push -u origin feat"] --> F["6. Open Pull Request"]). CRITICAL: NEVER use generic placeholders like "Step 1", "Step 2", "Process", or "Action". Node labels MUST clearly explain the real Git or open-source action and command. Always quote labels inside brackets (e.g. A["Action Name"]).';

  const getSystemPrompt = (tab = activeTab) => {
    if (tab === 'chat') {
      return `You are an encouraging, expert open-source mentor. Answer beginner questions clearly, warmly, and accurately with real examples and exact shell commands. When explaining workflows, describe real developer actions—never use generic placeholders like "Step 1" or "Step 2". You can answer in any language requested (English, Hindi, etc.). ${MERMAID_INSTRUCTION}`;
    }
    if (tab === 'git') {
      return `You are an expert Git mentor for open-source contributors. Explain the exact solution with real Git commands and clear, descriptive stages (e.g. "Stage files with git add", "Commit changes with git commit", "Push branch with git push"). Never use generic dummy placeholders like "Step 1" or "Step 2". Always show the real developer commands. ${MERMAID_INSTRUCTION}`;
    }
    if (tab === 'issue') {
      return `You are an open-source triage mentor. Break down the issue into actionable engineering tasks with concrete file names, reproduction steps, and test commands. Never use generic placeholder steps like "Step 1" or "Step 2". ${MERMAID_INSTRUCTION}`;
    }
    return `You are a patient open-source mentor. Explain things for beginners with concrete, specific instructions. Outline the exact setup commands and contribution workflow. Never use generic placeholders like "Step 1" or "Step 2" — always state the actual action. ${MERMAID_INSTRUCTION}`;
  };

  const handleSpeakMessage = useCallback((text, id) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean text: strip markdown symbols and diagram code blocks for natural speech
    const cleanText = text
      .replace(/```mermaid[\s\S]*?```/gi, ' [Visual workflow diagram omitted] ')
      .replace(/```[\s\S]*?```/g, ' [Code block omitted] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#*_~>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }, [speakingId]);

  /**
   * Main execution logic:
   * 1. Immediately appends user prompt
   * 2. Immediately appends AI Thinking... placeholder
   * 3. Streams Ollama chunks directly into message thread
   * 4. Persists complete chat history to IndexedDB & localStorage
   */
  const executeQuery = async (queryText, tab = activeTab, baseMessages = null, subMode = 'explain') => {
    const trimmed = queryText.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    setInputVal('');
    setSubmittedQuery(trimmed);

    const isSkillMode = subMode === 'skill' || /skill\.md|generate skill/i.test(trimmed);

    // 1. Immediately append user's message to chat history
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: isSkillMode && !trimmed.toLowerCase().includes('skill') ? `${trimmed} (Generate SKILL.md)` : trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // 2. Immediately append placeholder AI message bubble that says "Thinking..."
    const aiMsgId = `assistant-${Date.now() + 1}`;
    const aiPlaceholder = {
      id: aiMsgId,
      role: 'assistant',
      text: '',
      isThinking: true,
      isSkill: isSkillMode,
      statusText: isSkillMode
        ? 'Analyzing repo tree, README & CONTRIBUTING.md...'
        : 'OSS Mentor is thinking...',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentMsgs = baseMessages || messagesRef.current || messages;
    const initialThread = [...currentMsgs, userMsg, aiPlaceholder];
    setMessages(initialThread);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = Date.now();
      setCurrentSessionId(sessionId);
    }

    setIsStreaming(true);

    try {
      let finalPrompt = '';
      let sysPrompt = '';
      let activeRepo = repoContextRef.current || repoContext;
      let activeIssue = issueContextRef.current || issueContext;

      if (tab === 'repo') {
        const repoCleanStr = trimmed.replace(/\s*\(Generate SKILL\.md\)$/i, '');
        let isRepoUrl = false;
        let parsed = null;
        try {
          parsed = parseRepoUrl(repoCleanStr);
          isRepoUrl = true;
        } catch {
          isRepoUrl = false;
        }

        if (isRepoUrl && parsed) {
          // Update placeholder status while fetching repository from GitHub
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    statusText: isSkillMode
                      ? 'Fetching README, file tree & CONTRIBUTING.md...'
                      : 'Fetching repository files and README...',
                  }
                : m
            )
          );

          const { owner, repo } = parsed;
          const [readme, tree, contributing] = await Promise.all([
            fetchReadme(owner, repo),
            fetchTree(owner, repo).catch(() => []),
            fetchContributing(owner, repo),
          ]);

          const truncatedReadme = (readme || '').slice(0, 3000);
          const fileList = tree.slice(0, 40).join('\n');
          const contributingText = (contributing || '').slice(0, 3000);

          activeRepo = { owner, repo, readme: truncatedReadme, fileList, contributing: contributingText };
          setRepoContext(activeRepo);

          if (isSkillMode) {
            sysPrompt =
              'You are an expert open-source maintainer creating a SKILL.md file for AI coding agents (like Cline, Cursor, or Copilot). This file must be highly structured, using Markdown headers, so that an AI agent can instantly understand the project, its tech stack, and exactly how to contribute without making mistakes.';

            finalPrompt = [
              `Create a complete, production-ready SKILL.md file for the GitHub repository: "${owner}/${repo}".`,
              '',
              'Repository File Tree (top files/directories):',
              fileList || 'None listed',
              '',
              'README.md Content Preview:',
              truncatedReadme || 'No README provided',
              '',
              'CONTRIBUTING.md Guidelines:',
              contributingText || 'No CONTRIBUTING.md found in repository root.',
              '',
              'Format the output strictly as a Markdown document with the following sections:',
              '# [Repository Name] - Agent Skill Guide',
              '## 1. Project Overview & Architecture',
              'Explain the core purpose, system architecture, and mental model of the codebase.',
              '## 2. Tech Stack & Dependencies',
              'List all core languages, frameworks, runtime requirements, package managers, and key libraries.',
              '## 3. Directory Structure & Key Files',
              'Map out the critical directories, configuration files, and entry points.',
              '## 4. Local Development & Setup Workflow',
              'Give the exact commands to clone, install dependencies, configure environment variables, and run locally.',
              '## 5. Testing, Linting & Build Commands',
              'Provide the exact commands for running test suites, formatters, and production builds.',
              '## 6. Contribution Guidelines for AI Agents',
              'Rules for branch naming, commit messages, PR requirements, coding conventions, and critical gotchas/pitfalls to avoid.',
            ].join('\n');
          } else {
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

            sysPrompt = getSystemPrompt('repo');
          }
        } else if (activeRepo) {
          if (isSkillMode) {
            sysPrompt =
              'You are an expert open-source maintainer creating a SKILL.md file for AI coding agents (like Cline, Cursor, or Copilot). This file must be highly structured, using Markdown headers, so that an AI agent can instantly understand the project, its tech stack, and exactly how to contribute without making mistakes.';

            finalPrompt = [
              `Create a complete, production-ready SKILL.md file for the GitHub repository: "${activeRepo.owner}/${activeRepo.repo}".`,
              '',
              'Repository File Tree (top files/directories):',
              activeRepo.fileList || 'None listed',
              '',
              'README.md Content Preview:',
              activeRepo.readme || 'No README provided',
              '',
              'CONTRIBUTING.md Guidelines:',
              activeRepo.contributing || 'No CONTRIBUTING.md found in repository root.',
              '',
              'Format the output strictly as a Markdown document with the following sections:',
              '# [Repository Name] - Agent Skill Guide',
              '## 1. Project Overview & Architecture',
              'Explain the core purpose, system architecture, and mental model of the codebase.',
              '## 2. Tech Stack & Dependencies',
              'List all core languages, frameworks, runtime requirements, package managers, and key libraries.',
              '## 3. Directory Structure & Key Files',
              'Map out the critical directories, configuration files, and entry points.',
              '## 4. Local Development & Setup Workflow',
              'Give the exact commands to clone, install dependencies, configure environment variables, and run locally.',
              '## 5. Testing, Linting & Build Commands',
              'Provide the exact commands for running test suites, formatters, and production builds.',
              '## 6. Contribution Guidelines for AI Agents',
              'Rules for branch naming, commit messages, PR requirements, coding conventions, and critical gotchas/pitfalls to avoid.',
            ].join('\n');
          } else {
            const recentThread = currentMsgs
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

            sysPrompt = getSystemPrompt('repo');
          }
        } else {
          finalPrompt = [
            `You are a patient open-source mentor. A beginner asks:`,
            `"${trimmed}"`,
            '',
            `Please answer their question in an approachable, beginner-friendly way with clear bullet points.`,
          ].join('\n');

          sysPrompt = getSystemPrompt('repo');
        }
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
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, statusText: 'Fetching issue details from GitHub...' } : m
            )
          );

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
          const recentThread = currentMsgs
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

        sysPrompt = getSystemPrompt('issue');
      } else if (tab === 'git') {
        const contextStr = currentMsgs
          .slice(-3)
          .map((m) => `${m.role === 'user' ? 'User' : 'Mentor'}: ${m.text}`)
          .join('\n\n');
        finalPrompt = contextStr
          ? `Conversation history:\n${contextStr}\n\nUser asks: "${trimmed}"\nAnswer with clear, step-by-step guidance and exact shell commands. If providing a workflow or flowchart, describe real, concrete Git steps (never use generic "Step 1", "Step 2" placeholders).`
          : `${trimmed}\n\n(Explain clearly with exact Git commands. If showing a process or flowchart, use meaningful, descriptive action labels rather than generic "Step 1" or "Step 2" placeholders.)`;
        sysPrompt = getSystemPrompt('git');
      } else {
        // 'chat' mode: General open-ended mentor conversation with multi-turn memory
        const contextStr = currentMsgs
          .slice(-6)
          .map((m) => `${m.role === 'user' ? 'User' : 'Mentor'}: ${m.text}`)
          .join('\n\n');
        finalPrompt = contextStr
          ? `Previous conversation:\n${contextStr}\n\nUser asks: "${trimmed}"\nAnswer helpfully as their open-source mentor.`
          : trimmed;
        sysPrompt = getSystemPrompt('chat');
      }

      // Update placeholder status text to OSS Mentor is thinking...
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, statusText: 'OSS Mentor is thinking...' } : m
        )
      );

      // 3. Trigger streamOllama directly
      const stream = streamOllama(
        settings.ollamaModel || 'gemma:2b',
        finalPrompt,
        sysPrompt,
        settings.ollamaUrl || 'http://localhost:11434'
      );

      let accumulated = '';
      // 4. As text streams in, replace the Thinking... placeholder with Markdown output
      for await (const chunk of stream) {
        accumulated += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  text: accumulated,
                  isThinking: false,
                  isStreaming: true,
                }
              : m
          )
        );
      }

      // Streaming finished: finalize message
      const finalized = (messagesRef.current || []).map((m) =>
        m.id === aiMsgId
          ? {
              ...m,
              text: accumulated,
              isThinking: false,
              isStreaming: false,
            }
          : m
      );
      setMessages(finalized);
      setIsStreaming(false);

      // 5. Store history of every chat in local database (IndexedDB + localStorage)
      const sessionData = {
        id: sessionId,
        type: tab,
        query: currentMsgs.length === 0 ? trimmed : currentMsgs[0].text,
        title: activeRepo ? `${activeRepo.owner}/${activeRepo.repo}` : (currentMsgs[0]?.text || trimmed).slice(0, 32),
        messages: finalized,
        repoContext: activeRepo,
        issueContext: activeIssue,
        answer: accumulated,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        updatedAt: Date.now(),
      };

      await saveSession(sessionData);

      setRecentQueries((prev) => {
        const filtered = prev.filter((item) => item.id !== sessionId);
        return [sessionData, ...filtered].slice(0, 20);
      });
    } catch (err) {
      setIsStreaming(false);
      setOllamaWarning(true);
      const errorMsg = `⚠️ **Could not reach Ollama.**\n\nMake sure your local Ollama server is running with CORS enabled:\n\`\`\`powershell\n$env:OLLAMA_ORIGINS="*" ; ollama serve\n\`\`\`\n*Model requested:* \`${settings.ollamaModel || 'gemma:2b'}\`\n\n*Error details:* ${err.message || 'Connection refused'}`;

      const errorThread = (messagesRef.current || []).map((m) =>
        m.id === aiMsgId
          ? {
              ...m,
              text: errorMsg,
              isThinking: false,
              isStreaming: false,
              isError: true,
            }
          : m
      );
      setMessages(errorThread);
      setError(err.message || 'Could not reach Ollama.');

      if (sessionId) {
        await updateSession(sessionId, {
          messages: errorThread,
          answer: errorMsg,
        });
      }
    }
  };

  const handleRegenerate = useCallback(() => {
    if (isStreaming) return;
    const currentMsgs = messagesRef.current || messages;
    const lastUserIdx = [...currentMsgs].map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx !== -1) {
      const lastUserQuery = currentMsgs[lastUserIdx].text;
      const historyBefore = currentMsgs.slice(0, lastUserIdx);
      executeQuery(lastUserQuery, activeTab, historyBefore);
    }
  }, [isStreaming, activeTab, messages]);

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

  const handleCopyMessage = useCallback(async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  }, []);

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

  /**
   * Memoize ReactMarkdown components configuration based on `theme`.
   * Passing an inline object causes ReactMarkdown to unmount & remount child components
   * on every keystroke, which causes MermaidDiagram to destroy and shake the screen.
   */
  const markdownComponents = useMemo(
    () => ({
      pre({ children, ...props }) {
        const child = Array.isArray(children) ? children[0] : children;
        if (child && child.props && /language-mermaid/.test(child.props.className || '')) {
          const code = String(child.props.children || '').replace(/\n$/, '');
          return <MermaidDiagram chart={code} isDark={theme === 'dark'} />;
        }
        return (
          <pre
            className="p-3.5 my-3 overflow-x-auto rounded-xl bg-slate-100 dark:bg-zinc-800/80 text-xs font-mono text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700/60"
            {...props}
          >
            {children}
          </pre>
        );
      },
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        if (match && match[1] === 'mermaid') {
          return (
            <MermaidDiagram
              chart={String(children).replace(/\n$/, '')}
              isDark={theme === 'dark'}
            />
          );
        }
        return (
          <code
            className={`${className || ''} px-1.5 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400`}
            {...props}
          >
            {children}
          </code>
        );
      },
    }),
    [theme]
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-200 font-sans overflow-hidden antialiased transition-colors duration-200">
      {/* Left Sidebar */}
      <aside className="w-[270px] bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col justify-between flex-shrink-0 h-full select-none z-20 shadow-xs transition-colors duration-200">
        <div className="flex flex-col h-[calc(100%-76px)]">
          {/* Logo Area */}
          <div className="p-4 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-xs">
                  <BrainCircuit className="w-4.5 h-4.5 text-white" />
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
                      ? MessageSquareCode
                      : item.type === 'repo'
                      ? FolderGit2
                      : item.type === 'issue'
                      ? GitPullRequest
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
            <div className="text-center mb-8 space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/40 text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
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
            <form onSubmit={handleSubmit} className="w-full max-w-3xl xl:max-w-4xl">
              <div className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-2xl flex items-center p-2.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-colors">
                {activeTab === 'git' ? (
                  <Terminal className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2.5 mr-1 flex-shrink-0 self-start mt-2" />
                ) : activeTab === 'chat' ? (
                  <MessageSquareCode className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2.5 flex-shrink-0" />
                ) : activeTab === 'repo' ? (
                  <FolderGit2 className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2.5 flex-shrink-0" />
                ) : (
                  <GitPullRequest className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2.5 flex-shrink-0" />
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

                {activeTab === 'repo' ? (
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => executeQuery(inputVal, 'repo', null, 'explain')}
                      disabled={isBusy || !inputVal.trim()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all cursor-pointer shadow-xs"
                      title="Explain Repository for Beginners"
                    >
                      <FolderGit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Explain Repo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => executeQuery(inputVal, 'repo', null, 'skill')}
                      disabled={isBusy || !inputVal.trim()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800/80 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all cursor-pointer shadow-xs"
                      title="Generate SKILL.md for AI coding agents"
                    >
                      <FileCode2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span className="hidden sm:inline">Generate SKILL.md for AI Agents</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={isBusy || !inputVal.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed p-2.5 rounded-xl transition-all cursor-pointer flex-shrink-0 font-medium shadow-xs ml-2"
                    title="Send"
                  >
                    <SendHorizontal className="w-4 h-4" />
                  </button>
                )}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full max-w-3xl xl:max-w-4xl mt-8">
              <button
                type="button"
                onClick={() => handleCardClick('repo', 'firstcontributions/first-contributions')}
                className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:bg-zinc-800/50 shadow-xs hover:shadow-md text-left transition-all group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <FolderGit2 className="w-4 h-4" />
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
                  <GitPullRequest className="w-4 h-4" />
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
          <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
            {/* Chat Header Bar */}
            <div className="w-full border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between z-10 flex-shrink-0">
              <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-zinc-300">
                {(() => {
                  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab);
                  const NavIcon = activeNav?.icon || MessageSquareCode;
                  return (
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/70 dark:border-indigo-900/50 flex items-center gap-1.5 shadow-2xs">
                      <NavIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{activeNav?.label}</span>
                    </span>
                  );
                })()}
                <span className="text-slate-300 dark:text-zinc-700">·</span>
                <span className="truncate max-w-sm lg:max-w-xl xl:max-w-2xl text-slate-700 dark:text-zinc-300 font-medium text-xs">
                  {repoContext
                    ? `${repoContext.owner}/${repoContext.repo}`
                    : issueContext
                    ? `#${issueContext.number} ${issueContext.title}`
                    : submittedQuery}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[10px] font-medium text-slate-600 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>OSS Mentor</span>
                  <span className="text-slate-400 dark:text-zinc-500 font-mono text-[9px]">({settings.ollamaModel || 'gemma:2b'})</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-1.5 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-zinc-700"
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
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer border border-slate-200 dark:border-zinc-700 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>New Chat</span>
                </button>
              </div>
            </div>

            {/* Scrollable Message Thread - Full Width to Cover Left & Right Space */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4 lg:px-6 py-6 flex flex-col items-center w-full">
              {/* Completed & Active Message Thread */}
              {messages.map((msg, idx) => (
                <ChatMessageItem
                  key={msg.id || idx}
                  msg={msg}
                  idx={idx}
                  isLast={idx === messages.length - 1}
                  isStreaming={isStreaming}
                  initials={initials}
                  ollamaModel={settings.ollamaModel}
                  markdownComponents={markdownComponents}
                  speakingId={speakingId}
                  copiedId={copiedId}
                  onRegenerate={handleRegenerate}
                  onSpeak={handleSpeakMessage}
                  onCopy={handleCopyMessage}
                />
              ))}

              <div ref={scrollBottomRef} />
            </div>

            {/* Bottom Docked Input Form for Follow-up Questions - Full Width */}
            <div className="flex-shrink-0 w-full border-t border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl px-2 sm:px-4 lg:px-6 pt-3 pb-3 flex flex-col items-center justify-center z-10">
              <form onSubmit={handleSubmit} className="w-full">
                <div className="w-full bg-white dark:bg-zinc-900 border border-slate-300/80 dark:border-zinc-800 rounded-2xl flex items-center p-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-colors">
                  {activeTab === 'git' ? (
                    <Terminal className="w-4 h-4 text-indigo-500 ml-2.5 mr-1 flex-shrink-0 self-start mt-2" />
                  ) : activeTab === 'chat' ? (
                    <MessageSquareCode className="w-4 h-4 text-indigo-500 ml-2.5 flex-shrink-0" />
                  ) : activeTab === 'repo' ? (
                    <FolderGit2 className="w-4 h-4 text-indigo-500 ml-2.5 flex-shrink-0" />
                  ) : (
                    <GitPullRequest className="w-4 h-4 text-indigo-500 ml-2.5 flex-shrink-0" />
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
                    className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed p-2.5 rounded-xl transition-all cursor-pointer flex-shrink-0 font-medium shadow-sm ml-2"
                    title="Send follow-up question"
                  >
                    <SendHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </form>
              <div className="flex flex-wrap items-center justify-between w-full px-2 mt-2 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                <div className="flex items-center gap-3">
                  <span>Enter to send</span>
                  <span>·</span>
                  <span>Shift + Enter for new line</span>
                  <span>·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">100% Private & Local</span>
                </div>
                {Boolean(repoContext || activeTab === 'repo') && (
                  <button
                    type="button"
                    onClick={() => {
                      const repoTarget = repoContext ? `${repoContext.owner}/${repoContext.repo}` : inputVal;
                      if (repoTarget) {
                        executeQuery(repoTarget, 'repo', null, 'skill');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer text-[10px] font-sans font-medium mt-1 sm:mt-0"
                    title="Auto-generate SKILL.md for AI coding agents"
                  >
                    <FileCode2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                    <span>Auto-Generate SKILL.md for AI Agents</span>
                  </button>
                )}
              </div>
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
