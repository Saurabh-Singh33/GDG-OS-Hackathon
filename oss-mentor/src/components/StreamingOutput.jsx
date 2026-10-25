import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { streamOllama } from '../ollama.js';

/**
 * StreamingOutput component
 *
 * Props:
 * - prompt (string): The user prompt to send
 * - system (string): Optional system message
 * - onDone (function): Optional callback invoked when streaming completes
 */
export default function StreamingOutput({ prompt, system, onDone }) {
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
        const stream = streamOllama('gemma:2b', prompt, system);
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
  }, [prompt, system]);

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
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700 text-sm text-left">
        <p className="font-semibold mb-1">Streaming Error</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!isStreaming && !output) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-xl p-4 text-left max-w-none shadow-sm">
        {isStreaming && !output && (
          <div className="flex items-center space-x-2 text-gray-500 text-sm py-2">
            <svg
              className="animate-spin h-4 w-4 text-gray-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <span>Thinking...</span>
          </div>
        )}

        {output && (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{output}</ReactMarkdown>
          </div>
        )}

        {isStreaming && output && (
          <div className="flex items-center space-x-2 text-gray-400 text-xs mt-3 pt-2 border-t border-gray-100">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Thinking...</span>
          </div>
        )}
      </div>

      {output && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            {copied ? 'Copied!' : 'Copy answer'}
          </button>
        </div>
      )}
    </div>
  );
}
