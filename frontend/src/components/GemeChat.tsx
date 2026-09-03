import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CapsuleDetail, GemeTuning, GemeTurn } from '../types';
import { API_URL } from '../api';

interface Props {
  capsule: CapsuleDetail;
  onClose: () => void;
  // Dev tuning panel overrides, applied to this conversation only.
  tuning?: GemeTuning | null;
}

interface StreamEvent {
  type: 'delta' | 'done' | 'error';
  text?: string;
  next_step?: string | null;
  message?: string;
}

const GEME_AVATAR = '/images/geme.png';

/**
 * "Take It Inward" -- a short private conversation with Geme that ends in one
 * small next step.
 *
 * The transcript is held in component state and replayed to the backend on every
 * turn; nothing is written to the server. Only the step the visitor chooses to
 * keep is saved, and only to their own browser.
 */
export const GemeChat: React.FC<Props> = ({ capsule, onClose, tuning }) => {
  const [messages, setMessages] = useState<GemeTurn[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [savedStep, setSavedStep] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const stepStorageKey = `geme_next_step_${capsule.id}`;

  // Sends the transcript so far and streams Geme's reply in as it is written.
  const sendTurn = useCallback(async (history: GemeTurn[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setError(null);
    setStreamingText('');

    let received = '';

    const finish = (step: string | null) => {
      if (received.trim()) {
        setMessages([...history, { role: 'assistant', content: received.trim() }]);
      }
      setStreamingText('');
      if (step) setNextStep(step);
    };

    try {
      const response = await fetch(`${API_URL}/api/geme/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capsule_id: capsule.id, messages: history, tuning }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(
          response.status === 503
            ? "Geme isn't available on this server yet."
            : "Geme couldn't be reached. Try again in a moment."
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Server-sent events: one JSON payload per `data:` line, blank-line separated.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;

          const event = JSON.parse(line.slice(6)) as StreamEvent;
          if (event.type === 'delta' && event.text) {
            received += event.text;
            setStreamingText(received);
          } else if (event.type === 'done') {
            finish(event.next_step ?? null);
          } else if (event.type === 'error') {
            throw new Error(event.message || "Geme couldn't finish that thought.");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
      setStreamingText('');
    } finally {
      if (abortRef.current === controller) {
        setIsStreaming(false);
        abortRef.current = null;
      }
    }
  }, [capsule.id, tuning]);

  // Geme opens the conversation, so the first turn goes out with an empty transcript.
  // The cleanup drops the request if the panel closes mid-stream -- and because
  // sendTurn aborts whatever it supersedes, StrictMode's double-mount in dev just
  // restarts the opener rather than leaving the panel empty.
  useEffect(() => {
    void sendTurn([]);
    return () => abortRef.current?.abort();
  }, [sendTurn]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Keep the newest words in view as they stream in.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText, nextStep, error]);

  useEffect(() => {
    if (!isStreaming && !nextStep) inputRef.current?.focus();
  }, [isStreaming, nextStep]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    const history: GemeTurn[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setDraft('');
    void sendTurn(history);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = () => {
    setError(null);
    void sendTurn(messages);
  };

  const handleStartOver = () => {
    abortRef.current?.abort();
    setMessages([]);
    setNextStep(null);
    setSavedStep(false);
    setError(null);
    setDraft('');
    void sendTurn([]);
  };

  const handleSaveStep = () => {
    if (!nextStep) return;
    localStorage.setItem(stepStorageKey, nextStep);
    setSavedStep(true);
  };

  return (
    <div className="geme-overlay" onClick={onClose}>
      <div
        className="geme-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Talk it through with Geme"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="geme-panel-header">
          <div className="geme-panel-identity">
            <img className="geme-panel-avatar" src={GEME_AVATAR} alt="" />
            <div>
              <h3 className="geme-panel-title">Talk It Through with Geme</h3>
              <p className="geme-panel-note">
                Private. This conversation isn't saved — only the step you choose to keep.
              </p>
            </div>
          </div>
          <button className="geme-close-btn" onClick={onClose} aria-label="Close conversation">
            ×
          </button>
        </div>

        <div className="geme-transcript" ref={transcriptRef} aria-live="polite">
          {messages.map((message, idx) => (
            <div key={idx} className={`geme-message geme-message-${message.role}`}>
              {message.role === 'assistant' && (
                <img className="geme-message-avatar" src={GEME_AVATAR} alt="Geme" />
              )}
              <div className="geme-bubble">{message.content}</div>
            </div>
          ))}

          {streamingText && (
            <div className="geme-message geme-message-assistant">
              <img className="geme-message-avatar" src={GEME_AVATAR} alt="Geme" />
              <div className="geme-bubble">{streamingText}</div>
            </div>
          )}

          {isStreaming && !streamingText && (
            <div className="geme-message geme-message-assistant">
              <img className="geme-message-avatar" src={GEME_AVATAR} alt="Geme" />
              <div className="geme-bubble geme-thinking" aria-label="Geme is thinking">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {nextStep && (
            <div className="geme-next-step">
              <span className="geme-next-step-label">Your next step</span>
              <p className="geme-next-step-text">{nextStep}</p>
              <div className="geme-next-step-actions">
                <button
                  className={`geme-action-btn${savedStep ? ' saved' : ''}`}
                  onClick={handleSaveStep}
                >
                  {savedStep ? 'Saved' : 'Save this step'}
                </button>
                <button className="geme-action-btn secondary" onClick={handleStartOver}>
                  Start again
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="geme-error">
              <p>{error}</p>
              <button className="geme-action-btn secondary" onClick={handleRetry}>
                Try again
              </button>
            </div>
          )}
        </div>

        {!nextStep && (
          <div className="geme-composer">
            <textarea
              ref={inputRef}
              className="geme-input"
              placeholder="Take your time..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              aria-label="Your reply to Geme"
              rows={2}
            />
            <button
              className="geme-send-btn"
              onClick={handleSend}
              disabled={isStreaming || !draft.trim()}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
