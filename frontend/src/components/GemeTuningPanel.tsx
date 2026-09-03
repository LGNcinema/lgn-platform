import React, { useEffect, useRef, useState } from 'react';
import type { GemeConfig, GemeTuning } from '../types';
import { API_URL } from '../api';

interface Props {
  capsuleId?: number;
  tuning: GemeTuning | null;
  onApply: (tuning: GemeTuning | null) => void;
  onClose: () => void;
}

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

const SETTING_KEYS = [
  'persona', 'opening_turn', 'model', 'effort',
  'max_tokens', 'max_turns', 'max_chars_per_turn',
] as const;

const MODELS = [
  { id: 'claude-opus-5', label: 'Opus 5 — most capable (default)' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5 — faster, cheaper' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — fastest, least capable' },
];

/**
 * Dev-only panel for tuning Geme's persona and parameters against a live
 * conversation, so the wording can be iterated on without a redeploy.
 *
 * Edits are held in this browser and sent with each chat request; the server
 * honours them only where GEME_DEBUG is on, and nothing here changes what
 * anyone else sees. Settling on wording still means editing
 * backend/app/geme.py and committing it.
 */
export const GemeTuningPanel: React.FC<Props> = ({ capsuleId, tuning, onApply, onClose }) => {
  const [serverConfig, setServerConfig] = useState<GemeConfig | null>(null);
  const [draft, setDraft] = useState<GemeTuning>(tuning || {});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAssembled, setShowAssembled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the live values so the panel edits what the server is actually using,
  // rather than a copy that drifts as geme.py changes.
  useEffect(() => {
    const query = capsuleId ? `?capsule_id=${capsuleId}` : '';
    fetch(`${API_URL}/api/geme/config${query}`)
      .then((res) => {
        if (!res.ok) throw new Error('Tuning is not enabled on this server (GEME_DEBUG).');
        return res.json();
      })
      .then(setServerConfig)
      .catch((err: Error) => setError(err.message));
  }, [capsuleId]);

  // A field's value: the edit if there is one, otherwise the server's own.
  const valueOf = <K extends keyof GemeConfig>(field: K): GemeConfig[K] | '' => {
    const edited = (draft as Record<string, unknown>)[field];
    if (edited !== undefined && edited !== null) return edited as GemeConfig[K];
    return serverConfig ? serverConfig[field] : '';
  };

  const set = (field: keyof GemeTuning, value: string | number | undefined) => {
    setNotice(null);
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const changedFields = Object.entries(draft)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k]) => k);

  const handleApply = () => {
    onApply(changedFields.length ? draft : null);
    onClose();
  };

  const handleReset = () => {
    setDraft({});
    onApply(null);
  };

  // Save a set of settings worth keeping. The file holds every value in full --
  // not just the edits -- so it can be re-loaded, shared, or read straight into
  // backend/app/geme.py without the server's defaults needing to match.
  const handleDownload = () => {
    if (!serverConfig) return;
    const settings = Object.fromEntries(
      SETTING_KEYS.map((key) => [key, valueOf(key)])
    );
    const file = {
      exported_at: new Date().toISOString(),
      capsule_id: capsuleId ?? null,
      changed_from_server_defaults: changedFields,
      settings,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `geme-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Saved. Apply & restart to try these, or send the file on.');
  };

  const handleUpload = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      // Accept both the exported shape and a bare settings object.
      const settings = (parsed.settings ?? parsed) as Record<string, unknown>;
      const loaded: GemeTuning = {};
      for (const key of SETTING_KEYS) {
        const value = settings[key];
        if (value !== undefined && value !== null && value !== '') {
          (loaded as Record<string, unknown>)[key] = value;
        }
      }
      if (!Object.keys(loaded).length) throw new Error('No Geme settings in that file.');
      setDraft(loaded);
      setError(null);
      setNotice(`Loaded ${file.name}. Apply & restart to try it.`);
    } catch (err) {
      setError(`Couldn't read that file: ${(err as Error).message}`);
    }
  };

  return (
    <div className="geme-tune-overlay" onClick={onClose}>
      <div
        className="geme-tune-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Geme tuning"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="geme-tune-header">
          <div>
            <h3 className="geme-tune-title">🧪 Geme Tuning</h3>
            <p className="geme-tune-note">
              Local only. Edits live in this browser and apply to your next conversation —
              they don't change the server or what anyone else sees.
            </p>
          </div>
          <button className="geme-close-btn" onClick={onClose} aria-label="Close tuning panel">×</button>
        </div>

        {error && <p className="geme-tune-error">{error}</p>}

        {!serverConfig && !error && <p className="geme-tune-loading">Loading Geme's settings…</p>}

        {serverConfig && (
          <div className="geme-tune-body">
            <label className="geme-tune-field">
              <span className="geme-tune-label">Persona (system prompt)</span>
              <textarea
                className="geme-tune-textarea tall"
                value={valueOf('persona') as string}
                onChange={(e) => set('persona', e.target.value)}
                spellCheck
              />
            </label>

            <label className="geme-tune-field">
              <span className="geme-tune-label">
                Opening turn
                <em> — the hidden prompt that makes Geme greet you first</em>
              </span>
              <textarea
                className="geme-tune-textarea"
                value={valueOf('opening_turn') as string}
                onChange={(e) => set('opening_turn', e.target.value)}
              />
            </label>

            <div className="geme-tune-grid">
              <label className="geme-tune-field">
                <span className="geme-tune-label">Model</span>
                <select
                  className="geme-tune-input"
                  value={valueOf('model') as string}
                  onChange={(e) => set('model', e.target.value)}
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>

              <label className="geme-tune-field">
                <span className="geme-tune-label">Effort — how hard it thinks</span>
                <select
                  className="geme-tune-input"
                  value={valueOf('effort') as string}
                  onChange={(e) => set('effort', e.target.value)}
                >
                  {EFFORTS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </label>

              <label className="geme-tune-field">
                <span className="geme-tune-label">Max tokens — reply length cap</span>
                <input
                  className="geme-tune-input"
                  type="number"
                  min={64}
                  max={8192}
                  value={valueOf('max_tokens') as number}
                  onChange={(e) => set('max_tokens', Number(e.target.value) || undefined)}
                />
              </label>

              <label className="geme-tune-field">
                <span className="geme-tune-label">Max chars per turn — truncates long replies from you</span>
                <input
                  className="geme-tune-input"
                  type="number"
                  min={100}
                  max={8000}
                  value={valueOf('max_chars_per_turn') as number}
                  onChange={(e) => set('max_chars_per_turn', Number(e.target.value) || undefined)}
                />
              </label>

              <label className="geme-tune-field">
                <span className="geme-tune-label">
                  History window — messages kept
                  <em> — counts both sides; older ones drop off. Not the conversation
                  length, which the persona sets ("three to five exchanges").</em>
                </span>
                <input
                  className="geme-tune-input"
                  type="number"
                  min={2}
                  max={60}
                  value={valueOf('max_turns') as number}
                  onChange={(e) => set('max_turns', Number(e.target.value) || undefined)}
                />
              </label>
            </div>

            <button
              className="geme-tune-disclosure"
              onClick={() => setShowAssembled(!showAssembled)}
            >
              {showAssembled ? '▾' : '▸'} What Geme actually receives (persona + this capsule's context)
            </button>
            {showAssembled && (
              <pre className="geme-tune-assembled">{serverConfig.assembled_system_prompt}</pre>
            )}
          </div>
        )}

        <div className="geme-tune-footer">
          <span className="geme-tune-status">
            {notice || (changedFields.length
              ? `${changedFields.length} setting${changedFields.length > 1 ? 's' : ''} changed`
              : 'Using server defaults')}
          </span>
          <div className="geme-tune-actions">
            {/* Keep a set worth returning to, or hand it to someone else */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = '';
              }}
            />
            <button
              className="geme-action-btn secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Load file
            </button>
            <button
              className="geme-action-btn secondary"
              onClick={handleDownload}
              disabled={!serverConfig}
            >
              Save to file
            </button>
            <button className="geme-action-btn secondary" onClick={handleReset}>
              Reset to defaults
            </button>
            <button className="geme-action-btn" onClick={handleApply} disabled={!serverConfig}>
              Apply &amp; restart conversation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
