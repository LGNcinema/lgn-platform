import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './StoryReflect.css';
import type { CapsuleDetail, Reflection } from '../../types';

interface Props {
  capsule: CapsuleDetail;
}

/** One numbered prompt, ready to render and to write into the kept copy. */
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

/** Plain text, CRLF-free, so it opens cleanly in any editor or notes app. */
function buildCopy(storyTitle: string, prompts: Prompt[], text: string): string {
  const lines = [storyTitle, ''];
  if (prompts.length) {
    // Label on its own line, question indented under it -- reads like the
    // page's numbered list rather than one run-on line per prompt.
    prompts.forEach((p, i) => {
      if (p.label) lines.push(`${i + 1}. ${p.label}`, `   ${p.question}`, '');
      else lines.push(`${i + 1}. ${p.question}`, '');
    });
  }
  lines.push(text.trim() ? text.trimEnd() : '(Nothing written yet.)', '');
  return lines.join('\n');
}

const fileNameFor = (storyTitle: string) => {
  const slug = storyTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'story'}-reflection.txt`;
};

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
 *   - "Keep a copy", which hands the visitor a .txt download built from a
 *     local Blob URL.
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
  const [kept, setKept] = useState(false);
  const textareaId = useId();
  const keptTimer = useRef<number | undefined>(undefined);

  // The same component instance can be handed a different capsule (e.g. the
  // storyboard switching stories) -- load that story's draft, not this one's.
  useEffect(() => {
    setText(readDraft(capsule.id));
    setKept(false);
  }, [capsule.id]);

  useEffect(() => () => window.clearTimeout(keptTimer.current), []);

  const handleChange = (value: string) => {
    setText(value);
    setKept(false);
    writeDraft(capsule.id, value);
  };

  const handleKeepCopy = () => {
    const blob = new Blob([buildCopy(capsule.title, prompts, text)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileNameFor(capsule.title);
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick: some browsers start the download asynchronously
    // and a synchronous revoke cancels it.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);

    setKept(true);
    window.clearTimeout(keptTimer.current);
    keptTimer.current = window.setTimeout(() => setKept(false), 4000);
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
        <button type="button" className="story-reflect-keep" onClick={handleKeepCopy}>
          Keep a copy
        </button>
        {/* Announced to screen readers too; the download itself is silent. */}
        <span className="story-reflect-status" role="status">
          {kept ? 'Saved to your device as a text file.' : ''}
        </span>
      </div>
    </div>
  );
}
