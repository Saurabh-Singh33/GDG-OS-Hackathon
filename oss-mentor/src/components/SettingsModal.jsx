import { useState } from 'react';
import { X, User, Sliders, Database, Trash2, Check } from 'lucide-react';

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
    settings.profileRole || 'Open Source Explorer'
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
      profileRole: profileRole.trim() || 'Open Source Explorer',
      ollamaModel: ollamaModel.trim() || 'gemma:2b',
      ollamaUrl: ollamaUrl.trim() || 'http://localhost:11434',
      mentorTone,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e293b]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Preferences & Settings</h3>
              <p className="text-xs text-slate-400">Configure profile, local AI, and mentor tone</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Profile Section */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>User Profile</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#0b1120] border border-[#1e293b] text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Saurabh"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Role / Bio</label>
                <input
                  type="text"
                  value={profileRole}
                  onChange={(e) => setProfileRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#0b1120] border border-[#1e293b] text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Open Source Explorer"
                />
              </div>
            </div>
          </div>

          <hr className="border-[#1e293b]" />

          {/* Local AI Engine Section */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-teal-400" />
              <span>Ollama Configuration</span>
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Model Name</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#0b1120] border border-[#1e293b] text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder="gemma:2b"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Defaults to <code className="text-slate-400">gemma:2b</code> (or use llama3, mistral, deepseek-r1:1.5b)
                </span>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ollama API URL</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-[#0b1120] border border-[#1e293b] text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder="http://localhost:11434"
                />
              </div>
            </div>
          </div>

          <hr className="border-[#1e293b]" />

          {/* Mentor Persona Tone */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
              Mentor Persona
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMentorTone('beginner')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  mentorTone === 'beginner'
                    ? 'border-blue-500 bg-blue-500/10 text-white font-medium'
                    : 'border-[#1e293b] bg-[#0b1120] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-semibold text-slate-200">Patient Beginner</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Assumes no Git knowledge, bullet points</div>
              </button>
              <button
                type="button"
                onClick={() => setMentorTone('concise')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  mentorTone === 'concise'
                    ? 'border-blue-500 bg-blue-500/10 text-white font-medium'
                    : 'border-[#1e293b] bg-[#0b1120] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-semibold text-slate-200">Terse & Direct</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Focuses on commands and speed</div>
              </button>
            </div>
          </div>

          <hr className="border-[#1e293b]" />

          {/* History Management */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-xs font-medium text-slate-300">Activity History</div>
              <div className="text-[11px] text-slate-500">
                {historyCount} saved session{historyCount === 1 ? '' : 's'} in localStorage
              </div>
            </div>
            <button
              type="button"
              onClick={onClearHistory}
              disabled={historyCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 border border-red-900/40 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-[#1e293b] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors cursor-pointer shadow-sm shadow-blue-500/20"
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
