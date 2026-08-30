/** DetailsPanel -- capsule-level metadata and the pre-watch framing. */
import { useMemo } from 'react';
import type { CapsuleDetail } from '../../types';
import { adminFetch } from '../adminClient';
import {
  FormRow,
  PanelHead,
  ReadOnlyValue,
  SaveBar,
  Section,
  TextArea,
  TextField,
  Toggle,
} from './Fields';
import type { PanelProps } from './Fields';
import { orNull, str, useEditState, useSaveState } from './formState';

/** The subset of the capsule this panel owns -- and what PATCH returns. */
type CapsuleFields = Pick<
  CapsuleDetail,
  'month' | 'title' | 'description' | 'is_active' | 'pre_watch_prompt' | 'pre_watch_supporting_text'
>;

type DetailsDraft = {
  month: string;
  title: string;
  description: string;
  is_active: boolean;
  pre_watch_prompt: string;
  pre_watch_supporting_text: string;
};

const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

function toDraft(capsule: CapsuleFields): DetailsDraft {
  return {
    month: str(capsule.month),
    title: str(capsule.title),
    description: str(capsule.description),
    is_active: capsule.is_active === true,
    pre_watch_prompt: str(capsule.pre_watch_prompt),
    pre_watch_supporting_text: str(capsule.pre_watch_supporting_text),
  };
}

export function DetailsPanel({ capsule, onSaved }: PanelProps) {
  const incoming = useMemo(
    () =>
      toDraft({
        month: capsule.month,
        title: capsule.title,
        description: capsule.description,
        is_active: capsule.is_active,
        pre_watch_prompt: capsule.pre_watch_prompt,
        pre_watch_supporting_text: capsule.pre_watch_supporting_text,
      }),
    [
      capsule.month,
      capsule.title,
      capsule.description,
      capsule.is_active,
      capsule.pre_watch_prompt,
      capsule.pre_watch_supporting_text,
    ],
  );
  const { draft, dirty, set, reset, commit } = useEditState<DetailsDraft>(incoming);
  const save = useSaveState();

  const handleSave = () => {
    if (draft.title.trim() === '') {
      save.fail('Title is required.');
      return;
    }
    if (!MONTH_PATTERN.test(draft.month.trim())) {
      save.fail('Month must look like 2026-09 (four-digit year, dash, two-digit month).');
      return;
    }

    void save.run(async () => {
      // `month` is UNIQUE in the database. A clash comes back from the server as
      // an error, and useSaveState surfaces its detail inline rather than
      // swallowing it.
      const saved = await adminFetch<CapsuleFields>(`/api/admin/capsules/${capsule.id}`, {
        method: 'PATCH',
        body: {
          month: draft.month.trim(),
          title: draft.title,
          description: orNull(draft.description),
          is_active: draft.is_active,
          pre_watch_prompt: orNull(draft.pre_watch_prompt),
          pre_watch_supporting_text: orNull(draft.pre_watch_supporting_text),
        },
      });
      commit(toDraft(saved));
      await onSaved();
    });
  };

  return (
    <div className="apnl">
      <PanelHead
        title="Capsule details"
        description="The month this capsule belongs to, how it is introduced, and whether it is live."
      />

      <Section title="Identity">
        <FormRow>
          <TextField
            label="Month"
            value={draft.month}
            required
            mono
            placeholder="2026-09"
            onChange={(value) => set('month', value)}
            help="Format YYYY-MM. One capsule per month: saving a month another capsule already uses will be rejected by the server."
          />
          <TextField
            label="Title"
            value={draft.title}
            required
            onChange={(value) => set('title', value)}
          />
        </FormRow>
        <div className="apnl-resolved-grid">
          <ReadOnlyValue label="Capsule id" value={String(capsule.id)} />
          <ReadOnlyValue label="Film" value={capsule.film ? str(capsule.film.title) : ''} />
          <ReadOnlyValue
            label="Pathway entries"
            value={`${capsule.reflections.length} reflect / ${capsule.discussion_circles.length} discuss / ${capsule.practices.length} practice`}
          />
        </div>
        <TextArea
          label="Description"
          value={draft.description}
          rows={5}
          onChange={(value) => set('description', value)}
          help="The capsule blurb. Line breaks are kept as typed."
        />
        <Toggle
          label="Active"
          checked={draft.is_active}
          onChange={(checked) => set('is_active', checked)}
          help="Only an active capsule is served as the current one on the public site."
        />
      </Section>

      <Section title="Before the film">
        <TextArea
          label="Pre-watch prompt"
          value={draft.pre_watch_prompt}
          rows={4}
          onChange={(value) => set('pre_watch_prompt', value)}
          help="The question the viewer sits with before pressing play."
        />
        <TextArea
          label="Pre-watch supporting text"
          value={draft.pre_watch_supporting_text}
          rows={6}
          onChange={(value) => set('pre_watch_supporting_text', value)}
          help="Anything that frames the prompt -- context, an instruction, a note on how long to sit with it."
        />
      </Section>

      <SaveBar dirty={dirty} save={save} onSave={handleSave} onReset={reset} />
    </div>
  );
}
