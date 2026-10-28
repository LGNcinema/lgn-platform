/**
 * StoryFieldsForm -- a small editor for a few story-level (capsule) fields,
 * saved on their own. Used where a tab needs one or two of the story's own
 * fields next to its other content: "Before the film" on Watch, the
 * introduction on Reflect, the title on Practice.
 *
 * It PATCHes only its own keys, so it never overwrites a field another panel
 * owns.
 */
import { useId, useMemo } from 'react';
import type { CapsuleDetail } from '../../types';
import { adminFetch } from '../adminClient';
import { SaveBar, Section, TextArea, TextField } from './Fields';
import type { PanelProps } from './Fields';
import { orNull, str, useEditState, useSaveState } from './formState';

export type StoryTextKey = 'pre_watch_prompt' | 'pre_watch_supporting_text' | 'reflect_intro' | 'practice_title';

export interface StoryFieldSpec {
  key: StoryTextKey;
  label: string;
  /** Rows for a textarea; omit for a one-line field. */
  rows?: number;
  help?: string;
  placeholder?: string;
}

interface Props extends PanelProps {
  title: string;
  fields: StoryFieldSpec[];
}

type Draft = Record<string, string>;

export function StoryFieldsForm({ capsule, onSaved, title, fields }: Props) {
  const keys = fields.map((f) => f.key).join(',');
  const incoming = useMemo(() => {
    const out: Draft = {};
    for (const f of fields) out[f.key] = str((capsule as CapsuleDetail)[f.key]);
    return out;
    // Recomputed when any of this form's own values changes on the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, ...fields.map((f) => (capsule as CapsuleDetail)[f.key])]);
  const { draft, dirty, set, reset, commit } = useEditState<Draft>(incoming);
  const save = useSaveState();
  const errorId = useId();

  const handleSave = () => {
    void save.run(async () => {
      const body: Record<string, string | null> = {};
      for (const f of fields) body[f.key] = orNull(draft[f.key]);
      await adminFetch(`/api/admin/capsules/${capsule.id}`, { method: 'PATCH', body });
      commit(draft);
      await onSaved();
    });
  };

  return (
    <Section title={title}>
      {fields.map((f) =>
        f.rows ? (
          <TextArea
            key={f.key}
            label={f.label}
            value={draft[f.key]}
            rows={f.rows}
            help={f.help}
            placeholder={f.placeholder}
            disabled={save.saving}
            onChange={(value) => set(f.key, value)}
          />
        ) : (
          <TextField
            key={f.key}
            label={f.label}
            value={draft[f.key]}
            help={f.help}
            placeholder={f.placeholder}
            disabled={save.saving}
            onChange={(value) => set(f.key, value)}
          />
        ),
      )}
      <SaveBar dirty={dirty} save={save} onSave={handleSave} onReset={reset} errorId={errorId} />
    </Section>
  );
}
