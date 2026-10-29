/**
 * BtsPanel -- the story's Behind the Film page, "How this film was made"
 * (Figma v3 "Campfire—bts"), top to bottom: the large picture; the copyright
 * line and logo; the credits; the gallery; the written sections.
 *
 * The site offers the page (a button on Watch) once any of these has content.
 */
import { useState } from 'react';
import type { BtsSection } from '../../types';
import { adminFetch } from '../adminClient';
import { BtsPhotos } from './BtsPhotos';
import { Alert, ListPanel, Note, PanelHead } from './Fields';
import type { ListFieldSpec, PanelProps } from './Fields';
import { str } from './formState';
import { StoryFieldsForm } from './StoryFieldsForm';

/** Every role the frame lists, as a starting point to fill in or trim. */
export const STANDARD_CREDITS = [
  'Directed By: ',
  'Written By: ',
  'Produced By: ',
  'Executive Producers: ',
  'Starring: ',
  '',
  'Director of Photography: ',
  'Production Designer: ',
  'Edited By: ',
  'Costume Designer: ',
  'Music By: ',
  'Casting By: ',
  '',
  'Color: ',
  'Sound: ',
  'Postproduction: ',
  'Compositor: ',
].join('\n');

type SectionDraft = { heading: string; body: string };

const SECTION_FIELDS: ListFieldSpec<SectionDraft>[] = [
  { key: 'heading', label: 'Heading', kind: 'text', help: 'Optional, e.g. "Behind the Scenes: Bringing the Vision to Life".' },
  { key: 'body', label: 'Paragraphs', kind: 'textarea', rows: 8, required: true, help: 'A blank line starts a new paragraph.' },
];

const BLANK_SECTION: SectionDraft = { heading: '', body: '' };

const toSectionDraft = (item: BtsSection): SectionDraft => ({ heading: str(item.heading), body: str(item.body) });

/** Offered while the credits are empty: fills in the frame's roles to edit. */
function StartCredits({ capsule, onSaved }: PanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (capsule.bts_credits?.trim()) return null;
  return (
    <Note>
      No credits yet.{' '}
      <button
        type="button"
        className="apnl-btn apnl-btn--ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await adminFetch(`/api/admin/capsules/${capsule.id}`, { method: 'PATCH', body: { bts_credits: STANDARD_CREDITS } });
            await onSaved();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'That did not save. Please try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        Start from the standard roles
      </button>
      {error && <Alert>{error}</Alert>}
    </Note>
  );
}

export function BtsPanel({ capsule, onSaved }: PanelProps) {
  const props = { capsule, onSaved };
  return (
    <div className="apnl">
      <PanelHead
        title="Behind the Film"
        description='The "How this film was made" page, opened from a button on Watch. The button appears once anything below has content; empty parts are simply left out of the page.'
      />

      <BtsPhotos {...props} kind="hero" />

      <StoryFieldsForm
        {...props}
        title="Copyright"
        fields={[
          {
            key: 'bts_copyright',
            label: 'Copyright line',
            rows: 2,
            placeholder: 'Copyright © 2026 Production Company. All Rights Reserved.',
            help: 'Beside the credits, above the logo.',
          },
        ]}
      />

      <BtsPhotos {...props} kind="logo" />

      <StoryFieldsForm
        {...props}
        title="Credits"
        fields={[
          {
            key: 'bts_credits',
            label: 'Credits',
            rows: 18,
            help: 'One role per line, as "Role: Name, Name". A blank line starts a new group. Roles left without a name are not shown.',
          },
        ]}
      />
      <StartCredits {...props} />

      <BtsPhotos {...props} kind="bts" />

      <ListPanel<BtsSection, SectionDraft>
        title="Written sections"
        description="Below the gallery, in this order (use the arrows to rearrange): a heading on the left, its paragraphs on the right."
        capsuleId={capsule.id}
        items={capsule.bts_sections ?? []}
        singular="section"
        collection="bts_sections"
        fields={SECTION_FIELDS}
        toDraft={toSectionDraft}
        blank={BLANK_SECTION}
        nameKey="heading"
        onSaved={onSaved}
        emptyText="No written sections yet."
        reorderable
      />
    </div>
  );
}
