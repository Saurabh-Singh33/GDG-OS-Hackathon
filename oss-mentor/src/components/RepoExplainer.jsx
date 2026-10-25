import { useState } from 'react';
import { parseRepoUrl, fetchReadme, fetchTree, fetchContributing } from '../github.js';
import StreamingOutput from './StreamingOutput.jsx';
import { FolderGit2, Download, Sparkles, FileCode2 } from 'lucide-react';

const SYSTEM_PROMPT =
  'You are a patient open-source mentor. Explain things for a complete beginner. Never assume they know Git. Be concise and use bullet points.';

const SKILL_SYSTEM_PROMPT =
  'You are an expert open-source maintainer creating a SKILL.md file for AI coding agents (like Cline, Cursor, or Copilot). This file must be highly structured, using Markdown headers, so that an AI agent can instantly understand the project, its tech stack, and exactly how to contribute without making mistakes.';

export default function RepoExplainer() {
  const [repoInput, setRepoInput] = useState('');
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT);
  const [activeMode, setActiveMode] = useState('explain'); // 'explain' or 'skill'
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingSkill, setIsGeneratingSkill] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [skillOutput, setSkillOutput] = useState('');
  const [error, setError] = useState(null);

  /**
   * Explain Repository handler
   */
  const handleExplainRepo = async (e) => {
    if (e) e.preventDefault();
    const trimmedInput = repoInput.trim();
    if (!trimmedInput) return;

    setError(null);
    setPrompt('');
    setSkillOutput('');
    setActiveMode('explain');
    setSystemPrompt(SYSTEM_PROMPT);
    setIsLoading(true);

    try {
      const { owner, repo } = parseRepoUrl(trimmedInput);

      // Fetch README and optionally file tree in parallel
      const [readme, tree] = await Promise.all([
        fetchReadme(owner, repo),
        fetchTree(owner, repo).catch(() => []),
      ]);

      const truncatedReadme = readme.slice(0, 3000);
      const fileList = tree.slice(0, 30).join('\n');

      const promptString = [
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

      setIsLoading(false);
      setIsStreaming(true);
      setPrompt(promptString);
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Failed to explain repository.');
    }
  };

  /**
   * Auto-Generate SKILL.md for AI Agents handler
   */
  const handleGenerateSkill = async (e) => {
    if (e) e.preventDefault();
    const trimmedInput = repoInput.trim();
    if (!trimmedInput) return;

    setError(null);
    setPrompt('');
    setSkillOutput('');
    setActiveMode('skill');
    setSystemPrompt(SKILL_SYSTEM_PROMPT);
    setIsGeneratingSkill(true);

    try {
      const { owner, repo } = parseRepoUrl(trimmedInput);

      // Fetch README, file tree, and CONTRIBUTING.md in parallel
      const [readme, tree, contributing] = await Promise.all([
        fetchReadme(owner, repo),
        fetchTree(owner, repo).catch(() => []),
        fetchContributing(owner, repo),
      ]);

      const truncatedReadme = (readme || '').slice(0, 3000);
      const fileList = tree.slice(0, 40).join('\n');
      const contributingText = (contributing || '').slice(0, 3000);

      const userPrompt = [
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

      setIsGeneratingSkill(false);
      setIsStreaming(true);
      setPrompt(userPrompt);
    } catch (err) {
      setIsGeneratingSkill(false);
      setError(err.message || 'Failed to generate SKILL.md for repository.');
    }
  };

  /**
   * Triggers download of generated SKILL.md file as a Blob
   * @param {string} text
   */
  const downloadSkillFile = (text) => {
    const content = text || skillOutput;
    if (!content) return;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SKILL.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isBusy = isLoading || isGeneratingSkill || isStreaming;

  return (
    <div className="w-full max-w-4xl xl:max-w-5xl mx-auto p-4 sm:p-6 space-y-6 text-center">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/40 text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">
          <FolderGit2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Repository Intelligence & AI Agent Skills</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Repository Explainer & SKILL.md Generator
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Enter any GitHub repository to get a beginner-friendly walkthrough or auto-generate a structured <code className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono text-indigo-600 dark:text-indigo-400">SKILL.md</code> for AI coding agents.
        </p>
      </div>

      <form onSubmit={handleExplainRepo} className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-2xl flex items-center p-2.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-colors">
            <FolderGit2 className="w-4 h-4 text-slate-400 dark:text-zinc-500 ml-2.5 flex-shrink-0" />
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="e.g. facebook/react or https://github.com/facebook/react"
              className="bg-transparent border-none outline-none flex-1 px-3.5 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 disabled:opacity-50"
              disabled={isBusy}
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {/* Primary Button: Explain Repository */}
            <button
              type="submit"
              disabled={isBusy || !repoInput.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <FolderGit2 className="w-4 h-4" />
              <span>{isLoading ? 'Fetching repo...' : 'Explain Repository'}</span>
            </button>

            {/* Secondary Button: Generate SKILL.md */}
            <button
              type="button"
              onClick={handleGenerateSkill}
              disabled={isBusy || !repoInput.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800/80 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <FileCode2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{isGeneratingSkill ? 'Analyzing repo & contributing...' : 'Generate SKILL.md'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <span>Try:</span>
          {['firstcontributions/first-contributions', 'facebook/react', 'expressjs/express'].map((sample) => (
            <button
              key={sample}
              type="button"
              disabled={isBusy}
              onClick={() => setRepoInput(sample)}
              className="text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 cursor-pointer font-mono text-[11px]"
            >
              {sample}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div className="rounded-2xl border border-red-300 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 text-red-700 dark:text-red-300 text-sm text-left shadow-xs">
          <p className="font-semibold mb-1">Error</p>
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {/* Download SKILL.md Button that appears after streaming finishes */}
      {skillOutput && !isStreaming && activeMode === 'skill' && (
        <div className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 shadow-xs">
          <div className="text-left">
            <h4 className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
              SKILL.md Generated Successfully!
            </h4>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
              Ready for AI coding agents (Cline, Cursor, Copilot, Antigravity).
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadSkillFile(skillOutput)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-xs cursor-pointer ml-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download SKILL.md</span>
          </button>
        </div>
      )}

      {prompt && (
        <div className="text-left w-full">
          <StreamingOutput
            prompt={prompt}
            system={systemPrompt}
            onDone={(accumulated) => {
              setIsStreaming(false);
              setIsGeneratingSkill(false);
              if (activeMode === 'skill') {
                setSkillOutput(accumulated);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
