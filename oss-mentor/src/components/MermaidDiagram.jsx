import { useEffect, useState, useId } from 'react';
import mermaid from 'mermaid';
import { GitGraph, Copy, Check, AlertCircle } from 'lucide-react';

/**
 * MermaidDiagram Component
 * Renders Mermaid.js diagrams with adaptive Light/Dark mode themes.
 *
 * Props:
 * - chart (string): The Mermaid diagram code (e.g., "graph TD; A-->B;")
 * - isDark (boolean): Whether dark mode is currently active
 */
export default function MermaidDiagram({ chart, isDark = false }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const reactId = useId().replace(/:/g, '');

  useEffect(() => {
    let isCancelled = false;

    async function renderDiagram() {
      if (!chart || !chart.trim()) {
        setSvg('');
        setError(null);
        return;
      }

      const cleanChart = chart.trim();

      try {
        // Initialize Mermaid with adaptive theme variables
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          fontFamily: 'inherit',
          theme: isDark ? 'dark' : 'default',
          themeVariables: isDark
            ? {
                darkMode: true,
                background: '#18181b',
                mainBkg: '#27272a',
                primaryColor: '#4f46e5',
                primaryTextColor: '#f4f4f5',
                primaryBorderColor: '#6366f1',
                lineColor: '#a1a1aa',
                secondaryColor: '#3f3f46',
                tertiaryColor: '#18181b',
                textColor: '#f4f4f5',
                nodeBorder: '#6366f1',
                clusterBkg: '#18181b',
                clusterBorder: '#3f3f46',
                edgeLabelBackground: '#27272a',
              }
            : {
                darkMode: false,
                background: '#ffffff',
                mainBkg: '#f8fafc',
                primaryColor: '#e0e7ff',
                primaryTextColor: '#1e1b4b',
                primaryBorderColor: '#6366f1',
                lineColor: '#475569',
                secondaryColor: '#f1f5f9',
                tertiaryColor: '#ffffff',
                textColor: '#0f172a',
                nodeBorder: '#818cf8',
                clusterBkg: '#f8fafc',
                clusterBorder: '#cbd5e1',
                edgeLabelBackground: '#ffffff',
              },
        });

        const diagramId = `mermaid_${reactId}_${Date.now().toString(36)}`;
        const { svg: renderedSvg } = await mermaid.render(diagramId, cleanChart);

        if (!isCancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          // Incomplete syntax during LLM streaming or parsing error
          setError(err.message || 'Syntax parsing');
        }
      }
    }

    renderDiagram();

    return () => {
      isCancelled = true;
    };
  }, [chart, isDark, reactId]);

  const handleCopyCode = async () => {
    if (!chart) return;
    try {
      await navigator.clipboard.writeText(chart.trim());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  // If there's an error (e.g. while the model is still streaming partial mermaid syntax)
  if (error) {
    return (
      <div className="my-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-4 text-xs shadow-xs">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5 font-medium text-[11px] text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Mermaid Diagram (Rendering...)</span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Copy diagram code"
          >
            {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <pre className="font-mono text-[11px] text-slate-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {chart}
        </pre>
      </div>
    );
  }

  // Loading state before render
  if (!svg) {
    return (
      <div className="my-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 p-6 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-zinc-400 animate-pulse">
        <GitGraph className="w-4 h-4 text-indigo-500" />
        <span>Generating visual diagram...</span>
      </div>
    );
  }

  return (
    <div className="my-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 shadow-xs dark:shadow-xl overflow-hidden transition-colors">
      {/* Diagram Card Header */}
      <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 font-medium">
          <GitGraph className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-[11px] tracking-wide uppercase font-semibold">Visual Workflow</span>
        </div>
        <button
          type="button"
          onClick={handleCopyCode}
          className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white px-2 py-0.5 rounded-md hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Copy Mermaid syntax"
        >
          {isCopied ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>

      {/* Rendered SVG Container */}
      <div className="p-4 sm:p-6 overflow-x-auto flex justify-center items-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:mx-auto">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>
  );
}
