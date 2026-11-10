/**
 * A set of questions, edited the way it is read: Reflect and Practice as two
 * tabs, each ONE form with a slot per circle (Self, Neighbor, World) and one
 * Save. Used for a film's own (LGN) questions and for the universal set.
 *
 * An emptied slot is a removed question: Save sends the slots that have text and
 * the server makes that the whole set (see PUT /api/admin/.../prompts/{kind}).
 */
import { useId, useMemo, useState } from 'react';
import { DIMENSIONS } from '../../components/campfire/campfire';
import type { PromptKind } from '../../components/beyond/beyond';
import { adminFetch } from '../adminClient';
import { SaveBar, TextArea, TextField } from '../panels/Fields';
import { orNull, useEditState, useSaveState } from '../panels/formState';
import type { AdminPrompt } from './filmsTypes';

type Saved = () => void | Promise<void>;
type Draft = Record<string, string>;

const KINDS: { kind: PromptKind; label: string; noun: string }[] = [
  { kind: 'reflect', label: 'Reflect', noun: 'questions' },
  { kind: 'practice', label: 'Practice', noun: 'actions' },
];

/** Which text boxes a slot has: a question is one box; an action has three. */
const FIELDS: Record<PromptKind, ('content' | 'title' | 'steps' | 'tips')[]> = {
  reflect: ['content'],
  practice: ['title', 'steps', 'tips'],
};

/** One value per box, keyed `<circle>_<field>`. The first saved row of a circle fills it. */
function toDraft(kind: PromptKind, rows: AdminPrompt[]): Draft {
  const draft: Draft = {};
  for (const { key } of DIMENSIONS) {
    const row = rows.find((r) => r.kind === kind && r.dimension === key);
    for (const field of FIELDS[kind]) draft[`${key}_${field}`] = row?.[field] ?? '';
  }
  return draft;
}

type Built = { items: Record<string, unknown>[] } | { error: string };

/** The slots that have text, ready to send; or what is wrong with the form. */
function toItems(kind: PromptKind, draft: Draft): Built {
  const items: Record<string, unknown>[] = [];
  for (const { key, label } of DIMENSIONS) {
    if (kind === 'reflect') {
      const content = draft[`${key}_content`].trim();
      if (content) items.push({ dimension: key, content });
      continue;
    }
    const title = draft[`${key}_title`].trim();
    const steps = draft[`${key}_steps`].trim();
    const tips = draft[`${key}_tips`].trim();
    if (steps) items.push({ dimension: key, title: orNull(title), steps, tips: orNull(tips) });
    else if (title || tips) return { error: `${label}: add at least one step, or clear its other boxes.` };
  }
  return { items };
}

interface SetProps {
  kind: PromptKind;
  /** Every saved row of the set being edited (both kinds); this picks its own. */
  saved: AdminPrompt[];
  /** Where Save goes: the whole set for this kind. */
  endpoint: string;
  /** The universal set, shown as a hint in an empty Reflect slot. */
  universal?: AdminPrompt[];
  /** The AI draft rows (both kinds), to start from. */
  ai?: AdminPrompt[];
  /** The universal set: it can be rewritten, never emptied. */
  isUniversal?: boolean;
  onSaved: Saved;
}

function QuestionSet({ kind, saved, endpoint, universal = [], ai = [], isUniversal = false, onSaved }: SetProps) {
  const { noun } = KINDS.find((k) => k.kind === kind)!;
  const reflect = kind === 'reflect';
  const rows = useMemo(() => saved.filter((r) => r.kind === kind), [saved, kind]);
  const draftAi = useMemo(() => ai.filter((r) => r.kind === kind), [ai, kind]);
  const incoming = useMemo(() => toDraft(kind, rows), [kind, rows]);

  const { draft, dirty, set, setMany, reset, commit } = useEditState(incoming);
  const save = useSaveState();
  const [fromAi, setFromAi] = useState(false);

  const written = DIMENSIONS.filter((d) => rows.some((r) => r.dimension === d.key));
  const missing = DIMENSIONS.filter((d) => !written.includes(d));
  // Rows past the first in a circle (made through the API) have no slot here.
  const extras = rows.length - written.length;

  let status: string;
  if (isUniversal) status = `Shown for every film until LGN writes its own ${noun}.`;
  else if (rows.length === 0)
    status = `Nothing written yet, so visitors see the universal ${noun}${draftAi.length ? ', with the AI draft as an alternative' : ''}.`;
  else
    status = `Visitors see only LGN’s ${noun} here${missing.length ? `. ${missing.map((m) => m.label).join(' and ')} will read “still being written”` : ''}.`;

  const onSave = () => {
    const built = toItems(kind, draft);
    if ('error' in built) return save.fail(built.error);
    if (isUniversal && built.items.length === 0)
      return save.fail('The universal set can’t be empty: films without their own questions use it.');
    void save.run(async () => {
      await adminFetch(endpoint, { method: 'PUT', body: { items: built.items } });
      commit(draft);
      setFromAi(false);
      await onSaved();
    });
  };

  return (
    <form
      className="fa-set"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) onSave();
      }}
    >
      <p className="fa-status">{status}</p>

      {DIMENSIONS.map(({ key, label }) => {
        if (reflect) {
          const hint = universal.find((r) => r.kind === 'reflect' && r.dimension === key)?.content;
          return (
            <TextArea
              key={key}
              label={label}
              rows={3}
              value={draft[`${key}_content`]}
              onChange={(v) => set(`${key}_content`, v)}
              placeholder={!isUniversal && hint ? `Universal: ${hint}` : undefined}
            />
          );
        }
        return (
          <fieldset key={key} className="fa-circle">
            <legend className="apnl-label">{label}</legend>
            <div className="fa-circle-fields">
              <TextField label="Title" value={draft[`${key}_title`]} onChange={(v) => set(`${key}_title`, v)} />
              <TextArea
                label="Steps"
                rows={4}
                help="One step per line."
                value={draft[`${key}_steps`]}
                onChange={(v) => set(`${key}_steps`, v)}
              />
              <TextField label="Tip" value={draft[`${key}_tips`]} onChange={(v) => set(`${key}_tips`, v)} />
            </div>
          </fieldset>
        );
      })}

      {draftAi.length > 0 && (
        <p className="fa-ai">
          The AI wrote a draft.{' '}
          <button
            type="button"
            className="apnl-btn apnl-btn--link"
            onClick={() => {
              setMany(toDraft(kind, draftAi));
              setFromAi(true);
              save.clearError();
            }}
          >
            Start from it
          </button>
          {fromAi && ' It’s filled in above: edit it, then Save.'}
        </p>
      )}
      {extras > 0 && (
        <p className="fa-status">
          {extras} more {extras === 1 ? 'item' : 'items'} in a circle {extras === 1 ? 'isn’t' : 'aren’t'} shown here;
          saving removes {extras === 1 ? 'it' : 'them'}.
        </p>
      )}

      <SaveBar
        dirty={dirty}
        save={save}
        saveLabel="Save"
        onSave={onSave}
        onReset={() => {
          reset();
          setFromAi(false);
          save.clearError();
        }}
      />
      {!isUniversal && rows.length > 0 && (
        <p className="fa-hint">Clear all three and Save to go back to the universal {noun}.</p>
      )}
    </form>
  );
}

interface Props {
  /** The saved rows being edited (LGN's set for a film, or the universal set). */
  saved: AdminPrompt[];
  /** Where a kind's Save goes. */
  endpointFor: (kind: PromptKind) => string;
  universal?: AdminPrompt[];
  ai?: AdminPrompt[];
  isUniversal?: boolean;
  onSaved: Saved;
}

export function QuestionSets({ saved, endpointFor, universal, ai, isUniversal = false, onSaved }: Props) {
  const [tab, setTab] = useState<PromptKind>('reflect');
  const id = useId();

  return (
    <div className="fa-sets">
      <div className="admin-tabs fa-kind-tabs" role="tablist" aria-label="Question type">
        {KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            role="tab"
            id={`${id}-${kind}-tab`}
            aria-controls={`${id}-${kind}`}
            aria-selected={tab === kind}
            className={`admin-tab${tab === kind ? ' is-active' : ''}`}
            onClick={() => setTab(kind)}
          >
            {label}
            {!isUniversal && saved.some((r) => r.kind === kind) && <span className="fa-pill fa-pill--on">LGN</span>}
          </button>
        ))}
      </div>
      {/* Both stay mounted, so switching tabs never drops what was typed. */}
      {KINDS.map(({ kind }) => (
        <div
          key={kind}
          role="tabpanel"
          id={`${id}-${kind}`}
          aria-labelledby={`${id}-${kind}-tab`}
          hidden={tab !== kind}
        >
          <QuestionSet
            kind={kind}
            saved={saved}
            endpoint={endpointFor(kind)}
            universal={universal}
            ai={ai}
            isUniversal={isUniversal}
            onSaved={onSaved}
          />
        </div>
      ))}
    </div>
  );
}
