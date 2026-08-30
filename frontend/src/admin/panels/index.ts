/**
 * The editor panels the admin shell mounts. Every panel takes the same props:
 * the loaded capsule, and a callback to refetch it after a successful write.
 */
export type { PanelProps } from './Fields';

export { FilmPanel } from './FilmPanel';
export { ReflectPanel } from './ReflectPanel';
export { DiscussPanel } from './DiscussPanel';
export { PracticePanel } from './PracticePanel';
export { DetailsPanel } from './DetailsPanel';
