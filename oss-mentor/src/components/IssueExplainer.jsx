import { useState } from 'react';
import { parseIssueUrl, fetchIssue } from '../github.js';
import StreamingOutput from './StreamingOutput.jsx';

const SYSTEM_PROMPT =
  'You are a patient open-source mentor. Explain things for a complete beginner. Never assume they know Git. Be concise and use bullet points.';

export default function IssueExplainer() {
  const [issueInput, setIssueInput] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedInput = issueInput.trim();
    if (!trimmedInput) return;

    setError(null);
    setPrompt('');
    setIsLoading(true);

    try {
      // 1. Parse issue URL
      const { owner, repo, number } = parseIssueUrl(trimmedInput);

      // 2. Fetch issue data from GitHub
      const issue = await fetchIssue(owner, repo, number);

      // 3. Build prompt for mentor explanation
      const labelText =
        issue.labels && issue.labels.length > 0
          ? issue.labels.join(', ')
          : 'None';
      const bodyText = issue.body
        ? issue.body.slice(0, 3000)
        : 'No description provided.';

      const promptString = [
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

      setIsLoading(false);
      setIsStreaming(true);
      setPrompt(promptString);
    } catch (err) {
      setIsLoading(false);
      setError(err.message || 'Failed to explain issue.');
    }
  };

  const isBusy = isLoading || isStreaming;

  return (
    <div className="w-full max-w-[800px] mx-auto p-4 space-y-6 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Issue Explainer
        </h2>
        <p className="text-sm text-gray-600">
          Paste any GitHub issue URL to break down what it means and how to approach it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={issueInput}
            onChange={(e) => setIssueInput(e.target.value)}
            placeholder="https://github.com/owner/repo/issues/123"
            className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-xs"
            disabled={isBusy}
          />
          <button
            type="submit"
            disabled={isBusy || !issueInput.trim()}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            {isLoading ? 'Fetching issue...' : 'Explain this issue'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500">
          <span>Try:</span>
          {[
            'https://github.com/firstcontributions/first-contributions/issues/1',
          ].map((sample) => (
            <button
              key={sample}
              type="button"
              disabled={isBusy}
              onClick={() => setIssueInput(sample)}
              className="text-blue-600 hover:underline disabled:opacity-50 cursor-pointer truncate max-w-xs"
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
