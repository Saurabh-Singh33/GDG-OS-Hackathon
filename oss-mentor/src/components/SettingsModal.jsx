import { useState } from 'react';
import { X, User, Sliders, Database, Trash2, Check, Sun, Moon } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onClearHistory,
  historyCount,
  theme,
  onToggleTheme,
}) {
  const [profileName, setProfileName] = useState(settings.profileName || 'Saurabh');
  const [profileRole, setProfileRole] = useState(
    settings.profileRole || 'Open Source Contributor'
  );
  const [ollamaModel, setOllamaModel] = useState(settings.ollamaModel || 'gemma:2b');
  const [ollamaUrl, setOllamaUrl] = useState(
    settings.ollamaUrl || 'http://localhost:11434'
  );
  const [mentorTone, setMentorTone] = useState(settings.mentorTone || 'beginner');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSaveSettings({
      profileName: profileName.trim() || 'Saurabh',
      profileRole: profileRole.trim() || 'Open Source Contributor',
      ollamaModel: ollamaModel.trim() || 'gemma:2b',
      ollamaUrl: ollamaUrl.trim() || 'http://localhost:11434',
      mentorTone,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-zinc-200 transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Preferences & Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Configure profile, local AI, and appearance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Appearance Toggle inside settings */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800">
            <div>
              <div className="text-xs font-medium text-slate-900 dark:text-zinc-200">
                Interface Theme
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                Currently using {theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer shadow-xs"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Switch to Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Switch to Dark</span>
                </>
              )}
            </button>
          </div>

          {/* Profile Section */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>User Profile</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="e.g. Saurabh"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">Role / Bio</label>
                <input
                  type="text"
                  value={profileRole}
                  onChange={(e) => setProfileRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="e.g. Open Source Contributor"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-zinc-800" />

          {/* Local AI Engine Section */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Ollama Configuration</span>
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">Model Name</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-colors"
                  placeholder="gemma:2b"
                />
                <span className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 block">
                  Defaults to <code className="text-slate-700 dark:text-zinc-300">gemma:2b</code> (supports llama3, mistral, deepseek-r1, etc.)
                </span>
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-zinc-400 mb-1">Ollama API URL</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-colors"
                  placeholder="http://localhost:11434"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-zinc-800" />

          {/* Mentor Persona Tone */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
              Mentor Persona
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMentorTone('beginner')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  mentorTone === 'beginner'
                    ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                }`}
              >
                <div className="font-medium text-slate-900 dark:text-zinc-200">Patient Beginner</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Assumes no Git knowledge, step-by-step</div>
              </button>
              <button
                type="button"
                onClick={() => setMentorTone('concise')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  mentorTone === 'concise'
                    ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium'
                    : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                }`}
              >
                <div className="font-medium text-slate-900 dark:text-zinc-200">Terse & Direct</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Focuses on commands and speed</div>
              </button>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-zinc-800" />

          {/* History Management */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-xs font-medium text-slate-900 dark:text-zinc-200">Activity History</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                {historyCount} saved session{historyCount === 1 ? '' : 's'} in IndexedDB
              </div>
            </div>
            <button
              type="button"
              onClick={onClearHistory}
              disabled={historyCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-900/40 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors cursor-pointer shadow-xs font-semibold"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
