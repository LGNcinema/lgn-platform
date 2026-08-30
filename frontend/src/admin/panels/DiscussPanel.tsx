/** DiscussPanel -- the capsule's Discuss pathway (discussion circles). */
import type { DiscussionCircle } from '../../types';
import { ListPanel } from './Fields';
import type { ListFieldSpec, PanelProps } from './Fields';
import { str } from './formState';

type CircleDraft = {
  title: string;
  opening_round: string;
  discuss_prompts: string;
  closing_question: string;
};

const FIELDS: ListFieldSpec<CircleDraft>[] = [
  { key: 'title', label: 'Title', required: true },
  {
    key: 'opening_round',
    label: 'Opening round',
    kind: 'textarea',
    rows: 4,
    help: 'How the circle starts -- the question everyone answers before the discussion opens up.',
  },
  {
    key: 'discuss_prompts',
    label: 'Discussion prompts',
    kind: 'textarea',
    rows: 12,
    help: 'One prompt per line. The line breaks ARE the list -- they are stored exactly as typed.',
  },
  {
    key: 'closing_question',
    label: 'Closing question',
    kind: 'textarea',
    rows: 4,
    help: 'The question the circle ends on.',
  },
];

const BLANK: CircleDraft = {
  title: '',
  opening_round: '',
  discuss_prompts: '',
  closing_question: '',
};

const toDraft = (item: DiscussionCircle): CircleDraft => ({
  title: str(item.title),
  opening_round: str(item.opening_round),
  discuss_prompts: str(item.discuss_prompts),
  closing_question: str(item.closing_question),
});

export function DiscussPanel({ capsule, onSaved }: PanelProps) {
  return (
    <ListPanel<DiscussionCircle, CircleDraft>
      title="Discuss"
      description="Discussion circles for this capsule -- the opening round, the prompts, and the closing question."
      capsuleId={capsule.id}
      items={capsule.discussion_circles}
      singular="discussion circle"
      collection="discussion_circles"
      fields={FIELDS}
      toDraft={toDraft}
      blank={BLANK}
      nameKey="title"
      onSaved={onSaved}
    />
  );
}
