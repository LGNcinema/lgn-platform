import { useEffect, useId, useMemo, useState } from 'react';
import './StoryReflect.css';
import type { CapsuleDetail } from '../../types';
import { DimensionSections } from './DimensionSections';
import { byDimension, DIMENSIONS, formatStoryMonth, type Dimension } from './campfire';

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
 * What "Save my answer" puts on the clipboard: the story, the circle, its
 * questions, the visitor's own words, and where it came from. Plain text so it
 * pastes cleanly into notes, email or a journal.
 *
 *   Lightpoles
 *   LGN · JULY 2026 · Self
 *
 *   Questions:
 *   1. ...
 *
 *   My reflection:
 *   ...
 *
 *   Life > Numbers · <this site's address>
 *
 * The sign-off uses the site's own host rather than a fixed domain, so the
 * copy always points somewhere real -- localhost, a preview, or production.
 */
function buildCopy(title: string, month: string, dimension: Dimension, questions: string[], text: string): string {
  const circle = DIMENSIONS.find((d) => d.key === dimension)?.label ?? '';
  const lines = [title, `LGN · ${formatStoryMonth(month)} · ${circle}`, ''];
  if (questions.length) {
    lines.push(questions.length === 1 ? 'Question:' : 'Questions:');
    questions.forEach((q, i) => lines.push(questions.length === 1 ? q : `${i + 1}. ${q}`));
    lines.push('');
  }
  lines.push('My reflection:', text.trim() || '(Nothing written yet.)', '');
  lines.push(`Life > Numbers · ${window.location.host}`);
  return lines.join('\n');
}

/** Clipboard API where available; the old execCommand route as a fallback for
 *  browsers or contexts (plain-http LAN addresses) that don't expose it. */
async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Permission denied or unavailable -- try the fallback below.
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Right column of Reflect. Figma v3: "Campfire—reflect".
 *
 * PRIVACY -- a promise made on the page, not a style choice. "Your
 * reflections are private. Only you can see them." is only true if the
 * visitor's text never leaves the device, so this component makes NO network
 * request with it: no submission, no analytics, nothing. The two places it
 * goes are both on-device: this browser's localStorage, and -- on "Save my
 * answer" -- the visitor's own clipboard. Anyone changing this: keep it that way, or
 * change the copy first.
 */
export function StoryReflect({ capsule }: Props) {
  const groups = useMemo(() => byDimension(capsule.reflections ?? []), [capsule.reflections]);

  // One introduction for the whole tab (the admin's Reflect introduction), or,
  // for stories written before it existed, the first reflection's.
  const intro =
    capsule.reflect_intro?.trim() ||
    (capsule.reflections ?? []).find((r) => r.introduction?.trim())?.introduction?.trim();

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
          title={capsule.title}
          month={capsule.month}
          dimension={dimension}
          questions={groups[dimension].map(questionOf).filter(Boolean)}
        />
      )}
    />
  );
}

interface AnswerProps {
  capsuleId: number;
  title: string;
  month: string;
  dimension: Dimension;
  questions: string[];
}

function ReflectAnswer({ capsuleId, title, month, dimension, questions }: AnswerProps) {
  const [text, setText] = useState(() => readAnswer(capsuleId, dimension));
  // Holds until the visitor edits again. 'failed' means it was kept on the
  // device but couldn't be copied, so they're asked to copy it by hand.
  const [saved, setSaved] = useState<'idle' | 'copied' | 'failed'>('idle');
  const fieldId = useId();

  useEffect(() => {
    setText(readAnswer(capsuleId, dimension));
    setSaved('idle');
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
          setSaved('idle');
          // Kept as they type, so leaving for Watch or Practice loses nothing.
          writeAnswer(capsuleId, dimension, e.target.value);
        }}
      />

      <div className="reflect-actions">
        <button
          type="button"
          className="lgn-btn reflect-save"
          onClick={async () => {
            writeAnswer(capsuleId, dimension, text);
            const ok = await copyToClipboard(buildCopy(title, month, dimension, questions, text));
            setSaved(ok ? 'copied' : 'failed');
          }}
        >
          {saved === 'idle' ? 'Save my answer' : 'Saved'}
        </button>
        <span className="reflect-status" role="status">
          {saved === 'copied' && 'Kept on this device, and copied to your clipboard to take with you.'}
          {saved === 'failed' && 'Kept on this device. It couldn’t be copied automatically, so select your text to copy it.'}
        </span>
      </div>
    </div>
  );
}
