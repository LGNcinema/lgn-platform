/**
 * ReflectPanel -- the story's Reflect tab, in V3's shape: one introduction for
 * the whole tab, then Self / Neighbor / World, each holding as many questions
 * as you add. The first question in each is the featured one. Visitors write
 * their answers privately on the site.
 */
import type { Dimension, Reflection } from '../../types';
import { DIMENSIONS } from '../../components/campfire/campfire';
import { ListPanel, Note, PanelHead, Section } from './Fields';
import type { ListFieldSpec, PanelProps } from './Fields';
import { str } from './formState';
import { StoryFieldsForm } from './StoryFieldsForm';

type QuestionDraft = { content: string };

const FIELDS: ListFieldSpec<QuestionDraft>[] = [
  {
    key: 'content',
    label: 'Question',
    kind: 'textarea',
    rows: 3,
    required: true,
  },
];

const BLANK: QuestionDraft = { content: '' };

const toDraft = (item: Reflection): QuestionDraft => ({ content: str(item.content) });

export function ReflectPanel({ capsule, onSaved }: PanelProps) {
  const inGroup = (key: Dimension) => capsule.reflections.filter((r) => r.dimension === key);
  // Written before Self / Neighbor / World existed and never tagged: shown so
  // nothing is lost, until it is moved or deleted.
  const untagged = capsule.reflections.filter((r) => !r.dimension);

  return (
    <div className="apnl">
      <PanelHead
        title="Reflect"
        description="What visitors are asked after the film. Their answers stay private, on their own device."
      />

      <StoryFieldsForm
        capsule={capsule}
        onSaved={onSaved}
        title="Introduction"
        fields={[
          {
            key: 'reflect_intro',
            label: 'Introduction text',
            rows: 4,
            help: 'One introduction for the whole tab, shown above Self / Neighbor / World. Blank shows a standard line naming the film.',
          },
        ]}
      />

      {DIMENSIONS.map(({ key, label }) => (
        <Section key={key} title={label}>
          <ListPanel<Reflection, QuestionDraft>
            capsuleId={capsule.id}
            items={inGroup(key)}
            singular={`${label} question`}
            collection="reflections"
            fields={FIELDS}
            toDraft={toDraft}
            blank={BLANK}
            nameKey="content"
            onSaved={onSaved}
            fixedBody={{ dimension: key, title: `${label} question` }}
            emptyText={`No ${label} question yet. The first one you add is the featured question.`}
          />
        </Section>
      ))}

      {untagged.length > 0 && (
        <Note>
          {untagged.length} older question{untagged.length === 1 ? '' : 's'} on this story {untagged.length === 1 ? "isn't" : "aren't"} in
          Self, Neighbor or World yet, so the site places {untagged.length === 1 ? 'it' : 'them'} by order. Re-add{' '}
          {untagged.length === 1 ? 'it' : 'them'} in the right section to place {untagged.length === 1 ? 'it' : 'them'} yourself.
        </Note>
      )}
    </div>
  );
}
