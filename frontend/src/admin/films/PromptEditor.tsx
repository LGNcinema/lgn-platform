/**
 * Editing a film's questions and actions, by circle. Used for LGN's own set,
 * the AI set (edit and delete only) and the universal set. Reflect rows hold a
 * question; Practice rows a title, steps (one per line) and a tip.
 */
import { useState } from 'react';
import { DIMENSIONS } from '../../components/campfire/campfire';
import type { Dimension } from '../../types';
import type { PromptKind } from '../../components/beyond/beyond';
import { adminFetch } from '../adminClient';
import { Alert, DeleteControl, Note, SaveBar, SelectField, TextArea, TextField } from '../panels/Fields';
import { orNull, str, useDirtyRegistration, useEditState, useSaveState } from '../panels/formState';
import type { AdminPrompt } from './filmsTypes';

type Changed = () => void | Promise<void>;

const KIND_LABEL: Record<PromptKind, string> = { reflect: 'Reflect', practice: 'Practice' };
const DIM_OPTIONS = DIMENSIONS.map((d) => ({ value: d.key, label: d.label }));

function PromptCard({ prompt, onChanged }: { prompt: AdminPrompt; onChanged: Changed }) {
  const { draft, dirty, set, reset, commit } = useEditState({
    dimension: prompt.dimension as string,
    title: str(prompt.title),
    content: str(prompt.content),
    steps: str(prompt.steps),
    tips: str(prompt.tips),
  });
  const save = useSaveState();
  const remove = useSaveState();
  const reflect = prompt.kind === 'reflect';

  const onSave = () => {
    if (reflect ? !draft.content.trim() : !draft.steps.trim()) {
      save.fail(reflect ? 'The question can’t be empty.' : 'Add at least one step.');
      return;
    }
    void save.run(async () => {
      await adminFetch(`/api/admin/film-prompts/${prompt.id}`, {
        method: 'PATCH',
        body: reflect
          ? { dimension: draft.dimension, content: draft.content }
          : { dimension: draft.dimension, title: orNull(draft.title), steps: draft.steps, tips: orNull(draft.tips) },
      });
      commit(draft);
      await onChanged();
    });
  };

  return (
    <article className="apnl-item">
      <div className="apnl-item-head">
        <h4 className="apnl-item-name">{KIND_LABEL[prompt.kind]}</h4>
        <span className="apnl-item-id">id {prompt.id}</span>
      </div>
      <SelectField
        label="Circle"
        value={draft.dimension as Dimension}
        options={DIM_OPTIONS}
        onChange={(v) => set('dimension', v)}
      />
      {reflect ? (
        <TextArea label="Question" rows={3} required value={draft.content} onChange={(v) => set('content', v)} />
      ) : (
        <>
          <TextField label="Title" value={draft.title} onChange={(v) => set('title', v)} />
          <TextArea
            label="Steps"
            rows={5}
            required
            help="One step per line."
            value={draft.steps}
            onChange={(v) => set('steps', v)}
          />
          <TextArea label="Tip" rows={2} value={draft.tips} onChange={(v) => set('tips', v)} />
        </>
      )}
      {remove.error ? <Alert>{remove.error}</Alert> : null}
      <SaveBar
        dirty={dirty}
        save={save}
        onSave={onSave}
        onReset={reset}
        extra={
          <DeleteControl
            label="Delete"
            question="Delete this permanently?"
            busy={remove.saving}
            onConfirm={() =>
              void remove.run(async () => {
                await adminFetch(`/api/admin/film-prompts/${prompt.id}`, { method: 'DELETE' });
                await onChanged();
              })
            }
          />
        }
      />
    </article>
  );
}

function NewPrompt({
  tmdbId,
  kind,
  dimension,
  onChanged,
}: {
  tmdbId: number | null;
  kind: PromptKind;
  dimension: Dimension;
  onChanged: Changed;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [steps, setSteps] = useState('');
  const [tips, setTips] = useState('');
  const save = useSaveState();
  const reflect = kind === 'reflect';
  const touched = Boolean(content || steps || title || tips);
  useDirtyRegistration(open && touched);

  const clear = () => {
    setTitle('');
    setContent('');
    setSteps('');
    setTips('');
  };

  if (!open) {
    return (
      <button type="button" className="apnl-btn" onClick={() => setOpen(true)}>
        + Add {reflect ? 'question' : 'action'}
      </button>
    );
  }

  return (
    <article className="apnl-item apnl-item--new">
      {reflect ? (
        <TextArea label="Question" rows={3} required value={content} onChange={setContent} />
      ) : (
        <>
          <TextField label="Title" value={title} onChange={setTitle} />
          <TextArea label="Steps" rows={4} required help="One step per line." value={steps} onChange={setSteps} />
          <TextArea label="Tip" rows={2} value={tips} onChange={setTips} />
        </>
      )}
      {save.error ? <Alert>{save.error}</Alert> : null}
      <div className="apnl-savebar">
        <button
          type="button"
          className="apnl-btn apnl-btn--primary"
          disabled={save.saving || !(reflect ? content.trim() : steps.trim())}
          onClick={() =>
            void save.run(async () => {
              await adminFetch('/api/admin/film-prompts', {
                method: 'POST',
                body: {
                  tmdb_id: tmdbId,
                  kind,
                  dimension,
                  title: orNull(title),
                  content: reflect ? content : null,
                  steps: reflect ? null : steps,
                  tips: orNull(tips),
                },
              });
              clear();
              setOpen(false);
              await onChanged();
            })
          }
        >
          {save.saving ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          className="apnl-btn apnl-btn--ghost"
          disabled={save.saving}
          onClick={() => {
            clear();
            setOpen(false);
          }}
        >
          Cancel
        </button>
      </div>
    </article>
  );
}

/**
 * Reflect, then Practice, each by circle. `tmdbId` null edits the universal
 * set. `canAdd` is off for the AI set (LGN edits what the AI wrote; it doesn't
 * hand-add to it).
 */
export function PromptGroups({
  prompts,
  tmdbId,
  canAdd,
  onChanged,
}: {
  prompts: AdminPrompt[];
  tmdbId: number | null;
  canAdd: boolean;
  onChanged: Changed;
}) {
  return (
    <>
      {(['reflect', 'practice'] as const).map((kind) => {
        const ofKind = prompts.filter((p) => p.kind === kind);
        const missing = DIMENSIONS.filter((d) => !ofKind.some((p) => p.dimension === d.key));
        return (
          <div key={kind} className="fa-kind">
            <h3 className="apnl-section-title">{KIND_LABEL[kind]}</h3>
            {ofKind.length > 0 && missing.length > 0 && (
              <Note>
                This {KIND_LABEL[kind]} set has nothing for {missing.map((d) => d.label).join(' and ')}. Visitors see
                only the circles that are written, and the set is never mixed with the universal one.
              </Note>
            )}
            {DIMENSIONS.map(({ key, label }) => (
              <div key={key} className="fa-dim">
                <h4 className="fa-dim-title">{label}</h4>
                <div className="apnl-list">
                  {ofKind
                    .filter((p) => p.dimension === key)
                    .map((p) => (
                      <PromptCard key={p.id} prompt={p} onChanged={onChanged} />
                    ))}
                  {canAdd && <NewPrompt tmdbId={tmdbId} kind={kind} dimension={key} onChanged={onChanged} />}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
