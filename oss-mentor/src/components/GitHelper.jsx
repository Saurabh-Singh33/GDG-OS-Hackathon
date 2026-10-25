import { useState } from 'react';
import StreamingOutput from './StreamingOutput.jsx';

const SYSTEM_PROMPT =
  'You are an expert Git mentor. Explain the exact solution with real Git commands and clear, descriptive stages (e.g. "Stage files with git add", "Commit changes with git commit", "Push branch with git push"). If showing a workflow or flowchart, NEVER use generic dummy placeholders like "Step 1" or "Step 2" — always describe the actual action and command.';

export default function GitHelper() {
  const [question, setQuestion] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;

    setIsStreaming(true);
    setPrompt(trimmed);
  };

  const sampleQuestions = [
    'fatal: not a git repository',
    'How do I undo my last commit?',
    'What is the difference between git fetch and git pull?',
    'How do I create and switch to a new branch?',
  ];

  return (
    <div className="w-full max-w-[800px] mx-auto p-4 space-y-6 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Git Helper
        </h2>
        <p className="text-sm text-gray-600">
          Stuck on a Git command or error? Ask anything and get a quick explanation plus the exact command.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Paste a Git error or ask a Git question (e.g. 'fatal: not a git repository')"
          className="w-full px-4 py-3 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-xs resize-y"
          disabled={isStreaming}
        />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            <span>Examples:</span>
            {sampleQuestions.map((sample) => (
              <button
                key={sample}
                type="button"
                disabled={isStreaming}
                onClick={() => setQuestion(sample)}
                className="text-blue-600 hover:underline disabled:opacity-50 cursor-pointer text-left"
              >
                &ldquo;{sample}&rdquo;
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={isStreaming || !question.trim()}
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            {isStreaming ? 'Thinking...' : 'Ask'}
          </button>
        </div>
      </form>

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
