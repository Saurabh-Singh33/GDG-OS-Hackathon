import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check } from 'lucide-react';
import { streamOllama } from '../ollama.js';

/**
 * StreamingOutput component (Dark UI SaaS Theme)
 *
 * Props:
 * - prompt (string): The user prompt to send
 * - system (string): Optional system message
 * - model (string): Optional Ollama model name (default: 'gemma:2b')
 * - onDone (function): Optional callback invoked when streaming completes
 */
export default function StreamingOutput({
  prompt,
  system,
  model = 'gemma:2b',
  onDone,
}) {
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
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
  }, [prompt, system, model]);

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
      <div className="w-full max-w-3xl mt-4 rounded-2xl border border-red-800/60 bg-red-950/40 p-4 text-red-300 text-sm text-left shadow-lg">
        <div className="flex items-center gap-2 font-semibold mb-1 text-red-200">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span>Error</span>
        </div>
        <p className="text-red-300/90">{error}</p>
      </div>
    );
  }

  if (!isStreaming && !output) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mt-4 space-y-3">
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 text-left shadow-xl w-full">
        {/* Thinking indicator before any text arrives */}
        {isStreaming && !output && (
          <div className="flex items-center space-x-3 text-slate-400 text-sm py-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </span>
            <span className="font-medium text-slate-300">
              Thinking with {model}...
            </span>
          </div>
        )}

        {/* Markdown Output */}
        {output && (
          <div className="prose prose-invert prose-slate max-w-none prose-dark-markdown">
            <ReactMarkdown>{output}</ReactMarkdown>
          </div>
        )}

        {/* Streaming active indicator when text has begun arriving */}
        {isStreaming && output && (
          <div className="flex items-center space-x-2 text-slate-400 text-xs mt-4 pt-3 border-t border-[#1e293b]">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span>Streaming response from {model}...</span>
          </div>
        )}
      </div>

      {/* Copy button */}
      {output && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy answer</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
