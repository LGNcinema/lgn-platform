/** DetailsPanel -- capsule-level metadata and the pre-watch framing. */
import { useEffect, useId, useMemo, useState } from 'react';
import type { CapsuleDetail, CapsuleSummary } from '../../types';
import { adminFetch, formatMonth } from '../adminClient';
import {
  FormRow,
  Note,
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
  const errorId = useId();

  /**
   * Publishing is exclusive: the backend demotes every other capsule when
   * `is_active` is set. A checkbox labelled "Active" gives no hint of that, so
   * we look up whichever capsule is live right now and name it in the warning.
   */
  const [liveElsewhere, setLiveElsewhere] = useState<CapsuleSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await adminFetch<CapsuleSummary[]>('/api/admin/capsules');
        if (cancelled) return;
        const live = (Array.isArray(all) ? all : []).find(
          (item) => item.is_active && item.id !== capsule.id,
        );
        setLiveElsewhere(live ?? null);
      } catch {
        // Purely advisory -- a failure here must not block editing.
        if (!cancelled) setLiveElsewhere(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [capsule.id, capsule.is_active]);

  const publishing = draft.is_active && !capsule.is_active;
  const unpublishing = !draft.is_active && capsule.is_active;

  const monthValid = MONTH_PATTERN.test(draft.month.trim());
  const invalid = save.error
    ? { title: draft.title.trim() === '', month: !monthValid }
    : { title: false, month: false };

  const handleSave = () => {
    if (draft.title.trim() === '') {
      save.fail('Title is required.');
      return;
    }
    if (!monthValid) {
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
        description="The month this capsule belongs to, how it is introduced, and whether it is the one the public site serves."
      />

      <Section title="Identity">
        <FormRow>
          <TextField
            label="Month"
            value={draft.month}
            required
            mono
            disabled={save.saving}
            placeholder="2026-09"
            invalid={invalid.month}
            errorId={errorId}
            onChange={(value) => set('month', value)}
            help="Format YYYY-MM, e.g. 2026-09. One capsule per month: saving a month another capsule already uses will be rejected by the server."
          />
          <TextField
            label="Title"
            value={draft.title}
            required
            disabled={save.saving}
            invalid={invalid.title}
            errorId={errorId}
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
          disabled={save.saving}
          onChange={(value) => set('description', value)}
          help="The capsule blurb. Line breaks are kept as typed."
        />
      </Section>

      <Section title="Publishing">
        <Toggle
          label="Publish this capsule (make it the live one on the site)"
          checked={draft.is_active}
          disabled={save.saving}
          onChange={(checked) => set('is_active', checked)}
          help="Exactly one capsule is live at a time. The live capsule is the one the public site serves at /?view=capsule."
        />
        {publishing && liveElsewhere ? (
          <Note>
            Saving will publish this capsule and replace{' '}
            <strong>
              {formatMonth(liveElsewhere.month)}
              {liveElsewhere.title ? ` -- ${liveElsewhere.title}` : ''}
            </strong>{' '}
            as the live capsule. That capsule becomes a draft; nothing about it is deleted.
          </Note>
        ) : null}
        {publishing && !liveElsewhere ? (
          <Note>Saving will publish this capsule. No other capsule is live right now.</Note>
        ) : null}
        {unpublishing ? (
          <Note>
            Saving will unpublish this capsule. Unless another capsule is published, the public site
            will have no live capsule to serve.
          </Note>
        ) : null}
      </Section>

      <Section title="Before the film">
        <TextArea
          label="Pre-watch prompt"
          value={draft.pre_watch_prompt}
          rows={4}
          disabled={save.saving}
          onChange={(value) => set('pre_watch_prompt', value)}
          help="The question the viewer sits with before pressing play."
        />
        <TextArea
          label="Pre-watch supporting text"
          value={draft.pre_watch_supporting_text}
          rows={6}
          disabled={save.saving}
          onChange={(value) => set('pre_watch_supporting_text', value)}
          help="Anything that frames the prompt -- context, an instruction, a note on how long to sit with it."
        />
      </Section>

      <SaveBar
        dirty={dirty}
        save={save}
        onSave={handleSave}
        onReset={reset}
        sticky
        errorId={errorId}
      />
    </div>
  );
}
