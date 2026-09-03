/** PracticePanel -- the capsule's Practice pathway entries. */
import type { Practice } from '../../types';
import { ListPanel } from './Fields';
import type { ListFieldSpec, PanelProps } from './Fields';
import { str } from './formState';

type PracticeDraft = {
  title: string;
  description: string;
  steps: string;
};

const FIELDS: ListFieldSpec<PracticeDraft>[] = [
  { key: 'title', label: 'Title', required: true },
  {
    key: 'description',
    label: 'Description',
    kind: 'textarea',
    rows: 5,
    help: 'What this practice is, and what it is for.',
  },
  {
    key: 'steps',
    label: 'Steps',
    kind: 'textarea',
    rows: 14,
    required: true,
    help: 'One step per line. The line breaks ARE the list -- they are stored exactly as typed.',
  },
];

const BLANK: PracticeDraft = { title: '', description: '', steps: '' };

const toDraft = (item: Practice): PracticeDraft => ({
  title: str(item.title),
  description: str(item.description),
  steps: str(item.steps),
});

export function PracticePanel({ capsule, onSaved }: PanelProps) {
  return (
    <ListPanel<Practice, PracticeDraft>
      title="Practice"
      description="Hands-on practices for this capsule."
      capsuleId={capsule.id}
      items={capsule.practices}
      singular="practice"
      collection="practices"
      fields={FIELDS}
      toDraft={toDraft}
      blank={BLANK}
      nameKey="title"
      onSaved={onSaved}
    />
  );
}
