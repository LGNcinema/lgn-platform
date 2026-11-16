import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import './StoryReflect.css';
import type { CapsuleDetail } from '../../types';
import { DimensionSections } from './DimensionSections';
import { byDimension, DIMENSIONS, formatStoryMonth, type Dimension } from './campfire';

interface Props {
  capsule: CapsuleDetail;
}

/** One answer per film and circle: `${storageKey}_${dimension}`. */
const answerKey = (storageKey: string, dimension: Dimension) => `${storageKey}_${dimension}`;

// Every storage access is wrapped: localStorage throws outright (not just
// returns null) in some privacy modes and with site data blocked, and an
// answer is a convenience that must never take the page down.
function readAnswer(storageKey: string, dimension: Dimension, legacyKey?: string): string {
  try {
    const saved = localStorage.getItem(answerKey(storageKey, dimension));
    if (saved !== null) return saved;
    return dimension === 'self' && legacyKey ? localStorage.getItem(legacyKey) ?? '' : '';
  } catch {
    return '';
  }
}

function writeAnswer(storageKey: string, dimension: Dimension, text: string) {
  try {
    if (text) localStorage.setItem(answerKey(storageKey, dimension), text);
    else localStorage.removeItem(answerKey(storageKey, dimension));
  } catch {
    // Blocked or full storage: the text still lives in the textarea.
  }
}

/** The question(s) for a circle: a reflection's `content`, or its title when
 *  that's all the admin filled in. "Reflection 2:"-style names are dropped. */
function questionOf(r: { title?: string | null; content?: string | null }): string {
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
function buildCopy(title: string, meta: string, dimension: Dimension, questions: string[], text: string): string {
  const circle = DIMENSIONS.find((d) => d.key === dimension)?.label ?? '';
  const lines = [title, `${meta} · ${circle}`, ''];
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
  // One introduction for the whole tab (the admin's Reflect introduction), or,
  // for stories written before it existed, the first reflection's.
  const intro =
    capsule.reflect_intro?.trim() ||
    (capsule.reflections ?? []).find((r) => r.introduction?.trim())?.introduction?.trim();

  return (
    <ReflectSections
      resetKey={capsule.id}
      title={capsule.title}
      meta={`LGN · ${formatStoryMonth(capsule.month)}`}
      storageKey={`campfire_reflect_${capsule.id}`}
      // V2 kept a single box per film; it carries over as the Self answer.
      legacyKey={`campfire_reflect_draft_${capsule.id}`}
      reflections={capsule.reflections ?? []}
      intro={
        <p>
          {intro ||
            `After viewing ${capsule.title}, here are a few questions to help you reflect on what you just watched: for yourself, for your neighbor, and for the world.`}
        </p>
      }
    />
  );
}

export interface ReflectItem {
  dimension?: Dimension | null;
  title?: string | null;
  content?: string | null;
}

interface SectionsProps {
  /** Resets the open circle when it changes (a different film or question set). */
  resetKey: string | number;
  /** The first two lines of "Save my answer": the film, then where it's from. */
  title: string;
  meta: string;
  /** localStorage key stem. Answers live under `${storageKey}_${dimension}`;
   *  each caller picks its own stem so films can never collide. */
  storageKey: string;
  legacyKey?: string;
  /** The copy above the three circles ("private" line is added here). */
  intro: ReactNode;
  reflections: ReflectItem[];
}

/**
 * Reflect's three circles on plain data, shared by a monthly story and any
 * other film. Same privacy promise as above: nothing here touches the network.
 */
export function ReflectSections({ resetKey, title, meta, storageKey, legacyKey, intro, reflections }: SectionsProps) {
  const groups = useMemo(() => byDimension(reflections), [reflections]);
  return (
    <DimensionSections
      variant="reflect"
      resetKey={resetKey}
      intro={
        <>
          {intro}
          <p>Your reflections are private. Only you can see them.</p>
        </>
      }
      renderBody={(dimension) => (
        <ReflectAnswer
          key={`${storageKey}-${dimension}`}
          storageKey={storageKey}
          legacyKey={legacyKey}
          title={title}
          meta={meta}
          dimension={dimension}
          questions={groups[dimension].map(questionOf).filter(Boolean)}
        />
      )}
    />
  );
}

interface AnswerProps {
  storageKey: string;
  legacyKey?: string;
  title: string;
  meta: string;
  dimension: Dimension;
  questions: string[];
}

function ReflectAnswer({ storageKey, legacyKey, title, meta, dimension, questions }: AnswerProps) {
  const [text, setText] = useState(() => readAnswer(storageKey, dimension, legacyKey));
  // Holds until the visitor edits again. 'failed' means it was kept on the
  // device but couldn't be copied, so they're asked to copy it by hand.
  const [saved, setSaved] = useState<'idle' | 'copied' | 'failed'>('idle');
  const fieldId = useId();

  useEffect(() => {
    setText(readAnswer(storageKey, dimension, legacyKey));
    setSaved('idle');
  }, [storageKey, legacyKey, dimension]);

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
          writeAnswer(storageKey, dimension, e.target.value);
        }}
      />

      <div className="reflect-actions">
        <button
          type="button"
          className="lgn-btn reflect-save"
          onClick={async () => {
            writeAnswer(storageKey, dimension, text);
            const ok = await copyToClipboard(buildCopy(title, meta, dimension, questions, text));
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
