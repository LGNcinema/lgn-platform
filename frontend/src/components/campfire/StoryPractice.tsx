import { useEffect, useState } from 'react';
import './StoryPractice.css';
import type { CapsuleDetail, GemeTuning, Practice } from '../../types';
import { splitLines } from '../../filmInfo';
import { API_URL } from '../../api';
import { GemeChat } from '../GemeChat';

interface Props {
  capsule: CapsuleDetail;
  /** Pass-through for the dev-only Geme tuning panel. */
  gemeTuning: GemeTuning | null;
  gemeTuningVersion: number;
}

// The three engagement levels, in the order the CMS lists practices. There are
// exactly three names, so a story only ever shows three levels: anything past
// the third practice has no level to sit under and is left out (see LEVELS use).
const LEVELS = ['Gentle', 'Core', 'Brave'] as const;

/** The one-sentence invitation on a card: the first sentence of the first
 *  step. The frame's prompts are all a single sentence, while a CMS step line
 *  can run to several ("Bring one person to mind. Set a three-minute timer...").
 *  The full text is always one click away in the detail panel. */
function promptOf(practice: Practice): string {
  const first = splitLines(practice.steps)[0] ?? practice.description?.trim() ?? '';
  // Stop at the first . ! or ? that is followed by whitespace, so "e.g." style
  // abbreviations mid-word and a trailing quote don't cut the sentence short.
  const match = first.match(/^.+?[.!?](?=\s)/);
  return match ? match[0] : first;
}

/** Right column of the Practice section: three engagement levels, then Geme.
 *  Figma: [CAMPFIRE]-PRACTICE.
 *
 *  The frame only shows each level's one-line prompt. To read the whole
 *  practice (description + every step) a visitor opens a card: ONE detail
 *  panel drops in below the row rather than the card growing in place, so the
 *  three cards keep the frame's equal heights and the row never reflows. */
export function StoryPractice({ capsule, gemeTuning, gemeTuningVersion }: Props) {
  const levels = (capsule.practices ?? []).slice(0, LEVELS.length);

  const [openId, setOpenId] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  // null = still asking the server. The whole "None of these fit?" block stays
  // hidden until Geme is confirmed available, so it never flashes in and out.
  const [gemeEnabled, setGemeEnabled] = useState<boolean | null>(null);
  const [savedStep, setSavedStep] = useState<string | null>(null);

  // GemeChat writes the visitor's chosen next step under this key.
  const stepStorageKey = `geme_next_step_${capsule.id}`;

  // Only offer a conversation the server can actually hold.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/geme/status`)
      .then((res) => (res.ok ? res.json() : { enabled: false }))
      .then((data) => {
        if (!cancelled) setGemeEnabled(Boolean(data.enabled));
      })
      .catch(() => {
        if (!cancelled) setGemeEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A step kept from an earlier conversation lives in this browser only;
  // re-read it whenever the chat closes, since that's when it may have changed.
  useEffect(() => {
    if (chatOpen) return;
    try {
      setSavedStep(localStorage.getItem(stepStorageKey));
    } catch {
      setSavedStep(null);
    }
  }, [chatOpen, stepStorageKey]);

  // A different story's practices have different ids; don't carry an open
  // panel across stories.
  useEffect(() => setOpenId(null), [capsule.id]);

  const openPractice = levels.find((p) => p.id === openId);
  const panelId = `story-practice-detail-${capsule.id}`;

  return (
    <div className="story-practice">
      <h2 className="story-practice-heading">A Weekly Exercise in Rooting</h2>
      <p className="story-practice-subtitle">
        Three levels on engagement with our core practice. Find one that suits you best, or
        participate in multiple!
      </p>

      {levels.length > 0 && (
        <div className="story-practice-levels">
          {levels.map((practice, i) => {
            const open = practice.id === openId;
            return (
              <button
                key={practice.id}
                type="button"
                className={`story-practice-card${open ? ' open' : ''}`}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : practice.id)}
              >
                <span className="story-practice-card-head">
                  <span className="story-practice-label">
                    Engagement Level {String(i + 1).padStart(2, '0')}: {LEVELS[i]}
                  </span>
                  {/* The one mark the frame doesn't have: says the card opens.
                      Decorative -- aria-expanded carries the state. */}
                  <span className="story-practice-toggle" aria-hidden="true">
                    {open ? '−' : '+'}
                  </span>
                </span>
                <span className="story-practice-prompt">{promptOf(practice)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Always in the DOM (hidden when closed) so aria-controls points at a
          real element. */}
      <div id={panelId} className="story-practice-detail" hidden={!openPractice} aria-live="polite">
        {openPractice && (
          <>
            <h3 className="story-practice-detail-title">{openPractice.title}</h3>
            {openPractice.description?.trim() && (
              <p className="story-practice-detail-desc">{openPractice.description.trim()}</p>
            )}
            {/* splitLines, not split('\n'): seeded rows have historically stored
                the separator as a literal backslash-n. */}
            {splitLines(openPractice.steps).map((step, i) => (
              <p key={i} className="story-practice-detail-step">{step}</p>
            ))}
          </>
        )}
      </div>

      {gemeEnabled && (
        <section className="story-practice-geme" aria-labelledby="story-practice-geme-heading">
          <h2 id="story-practice-geme-heading" className="story-practice-heading">
            None of these fit?
          </h2>
          <div className="story-practice-geme-card">
            <img className="story-practice-geme-mascot" src="/images/geme.png" alt="Geme" />
            <span className="story-practice-label">Take It Inward</span>
            <h3 className="story-practice-geme-title">Talk It Through with Geme</h3>
            <p className="story-practice-geme-text">
              Explore what this film and this practice stirred in you. Geme will ask a few
              thoughtful questions, help you notice what matters to you, and help you name one
              small next step.
            </p>
            {/* Not in the frame: surfaces the step a visitor kept from an
                earlier chat. Renders only when one exists. */}
            {savedStep && (
              <p className="story-practice-geme-saved">
                <span className="story-practice-label">Your last step</span>
                {savedStep}
              </p>
            )}
            <button type="button" className="story-practice-geme-btn" onClick={() => setChatOpen(true)}>
              Talk with Geme
            </button>
          </div>
        </section>
      )}

      {chatOpen && (
        // Keyed on the tuning version so an Apply in the dev panel starts a
        // fresh conversation with the new settings from the first word.
        <GemeChat
          key={gemeTuningVersion}
          capsule={capsule}
          onClose={() => setChatOpen(false)}
          tuning={gemeTuning}
        />
      )}
    </div>
  );
}
