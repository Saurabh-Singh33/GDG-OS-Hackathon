import { useState } from 'react';
import { parseRepoUrl, fetchReadme, fetchTree } from '../github.js';
import StreamingOutput from './StreamingOutput.jsx';

const SYSTEM_PROMPT =
  'You are a patient open-source mentor. Explain things for a complete beginner. Never assume they know Git. Be concise and use bullet points.';

export default function RepoExplainer() {
  const [repoInput, setRepoInput] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedInput = repoInput.trim();
    if (!trimmedInput) return;

    setError(null);
    setPrompt('');
    setIsLoading(true);

    try {
      const { owner, repo } = parseRepoUrl(trimmedInput);

      // Fetch README and optionally file tree
      const readme = await fetchReadme(owner, repo);
      let tree = [];
      try {
        tree = await fetchTree(owner, repo);
      } catch {
        // Tree fetch is optional fallback
      }

      // Truncate README to a reasonable length for the local model
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

  const isBusy = isLoading || isStreaming;

  return (
    <div className="w-full max-w-[800px] mx-auto p-4 space-y-6 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Repository Explainer
        </h2>
        <p className="text-sm text-gray-600">
          Enter any GitHub repository URL or <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">owner/repo</code> to get a beginner-friendly walkthrough.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="e.g. facebook/react or https://github.com/facebook/react"
            className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-xs"
            disabled={isBusy}
          />
          <button
            type="submit"
            disabled={isBusy || !repoInput.trim()}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            {isLoading ? 'Fetching repo...' : 'Explain Repository'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500">
          <span>Try:</span>
          {['firstcontributions/first-contributions', 'facebook/react'].map((sample) => (
            <button
              key={sample}
              type="button"
              disabled={isBusy}
              onClick={() => setRepoInput(sample)}
              className="text-blue-600 hover:underline disabled:opacity-50 cursor-pointer"
            >
              {sample}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700 text-sm text-left">
          <p className="font-semibold mb-1">Error</p>
          <p>{error}</p>
        </div>
      )}

      {prompt && (
        <StreamingOutput
          prompt={prompt}
          system={SYSTEM_PROMPT}
          onDone={() => setIsStreaming(false)}
        />
      )}
    </div>
  );
}
