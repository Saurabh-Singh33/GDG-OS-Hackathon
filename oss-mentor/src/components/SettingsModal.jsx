import { useState } from 'react';
import { X, User, Sliders, Database, Trash2, Check, Palette } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onClearHistory,
  historyCount,
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
  const [theme, setTheme] = useState(settings.theme || 'midnight');
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
      theme,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 500);
  };

  const THEMES = [
    { id: 'midnight', label: 'Midnight Indigo', desc: 'Linear & Raycast dark vibe with violet glow' },
    { id: 'graphite', label: 'Obsidian Neutral', desc: 'Minimalist studio monochrome' },
    { id: 'emerald', label: 'Emerald Hacker', desc: 'Supabase & GitHub dark green accent' },
    { id: 'amber', label: 'Warm Amber', desc: 'Terminal bronze accent' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#11141c]/95 border border-white/[0.1] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-slate-300">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Preferences & Settings</h3>
              <p className="text-xs text-slate-400">Personalize profile, theme, and local AI</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Theme Palette Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-indigo-400" />
              <span>Color Theme</span>
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    theme === t.id
                      ? 'border-indigo-500 bg-indigo-500/15 text-white font-medium ring-1 ring-indigo-500/50'
                      : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="font-medium text-slate-200">{t.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-white/[0.08]" />

          {/* Profile Section */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>User Profile</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/[0.1] text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="e.g. Saurabh"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Role / Bio</label>
                <input
                  type="text"
                  value={profileRole}
                  onChange={(e) => setProfileRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/[0.1] text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="e.g. Open Source Contributor"
                />
              </div>
            </div>
          </div>

          <hr className="border-white/[0.08]" />

          {/* Local AI Engine Section */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ollama Configuration</span>
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Model Name</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/[0.1] text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-colors"
                  placeholder="gemma:2b"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Defaults to <code className="text-slate-300">gemma:2b</code> (or llama3, mistral, deepseek-r1)
                </span>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ollama API URL</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/[0.1] text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-colors"
                  placeholder="http://localhost:11434"
                />
              </div>
            </div>
          </div>

          <hr className="border-white/[0.08]" />

          {/* Mentor Persona Tone */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Mentor Persona
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMentorTone('beginner')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  mentorTone === 'beginner'
                    ? 'border-indigo-500 bg-indigo-500/15 text-white font-medium ring-1 ring-indigo-500/50'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-medium text-slate-200">Patient Beginner</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Assumes no Git knowledge, step-by-step</div>
              </button>
              <button
                type="button"
                onClick={() => setMentorTone('concise')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  mentorTone === 'concise'
                    ? 'border-indigo-500 bg-indigo-500/15 text-white font-medium ring-1 ring-indigo-500/50'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-medium text-slate-200">Terse & Direct</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Focuses on commands and speed</div>
              </button>
            </div>
          </div>

          <hr className="border-white/[0.08]" />

          {/* History Management */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-xs font-medium text-slate-200">Activity History</div>
              <div className="text-[11px] text-slate-500">
                {historyCount} saved session{historyCount === 1 ? '' : 's'} in localStorage
              </div>
            </div>
            <button
              type="button"
              onClick={onClearHistory}
              disabled={historyCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
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
