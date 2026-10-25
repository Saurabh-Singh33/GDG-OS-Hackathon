import { useEffect, useState, useId, memo } from 'react';
import mermaid from 'mermaid';
import { GitGraph, Copy, Check, Code, Eye } from 'lucide-react';

/**
 * Normalizes and auto-fixes common LLM mistakes in Mermaid diagrams
 * (e.g. missing newlines after direction, unquoted parentheses in node text, etc.)
 */
function sanitizeAndFixMermaid(rawChart) {
  if (!rawChart) return '';
  let chart = rawChart.trim();

  // Strip enclosing markdown code block fences if present
  chart = chart.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Fix: "graph LRA[..." or "graph TDA[..." -> "graph LR\nA[..."
  chart = chart.replace(/^(graph|flowchart)\s+(TB|TD|BT|RL|LR)([A-Za-z0-9_\[\(])/im, '$1 $2\n$3');

  // Fix: Node labels with unquoted parentheses e.g. A[Create (Fork) repo] -> A["Create (Fork) repo"]
  // Mermaid crashes if parentheses or brackets are nested inside [...] without quotes
  chart = chart.replace(/\[([^"\]\n]*[\(\)][^"\]\n]*)\]/g, '["$1"]');

  return chart;
}

/**
 * MermaidDiagram Component
 * Safely renders Mermaid.js diagrams with adaptive Light/Dark mode themes.
 * Prevents Mermaid from injecting syntax error bomb icons into document.body.
 */
function MermaidDiagram({ chart, isDark = false }) {
  const [svg, setSvg] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showRawCode, setShowRawCode] = useState(false);
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    let isCancelled = false;

    // Remove any leftover error SVGs that Mermaid may have attached to document.body
    const purgeMermaidErrorArtifacts = () => {
      try {
        const errorNodes = document.querySelectorAll(
          '#d-syntax-error, [id^="dmermaid"], svg[id^="mermaid-"]:not(.mermaid-rendered)'
        );
        errorNodes.forEach((node) => {
          if (!node.closest('.mermaid-mount-point')) {
            node.remove();
          }
        });
      } catch {
        // Ignore DOM query issues
      }
    };

    async function renderDiagram() {
      if (!chart || !chart.trim()) {
        setSvg('');
        setHasError(false);
        return;
      }

      const cleanChart = sanitizeAndFixMermaid(chart);

      // Basic sanity check: diagram must begin with a recognized Mermaid diagram keyword
      const validStarters = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline)/i;
      if (!validStarters.test(cleanChart)) {
        setHasError(true);
        purgeMermaidErrorArtifacts();
        return;
      }

      try {
        // Initialize Mermaid with error rendering strictly suppressed
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          fontFamily: 'inherit',
          suppressErrorRendering: true,
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

        // 1. Validate syntax with parse first
        await mermaid.parse(cleanChart);

        // 2. Render only if parse succeeded
        const diagramId = `mermaid_${reactId}_${Math.random().toString(36).slice(2, 8)}`;
        const { svg: renderedSvg } = await mermaid.render(diagramId, cleanChart);

        if (!isCancelled) {
          // Double check the rendered SVG isn't an error message SVG
          if (renderedSvg && !renderedSvg.includes('Syntax error') && !renderedSvg.includes('Parse error')) {
            setSvg(renderedSvg);
            setHasError(false);
          } else {
            setHasError(true);
            purgeMermaidErrorArtifacts();
          }
        }
      } catch {
        if (!isCancelled) {
          setHasError(true);
          purgeMermaidErrorArtifacts();
        }
      } finally {
        purgeMermaidErrorArtifacts();
      }
    }

    renderDiagram();

    return () => {
      isCancelled = true;
      purgeMermaidErrorArtifacts();
    };
  }, [chart, isDark, reactId]);

  const handleCopyCode = async () => {
    if (!chart) return;
    try {
      await navigator.clipboard.writeText(chart.trim());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  // Graceful Fallback Card when diagram is parsing or has invalid LLM syntax
  if (hasError || showRawCode) {
    return (
      <div className="my-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 p-4 text-xs shadow-xs transition-all">
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <GitGraph className="w-4 h-4 text-indigo-500" />
            <span className="font-semibold text-slate-800 dark:text-zinc-200">
              Workflow Diagram Code
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-mono">
              mermaid
            </span>
          </div>

          <div className="flex items-center gap-2">
            {svg && !hasError && (
              <button
                type="button"
                onClick={() => setShowRawCode(false)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Diagram</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700/60 rounded-lg transition-colors cursor-pointer shadow-xs"
              title="Copy diagram code"
            >
              {isCopied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        <pre className="p-3 rounded-xl bg-slate-100 dark:bg-zinc-950 font-mono text-[11px] text-slate-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-200/60 dark:border-zinc-800">
          {chart.trim()}
        </pre>
      </div>
    );
  }

  // Loading skeleton while initial parse runs
  if (!svg) {
    return (
      <div className="my-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 p-5 flex items-center justify-center gap-2.5 text-xs text-slate-500 dark:text-zinc-400 animate-pulse">
        <GitGraph className="w-4 h-4 text-indigo-500" />
        <span className="font-mono text-[11px]">Building visual workflow diagram...</span>
      </div>
    );
  }

  // Successfully rendered visual diagram
  return (
    <div className="my-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm dark:shadow-xl overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-zinc-950/70 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 font-medium">
          <GitGraph className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-[11px] tracking-wide uppercase font-semibold text-slate-700 dark:text-zinc-300">
            Visual Workflow
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowRawCode(true)}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="View Mermaid Code"
          >
            <Code className="w-3 h-3" />
            <span>Code</span>
          </button>

          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Copy Mermaid Code"
          >
            {isCopied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Rendered SVG Container */}
      <div className="mermaid-mount-point p-4 sm:p-6 overflow-x-auto flex justify-center items-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:mx-auto">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>
  );
}

export default memo(MermaidDiagram);

