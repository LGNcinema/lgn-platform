import { useEffect, useId, useMemo, useState } from 'react';
import './StoryReflect.css';
import type { CapsuleDetail } from '../../types';
import { DimensionSections } from './DimensionSections';
import { copyToClipboard } from './clipboard';
import { byDimension, DIMENSIONS, formatStoryMonth, type Dimension } from './campfire';

interface Props {
  capsule: CapsuleDetail;
}

/** The question(s) for a circle: a reflection's `content`, or its title when
 *  that's all the admin filled in. "Reflection 2:"-style names are dropped. */
function questionOf(r: { title?: string; content?: string }): string {
  return r.content?.trim() || (r.title?.trim() ?? '').replace(/^reflection\s*\d+\s*[:.\-–—]?\s*$/i, '');
}

/**
 * What "Copy" puts on the clipboard: the story, the circle, its
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


/**
 * Right column of Reflect. Figma v3: "Campfire—reflect".
 *
 * PRIVACY -- the page promises "nothing you write is saved", so this component
 * makes NO network request with the visitor's text and stores nothing: answers
 * live in memory while the page is open (so opening another row keeps them),
 * and "Copy" puts one on the visitor's own clipboard. Anyone changing this:
 * keep it that way, or change the copy first.
 */
export function StoryReflect({ capsule }: Props) {
  const groups = useMemo(() => byDimension(capsule.reflections ?? []), [capsule.reflections]);
  const [answers, setAnswers] = useState<Partial<Record<Dimension, string>>>({});
  useEffect(() => setAnswers({}), [capsule.id]);

  return (
    <DimensionSections
      variant="reflect"
      resetKey={capsule.id}
      renderBody={(dimension) => (
        <ReflectAnswer
          key={`${capsule.id}-${dimension}`}
          text={answers[dimension] ?? ''}
          onChange={(text) => setAnswers((prev) => ({ ...prev, [dimension]: text }))}
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
  text: string;
  onChange: (text: string) => void;
  title: string;
  month: string;
  dimension: Dimension;
  questions: string[];
}

/** One circle's question, the visitor's box, and "Copy" -- which turns into
 *  "Copied! Paste it somewhere safe—" until they type again (Figma popup 9). */
function ReflectAnswer({ text, onChange, title, month, dimension, questions }: AnswerProps) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const fieldId = useId();

  return (
    <div className="reflect-answer">
      {questions.length > 0 ? (
        <div className="reflect-questions">
          {questions.map((q, i) => (
            <p key={i}>
              <label htmlFor={i === 0 ? fieldId : undefined}>{q}</label>
            </p>
          ))}
        </div>
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
          onChange(e.target.value);
          setCopied('idle');
        }}
      />

      <div className="reflect-actions">
        {copied === 'copied' ? (
          <span className="lgn-btn reflect-copied" role="status">
            Copied! Paste it somewhere safe—
          </span>
        ) : (
          <button
            type="button"
            className="lgn-btn reflect-save"
            onClick={async () => {
              const ok = await copyToClipboard(buildCopy(title, month, dimension, questions, text));
              setCopied(ok ? 'copied' : 'failed');
            }}
          >
            Copy
          </button>
        )}
        {copied === 'failed' && (
          <span className="reflect-status" role="status">
            It couldn’t be copied automatically. Select your text to copy it.
          </span>
        )}
      </div>
    </div>
  );
}
