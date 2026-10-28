/**
 * PracticePanel -- the story's Practice tab, in V3's shape: a title for the
 * tab, then one practice each for Self / Neighbor / World, with optional tips.
 * Self opens first on the site.
 */
import type { Dimension, Practice } from '../../types';
import { DIMENSIONS } from '../../components/campfire/campfire';
import { ListPanel, PanelHead, Section } from './Fields';
import type { ListFieldSpec, PanelProps } from './Fields';
import { str } from './formState';
import { StoryFieldsForm } from './StoryFieldsForm';

type PracticeDraft = { steps: string; tips: string };

const FIELDS: ListFieldSpec<PracticeDraft>[] = [
  {
    key: 'steps',
    label: 'The practice',
    kind: 'textarea',
    rows: 8,
    required: true,
    help: 'One step per line. Each line becomes a numbered step on the site.',
  },
  {
    key: 'tips',
    label: 'Tips',
    kind: 'textarea',
    rows: 3,
    help: 'Optional. Shown under the steps.',
  },
];

const BLANK: PracticeDraft = { steps: '', tips: '' };

const toDraft = (item: Practice): PracticeDraft => ({ steps: str(item.steps), tips: str(item.tips) });

export function PracticePanel({ capsule, onSaved }: PanelProps) {
  const inGroup = (key: Dimension) => capsule.practices.filter((p) => p.dimension === key);

  return (
    <div className="apnl">
      <PanelHead
        title="Practice"
        description="One practice for each of Self, Neighbor and World. Self opens first on the site."
      />

      <StoryFieldsForm
        capsule={capsule}
        onSaved={onSaved}
        title="Practice title"
        fields={[
          {
            key: 'practice_title',
            label: 'Title',
            rows: 3,
            help: 'Shown above Self / Neighbor / World. Blank shows the standard line, "A weekly exercise in rooting..."',
          },
        ]}
      />

      {DIMENSIONS.map(({ key, label }) => (
        <Section key={key} title={label}>
          <ListPanel<Practice, PracticeDraft>
            capsuleId={capsule.id}
            items={inGroup(key)}
            singular={`${label} practice`}
            collection="practices"
            fields={FIELDS}
            toDraft={toDraft}
            blank={BLANK}
            nameKey="steps"
            onSaved={onSaved}
            fixedBody={{ dimension: key, title: `${label} practice` }}
            maxItems={1}
            emptyText={`No ${label} practice yet.`}
          />
        </Section>
      ))}
    </div>
  );
}
