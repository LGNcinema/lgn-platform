import { useEffect, useId, useMemo, useState } from 'react';
import './StoryReflect.css';
import type { CapsuleDetail } from '../../types';
import { DimensionSections } from './DimensionSections';
import { byDimension, type Dimension } from './campfire';

interface Props {
  capsule: CapsuleDetail;
}

/** One answer per film and circle. */
const answerKey = (capsuleId: number, dimension: Dimension) => `campfire_reflect_${capsuleId}_${dimension}`;
/** V2 kept a single box per film; it carries over as the Self answer. */
const legacyDraftKey = (capsuleId: number) => `campfire_reflect_draft_${capsuleId}`;

// Every storage access is wrapped: localStorage throws outright (not just
// returns null) in some privacy modes and with site data blocked, and an
// answer is a convenience that must never take the page down.
function readAnswer(capsuleId: number, dimension: Dimension): string {
  try {
    const saved = localStorage.getItem(answerKey(capsuleId, dimension));
    if (saved !== null) return saved;
    return dimension === 'self' ? localStorage.getItem(legacyDraftKey(capsuleId)) ?? '' : '';
  } catch {
    return '';
  }
}

function writeAnswer(capsuleId: number, dimension: Dimension, text: string) {
  try {
    if (text) localStorage.setItem(answerKey(capsuleId, dimension), text);
    else localStorage.removeItem(answerKey(capsuleId, dimension));
  } catch {
    // Blocked or full storage: the text still lives in the textarea.
  }
}

/** The question(s) for a circle: a reflection's `content`, or its title when
 *  that's all the admin filled in. "Reflection 2:"-style names are dropped. */
function questionOf(r: { title?: string; content?: string }): string {
  return r.content?.trim() || (r.title?.trim() ?? '').replace(/^reflection\s*\d+\s*[:.\-–—]?\s*$/i, '');
}

/**
 * Right column of Reflect. Figma v3: "Campfire—reflect".
 *
 * PRIVACY -- a promise made on the page, not a style choice. "Your
 * reflections are private. Only you can see them." is only true if the
 * visitor's text never leaves the device, so this component makes NO network
 * request with it: no submission, no analytics, nothing. Answers live in this
 * browser's localStorage only. Anyone changing this: keep it that way, or
 * change the copy first.
 */
export function StoryReflect({ capsule }: Props) {
  const groups = useMemo(() => byDimension(capsule.reflections ?? []), [capsule.reflections]);

  // The admin's framing note (written once, on the first reflection).
  const intro = (capsule.reflections ?? []).find((r) => r.introduction?.trim())?.introduction?.trim();

  return (
    <DimensionSections
      variant="reflect"
      resetKey={capsule.id}
      intro={
        <>
          <p>
            {intro ||
              `After viewing ${capsule.title}, here are a few questions to help you reflect on what you just watched: for yourself, for your neighbor, and for the world.`}
          </p>
          <p>Your reflections are private. Only you can see them.</p>
        </>
      }
      renderBody={(dimension) => (
        <ReflectAnswer
          key={`${capsule.id}-${dimension}`}
          capsuleId={capsule.id}
          dimension={dimension}
          questions={groups[dimension].map(questionOf).filter(Boolean)}
        />
      )}
    />
  );
}

function ReflectAnswer({ capsuleId, dimension, questions }: { capsuleId: number; dimension: Dimension; questions: string[] }) {
  const [text, setText] = useState(() => readAnswer(capsuleId, dimension));
  const [saved, setSaved] = useState(false);
  const fieldId = useId();

  useEffect(() => {
    setText(readAnswer(capsuleId, dimension));
    setSaved(false);
  }, [capsuleId, dimension]);

  return (
    <div className="reflect-answer">
      {questions.length > 0 ? (
        <ol className="reflect-questions">
          {questions.map((q, i) => (
            <li key={i}>
              <label htmlFor={i === 0 ? fieldId : undefined}>{q}</label>
            </li>
          ))}
        </ol>
      ) : (
        <p className="reflect-questions">
          <label htmlFor={fieldId}>This question is still being written. Write freely in the meantime.</label>
        </p>
      )}

      <textarea
        id={fieldId}
        className="lgn-field lgn-field--quiet reflect-field"
        placeholder="Write it out if it helps..."
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
          // Kept as they type, so leaving for Watch or Practice loses nothing.
          writeAnswer(capsuleId, dimension, e.target.value);
        }}
      />

      <div className="reflect-actions">
        <button
          type="button"
          className="lgn-btn reflect-save"
          onClick={() => {
            writeAnswer(capsuleId, dimension, text);
            setSaved(true);
          }}
        >
          {saved ? 'Saved' : 'Save my answer'}
        </button>
        <span className="reflect-status" role="status">
          {saved ? 'Kept on this device, for you only.' : ''}
        </span>
      </div>
    </div>
  );
}
