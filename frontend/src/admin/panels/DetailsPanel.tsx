/** DetailsPanel -- capsule-level metadata, publishing/scheduling, and the pre-watch framing. */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CapsuleDetail, CapsuleSummary } from '../../types';
import { adminFetch, formatMonth } from '../adminClient';
import {
  currentCapsuleId,
  defaultScheduleValue,
  formatLocal,
  formatRelative,
  fromDatetimeLocalValue,
  inputToPublishAt,
  isPublished,
  localTimeLabel,
  parseNaiveUtc,
  publicationState,
  publishAtToInput,
} from '../publishing';
import type { PublishMode } from '../publishing';
import { StatusPill } from '../StatusPill';
import {
  DateTimeField,
  FormRow,
  Note,
  PanelHead,
  ReadOnlyValue,
  SaveBar,
  Section,
  TextArea,
  TextField,
} from './Fields';
import type { PanelProps } from './Fields';
import { orNull, str, useEditState, useSaveState } from './formState';

/** The subset of the capsule this panel owns -- and what PATCH returns. */
type CapsuleFields = Pick<
  CapsuleDetail,
  | 'month'
  | 'title'
  | 'description'
  | 'is_active'
  | 'publish_at'
  | 'pre_watch_prompt'
  | 'pre_watch_supporting_text'
>;

type DetailsDraft = {
  month: string;
  title: string;
  description: string;
  is_active: boolean;
  /**
   * A `datetime-local` value in the editor's own zone, or `''` for "no schedule".
   * The naive-UTC string the API wants is produced at save time, and only there.
   */
  publish_at: string;
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
    publish_at: publishAtToInput(capsule.publish_at),
    pre_watch_prompt: str(capsule.pre_watch_prompt),
    pre_watch_supporting_text: str(capsule.pre_watch_supporting_text),
  };
}

/** The publication the *draft* describes -- i.e. what saving would leave behind. */
function draftMode(draft: DetailsDraft): PublishMode {
  if (draft.is_active) return 'published';
  return draft.publish_at ? 'scheduled' : 'draft';
}

export function DetailsPanel({ capsule, onSaved }: PanelProps) {
  const incoming = useMemo(
    () =>
      toDraft({
        month: capsule.month,
        title: capsule.title,
        description: capsule.description,
        is_active: capsule.is_active,
        publish_at: capsule.publish_at,
        pre_watch_prompt: capsule.pre_watch_prompt,
        pre_watch_supporting_text: capsule.pre_watch_supporting_text,
      }),
    [
      capsule.month,
      capsule.title,
      capsule.description,
      capsule.is_active,
      capsule.publish_at,
      capsule.pre_watch_prompt,
      capsule.pre_watch_supporting_text,
    ],
  );
  const { draft, dirty, set, setMany, reset, commit } = useEditState<DetailsDraft>(incoming);
  const save = useSaveState();
  const errorId = useId();
  const scheduleRef = useRef<HTMLInputElement | null>(null);
  // Focus follows the choice, but only when the user made one: an auto-focus on
  // mount would steal the caret every time the Details tab opens on a scheduled
  // capsule.
  const focusSchedule = useRef(false);

  /**
   * Publishing is no longer exclusive -- several capsules can be published at
   * once, and the public site simply opens on the published one with the newest
   * month. The list is fetched so we can name *that* capsule, which is the only
   * thing publishing this one might change for a visitor.
   */
  const [siblings, setSiblings] = useState<CapsuleSummary[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await adminFetch<CapsuleSummary[]>('/api/admin/capsules');
        if (!cancelled) setSiblings(Array.isArray(all) ? all : []);
      } catch {
        // Purely advisory -- a failure here must not block editing.
        if (!cancelled) setSiblings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [capsule.id, capsule.is_active, capsule.publish_at, capsule.is_published]);

  useEffect(() => {
    if (!focusSchedule.current) return;
    focusSchedule.current = false;
    scheduleRef.current?.focus();
  }, [draft.publish_at, draft.is_active]);

  /* ---- what the server currently says ---- */
  const serverState = publicationState(capsule);
  const serverScheduledAt = parseNaiveUtc(capsule.publish_at);

  const currentId = useMemo(() => currentCapsuleId(siblings), [siblings]);
  const currentCapsule = siblings.find((item) => item.id === currentId) ?? null;
  const isCurrent = currentId !== null && currentId === capsule.id;

  /** The newest month already published by some *other* capsule. */
  const newestOtherPublishedMonth = useMemo(() => {
    let newest = '';
    for (const item of siblings) {
      if (item.id === capsule.id || !isPublished(item)) continue;
      if ((item.month ?? '') > newest) newest = item.month ?? '';
    }
    return newest;
  }, [siblings, capsule.id]);

  const describeCapsule = (item: CapsuleSummary) =>
    `${formatMonth(item.month)}${item.title ? ` -- ${item.title}` : ''}`;

  /* ---- what the draft would do ---- */
  const mode = draftMode(draft);
  const scheduledDate = mode === 'scheduled' ? fromDatetimeLocalValue(draft.publish_at) : null;
  const scheduleInPast = scheduledDate !== null && scheduledDate.getTime() <= Date.now();
  const scheduleUnparseable = mode === 'scheduled' && draft.publish_at !== '' && scheduledDate === null;

  const publicationChanged =
    draft.is_active !== incoming.is_active || draft.publish_at !== incoming.publish_at;

  const chooseMode = useCallback(
    (next: PublishMode) => {
      save.clearError();
      if (next === 'published') {
        // Publishing now makes any pending schedule moot; clearing it keeps the
        // saved record honest instead of leaving a date that can never fire.
        setMany({ is_active: true, publish_at: '' });
        return;
      }
      if (next === 'scheduled') {
        // Only when the picker is actually about to appear: re-choosing the
        // mode it is already in changes nothing, so the focus effect above
        // would never fire and the flag would go off against some later edit.
        if (mode !== 'scheduled') focusSchedule.current = true;
        setMany({
          is_active: false,
          publish_at: draft.publish_at || publishAtToInput(capsule.publish_at) || defaultScheduleValue(),
        });
        return;
      }
      setMany({ is_active: false, publish_at: '' });
    },
    [capsule.publish_at, draft.publish_at, mode, save, setMany],
  );

  const monthValid = MONTH_PATTERN.test(draft.month.trim());
  const invalid = save.error
    ? {
        title: draft.title.trim() === '',
        month: !monthValid,
        publishAt: mode === 'scheduled' && (draft.publish_at === '' || scheduledDate === null),
      }
    : { title: false, month: false, publishAt: false };

  const handleSave = () => {
    if (draft.title.trim() === '') {
      save.fail('Title is required.');
      return;
    }
    if (!monthValid) {
      save.fail('Month must look like 2026-09 (four-digit year, dash, two-digit month).');
      return;
    }

    // Local wall clock in, naive UTC out. `undefined` means the picker holds
    // something that is not a date, which must never be saved as "no schedule".
    const publishAt = mode === 'scheduled' ? inputToPublishAt(draft.publish_at) : null;
    if (mode === 'scheduled' && (draft.publish_at === '' || publishAt === undefined)) {
      save.fail('Pick the date and time this capsule should go live, or choose Publish now instead.');
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
          is_active: mode === 'published',
          publish_at: publishAt,
          pre_watch_prompt: orNull(draft.pre_watch_prompt),
          pre_watch_supporting_text: orNull(draft.pre_watch_supporting_text),
        },
      });
      commit(toDraft(saved));
      await onSaved();
    });
  };

  /* ---- copy ---- */
  const currentStateLine = (() => {
    switch (serverState) {
      case 'published':
        if (isCurrent) {
          return 'Live on the site, and the newest published capsule -- this is the one the site opens on.';
        }
        return currentCapsule
          ? `Live on the site. Visitors land on the newest published capsule, currently ${describeCapsule(currentCapsule)}; this one is reachable from the month tabs.`
          : 'Live on the site.';
      case 'scheduled':
        return serverScheduledAt
          ? `Goes live ${formatLocal(serverScheduledAt)} -- ${localTimeLabel()}, ${formatRelative(serverScheduledAt)}. Nothing is visible on the site until then.`
          : 'Scheduled.';
      case 'due':
        return serverScheduledAt
          ? `Its scheduled time (${formatLocal(serverScheduledAt)} -- ${localTimeLabel()}) has passed, so the site is already serving it. Reload the portal to refresh this view.`
          : 'Its scheduled time has passed; the site is already serving it.';
      case 'draft':
      default:
        return 'Not visible on the public site. Publish it now, or schedule when it should appear.';
    }
  })();

  const unpublishLabel = serverState === 'draft' ? 'Keep as draft' : 'Unpublish';

  const pendingNote = (() => {
    if (!publicationChanged) return null;

    if (mode === 'published') {
      const overtaken =
        newestOtherPublishedMonth !== '' && newestOtherPublishedMonth > draft.month.trim();
      return (
        <Note>
          <strong>Not saved yet.</strong> Saving publishes this capsule immediately.{' '}
          {overtaken
            ? `${formatMonth(newestOtherPublishedMonth)} is a newer published month, so the site will still open on that one; this capsule joins the month tabs.`
            : 'It becomes the newest published capsule, so the site will open on it.'}{' '}
          No other capsule is unpublished by this.
        </Note>
      );
    }

    if (mode === 'scheduled') {
      if (!scheduledDate) {
        return (
          <Note>
            <strong>Not saved yet.</strong> Pick the date and time this capsule should go live.
          </Note>
        );
      }
      if (scheduleInPast) {
        return (
          <Note>
            <strong>Not saved yet -- and that time has already passed.</strong> Saving will publish
            this capsule straight away, because the server publishes anything whose scheduled time
            is in the past. Pick a future time, or use <em>Publish now</em>, if that is not what you
            want.
          </Note>
        );
      }
      return (
        <Note>
          <strong>Not saved yet.</strong> Saving schedules this capsule to go live{' '}
          <strong>{formatLocal(scheduledDate)}</strong> -- {localTimeLabel()},{' '}
          {formatRelative(scheduledDate)}. It stays invisible on the site until then.
        </Note>
      );
    }

    return (
      <Note>
        <strong>Not saved yet.</strong>{' '}
        {incoming.is_active
          ? 'Saving takes this capsule off the public site. Nothing is deleted, and no other capsule is affected.'
          : 'Saving clears the scheduled go-live time, leaving this capsule as a draft.'}
      </Note>
    );
  })();

  return (
    <div className="apnl">
      <PanelHead
        title="Capsule details"
        description="The month this capsule belongs to, how it is introduced, and when it appears on the public site."
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
        <div className="apnl-publish-state">
          <StatusPill state={serverState} />
          <p className="apnl-publish-state-text">{currentStateLine}</p>
        </div>

        {/* A radio group in behaviour, buttons in appearance: the three choices
            are mutually exclusive, and `aria-pressed` reports which one holds. */}
        <div className="apnl-publish-choices" role="group" aria-label="Publication">
          <button
            type="button"
            className={`apnl-btn apnl-publish-choice${mode === 'published' ? ' is-chosen' : ''}`}
            aria-pressed={mode === 'published'}
            disabled={save.saving}
            onClick={() => chooseMode('published')}
          >
            Publish now
          </button>
          <button
            type="button"
            className={`apnl-btn apnl-publish-choice${mode === 'scheduled' ? ' is-chosen' : ''}`}
            aria-pressed={mode === 'scheduled'}
            disabled={save.saving}
            onClick={() => chooseMode('scheduled')}
          >
            Schedule...
          </button>
          <button
            type="button"
            className={`apnl-btn apnl-publish-choice${mode === 'draft' ? ' is-chosen' : ''}`}
            aria-pressed={mode === 'draft'}
            disabled={save.saving}
            onClick={() => chooseMode('draft')}
          >
            {unpublishLabel}
          </button>
        </div>

        {mode === 'scheduled' ? (
          <DateTimeField
            label="Goes live at"
            value={draft.publish_at}
            required
            disabled={save.saving}
            invalid={invalid.publishAt || scheduleUnparseable}
            errorId={errorId}
            inputRef={scheduleRef}
            onChange={(value) => set('publish_at', value)}
            help={
              <>
                Entered and shown in {localTimeLabel()}; stored in UTC, so it fires at the same
                moment for everyone.{' '}
                {scheduledDate
                  ? `That is ${formatLocal(scheduledDate)} for you.`
                  : 'Pick a date and time.'}
              </>
            }
          />
        ) : null}

        {pendingNote}

        {!publicationChanged && serverState === 'published' && capsule.publish_at ? (
          <Note>
            This capsule is published outright, so the go-live time it still carries (
            {serverScheduledAt ? formatLocal(serverScheduledAt) : str(capsule.publish_at)}) has no
            further effect. Choosing <em>Publish now</em> and saving clears it.
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
