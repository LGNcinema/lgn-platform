import { useEffect, useId, useMemo, useState } from 'react';
import './StoryReflect.css';
import type { CapsuleDetail, Reflection } from '../../types';

interface Props {
  capsule: CapsuleDetail;
}

/** One numbered prompt, ready to render and to write into the copied text. */
interface Prompt {
  id: number;
  /** The reflection's own name, minus any "Reflection 2:" numbering -- the
   *  list numbers prompts itself, so a stored prefix would read "2. Reflection 2: ...". */
  label: string;
  question: string;
}

/**
 * Same fallback the old CapsuleReflect used: the question lives in `content`,
 * but an admin who only filled in `title` still gets a prompt rather than a
 * blank line. Reflections with neither are dropped instead of rendering an
 * empty number.
 */
function toPrompts(reflections: Reflection[]): Prompt[] {
  return reflections.flatMap((r) => {
    const title = r.title?.trim() ?? '';
    const question = r.content?.trim() || title;
    if (!question) return [];
    const label = title.replace(/^reflection\s*\d+\s*[:.\-–—]\s*/i, '');
    return [{ id: r.id, label: label === question ? '' : label, question }];
  });
}

/**
 * The draft is keyed per capsule, not per reflection: the Campfire design has
 * one free-writing box for the whole story, not one per prompt.
 * The "campfire_" prefix keeps it clear of the retired per-question
 * `reflect_<capsule>_<reflection>` keys, which held a different shape.
 */
const draftKey = (capsuleId: number) => `campfire_reflect_draft_${capsuleId}`;

// Every storage access is wrapped: localStorage throws outright (not just
// returns null) in some privacy modes and with site data blocked, and a draft
// is a convenience that must never take the page down.
function readDraft(capsuleId: number): string {
  try {
    return localStorage.getItem(draftKey(capsuleId)) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(capsuleId: number, text: string) {
  try {
    if (text) localStorage.setItem(draftKey(capsuleId), text);
    else localStorage.removeItem(draftKey(capsuleId));
  } catch {
    // Blocked or full storage: the text still lives in the textarea.
  }
}

/** "2026-07" -> "July 2026". The month is a calendar label, not an instant, so
 *  it is formatted from its parts -- no Date, no timezone to shift it a month. */
function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  return names[m - 1] && year ? `${names[m - 1]} ${year}` : month;
}

/**
 * The text "Take it with you." puts on the clipboard: the story, its prompts,
 * the visitor's own words, and where it came from. Plain text so it pastes
 * cleanly into notes, email or a journal.
 *
 *   Lightpoles
 *   LGN · July 2026
 *
 *   Reflection questions:
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
function buildCopy(capsule: CapsuleDetail, prompts: Prompt[], text: string): string {
  const lines = [capsule.title, `LGN · ${monthLabel(capsule.month)}`, ''];
  if (prompts.length) {
    lines.push('Reflection questions:');
    prompts.forEach((p, i) => lines.push(`${i + 1}. ${p.question}`));
    lines.push('');
  }
  lines.push('My reflection:', text.trim() ? text.trim() : '(Nothing written yet.)', '');
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
 * Right column of the Reflect section.
 * Figma: [CAMPFIRE]-REFLECT.
 *
 * PRIVACY -- a promise made on the page, not a style choice. "Your reflections
 * are private. Only you can see them." is only true if the visitor's text never
 * leaves the device, so this component makes NO network request with it: no
 * /api/submissions/reflection, no analytics, nothing. The two places the text
 * goes are both on-device:
 *   - a draft in localStorage, so leaving for Watch/Practice (which unmounts
 *     this component) doesn't lose it;
 *   - "Take it with you.", which copies it to the visitor's own clipboard.
 * Anyone changing this: keep it that way, or change the copy first.
 */
export function StoryReflect({ capsule }: Props) {
  const prompts = useMemo(() => toPrompts(capsule.reflections ?? []), [capsule.reflections]);

  // The frame's heading is a lead-in line above the prompts. The reflection
  // introduction is exactly that (the admin writes it once, on the first
  // reflection, as the section's framing note), so it's the natural source.
  // Without one, fall back to the section name so the column still has a heading.
  const intro = (capsule.reflections ?? []).find((r) => r.introduction?.trim())?.introduction?.trim();

  const [text, setText] = useState(() => readDraft(capsule.id));
  // 'copied' holds until the visitor edits again, so the button keeps saying
  // the copy is theirs; 'failed' asks them to copy by hand.
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const textareaId = useId();

  // The same component instance can be handed a different capsule (e.g. the
  // storyboard switching stories) -- load that story's draft, not this one's.
  useEffect(() => {
    setText(readDraft(capsule.id));
    setCopyState('idle');
  }, [capsule.id]);

  const handleChange = (value: string) => {
    setText(value);
    setCopyState('idle');
    writeDraft(capsule.id, value);
  };

  const handleTakeIt = async () => {
    const ok = await copyToClipboard(buildCopy(capsule, prompts, text));
    setCopyState(ok ? 'copied' : 'failed');
  };

  return (
    <div className="story-reflect">
      <h2 className="story-reflect-heading">{intro || 'Reflect'}</h2>
      <p className="story-reflect-private">Your reflections are private. Only you can see them.</p>

      {prompts.length > 0 ? (
        <ol className="story-reflect-prompts">
          {prompts.map((p) => (
            <li key={p.id} className="story-reflect-prompt">
              {p.question}
            </li>
          ))}
        </ol>
      ) : (
        // No prompts yet: say so, but keep the writing box -- free writing
        // after a film is worth offering on its own.
        <p className="story-reflect-empty">
          This story&rsquo;s reflection prompts are still being written. Check back soon.
        </p>
      )}

      <label htmlFor={textareaId} className="story-reflect-sr-only">
        Your reflection (stays on this device)
      </label>
      <textarea
        id={textareaId}
        className="story-reflect-textarea"
        placeholder="Write it out if it helps."
        value={text}
        onChange={(e) => handleChange(e.target.value)}
      />

      <div className="story-reflect-actions">
        <button type="button" className="story-reflect-keep" onClick={handleTakeIt}>
          {copyState === 'copied' ? 'Copied. It\u2019s yours to keep.' : 'Take it with you.'}
        </button>
        {/* A changed button label isn't reliably announced, so screen readers
            get the outcome here; the failure note is visible to everyone. */}
        {copyState === 'failed' ? (
          <span className="story-reflect-status" role="status">
            Couldn&rsquo;t copy automatically &mdash; select your text and copy it.
          </span>
        ) : (
          <span className="story-reflect-sr-only" role="status">
            {copyState === 'copied' ? 'Copied to your clipboard.' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
