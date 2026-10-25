import { useState, useEffect } from 'react';
import RepoExplainer from './components/RepoExplainer.jsx';
import IssueExplainer from './components/IssueExplainer.jsx';
import GitHelper from './components/GitHelper.jsx';

const TABS = [
  { id: 'repo', label: 'Repo' },
  { id: 'issue', label: 'Issue' },
  { id: 'git', label: 'Git Help' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('repo');
  const [ollamaWarning, setOllamaWarning] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkOllama() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch('http://localhost:11434/api/tags', {
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
  }, []);

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900 flex flex-col justify-between">
      <div>
        {/* Top-of-page warning banner */}
        {ollamaWarning && (
          <div className="px-4 pt-4">
            <div className="max-w-3xl mx-auto rounded-lg p-3 text-sm bg-amber-100 border border-amber-300 text-amber-900 text-center shadow-xs">
              Ollama doesn&apos;t seem to be running. Start it with:{' '}
              <code className="font-mono font-semibold bg-amber-200/70 px-1.5 py-0.5 rounded">
                OLLAMA_ORIGINS=&apos;*&apos; ollama serve
              </code>
            </div>
          </div>
        )}

        {/* 1. Header */}
        <header className="text-center py-8 px-4 space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Beginner Open-Source Mentor
          </h1>
          <div>
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium px-3 py-1">
              100% local · no API keys · no data leaves this tab
            </span>
          </div>
        </header>

        {/* 2. Tabs Row */}
        <nav aria-label="Tabs" className="flex justify-center items-center gap-2 px-4 mb-8">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* 3. Content Area */}
        <main className="max-w-3xl mx-auto px-4 pb-16">
          {activeTab === 'repo' && <RepoExplainer />}
          {activeTab === 'issue' && <IssueExplainer />}
          {activeTab === 'git' && <GitHelper />}
        </main>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 py-6">
        Built for Hacktoberfest · Runs on gemma:2b via Ollama · Data never leaves your machine
      </footer>
    </div>
  );
}
