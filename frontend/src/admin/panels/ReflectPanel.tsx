/** ReflectPanel -- the capsule's Reflect pathway entries. */
import type { Reflection } from '../../types';
import { ListPanel } from './Fields';
import type { ListFieldSpec, PanelProps } from './Fields';
import { str } from './formState';

type ReflectionDraft = {
  title: string;
  introduction: string;
  content: string;
};

const FIELDS: ListFieldSpec<ReflectionDraft>[] = [
  { key: 'title', label: 'Title', required: true },
  {
    key: 'introduction',
    label: 'Introduction',
    kind: 'textarea',
    rows: 4,
    help: 'Short framing shown above the reflection.',
  },
  {
    key: 'content',
    label: 'Content',
    kind: 'textarea',
    rows: 14,
    required: true,
    help: 'The reflection itself. Line breaks and paragraph spacing are saved exactly as typed.',
  },
];

const BLANK: ReflectionDraft = { title: '', introduction: '', content: '' };

const toDraft = (item: Reflection): ReflectionDraft => ({
  title: str(item.title),
  introduction: str(item.introduction),
  content: str(item.content),
});

export function ReflectPanel({ capsule, onSaved }: PanelProps) {
  return (
    <ListPanel<Reflection, ReflectionDraft>
      title="Reflect"
      description="Written reflections for this capsule. A capsule can carry several."
      capsuleId={capsule.id}
      items={capsule.reflections}
      singular="reflection"
      collection="reflections"
      fields={FIELDS}
      toDraft={toDraft}
      blank={BLANK}
      nameKey="title"
      onSaved={onSaved}
    />
  );
}
