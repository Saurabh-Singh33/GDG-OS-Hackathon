import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, RotateCcw } from 'lucide-react';
import { streamOllama } from '../ollama.js';

/**
 * StreamingOutput component (Light & Dark Theme Adaptive)
 *
 * Props:
 * - prompt (string): The user prompt to send
 * - system (string): Optional system message
 * - model (string): Optional Ollama model name (default: 'gemma:2b')
 * - initialOutput (string): Pre-existing saved answer to display without re-streaming
 * - onDone (function): Callback invoked when streaming completes with the accumulated text
 * - onRegenerate (function): Optional callback to trigger a live re-generation
 */
export default function StreamingOutput({
  prompt,
  system,
  model = 'gemma:2b',
  initialOutput = '',
  onDone,
  onRegenerate,
}) {
  const [output, setOutput] = useState(initialOutput || '');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Sync initialOutput when loaded from database/history
  useEffect(() => {
    if (initialOutput) {
      setOutput(initialOutput);
      setIsStreaming(false);
      setError(null);
    }
  }, [initialOutput]);

  useEffect(() => {
    // If we already have a saved answer, don't re-stream
    if (initialOutput) {
      return;
    }

    if (!prompt || !prompt.trim()) {
      setOutput('');
      setIsStreaming(false);
      setError(null);
      return;
    }

    let isCancelled = false;
    setIsStreaming(true);
    setError(null);
    setOutput('');

    async function streamResponse() {
      let accumulated = '';
      try {
        const stream = streamOllama(model || 'gemma:2b', prompt, system);
        for await (const chunk of stream) {
          if (isCancelled) {
            break;
          }
          accumulated += chunk;
          setOutput(accumulated);
        }

        if (!isCancelled) {
          setIsStreaming(false);
          if (onDoneRef.current) {
            onDoneRef.current(accumulated);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'An error occurred while streaming.');
          setIsStreaming(false);
        }
      }
    }

    streamResponse();

    return () => {
      isCancelled = true;
    };
  }, [prompt, system, model, initialOutput]);

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  if (error) {
    return (
      <div className="w-full max-w-3xl mt-4 rounded-2xl border border-red-300 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 text-red-700 dark:text-red-300 text-sm text-left shadow-xs">
        <div className="flex items-center gap-2 font-medium mb-1 text-red-800 dark:text-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span>Error</span>
        </div>
        <p className="text-red-600 dark:text-red-300/80 text-xs leading-relaxed">{error}</p>
      </div>
    );
  }

  if (!isStreaming && !output) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mt-4 space-y-3">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 text-left shadow-xs dark:shadow-2xl w-full transition-colors">
        {/* Thinking indicator before any text arrives */}
        {isStreaming && !output && (
          <div className="flex items-center space-x-3 text-slate-500 dark:text-zinc-400 text-xs py-4">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600" />
            </span>
            <span className="font-mono text-slate-600 dark:text-zinc-300">
              Generating response with {model}...
            </span>
          </div>
        )}

        {/* Markdown Output with prose & prose-invert */}
        {output && (
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-zinc-200 leading-relaxed">
            <ReactMarkdown>{output}</ReactMarkdown>
          </div>
        )}

        {/* Streaming active indicator when text has begun arriving */}
        {isStreaming && output && (
          <div className="flex items-center space-x-2 text-slate-400 dark:text-zinc-500 text-xs mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
              Streaming {model}...
            </span>
          </div>
        )}
      </div>

      {/* Action buttons (Copy & Regenerate) */}
      {output && (
        <div className="flex items-center justify-between px-1">
          <div className="text-[11px] text-slate-500 dark:text-zinc-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Saved in local database</span>
          </div>

          <div className="flex items-center gap-2">
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isStreaming}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700/60 border border-slate-200 dark:border-zinc-700/60 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="Re-run response with Ollama"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Regenerate</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700/60 border border-slate-200 dark:border-zinc-700/60 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied to clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                  <span>Copy answer</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
