/**
 * Shared form primitives for the admin editor panels.
 *
 * Everything the five panels render goes through here so the whole portal stays
 * consistent: one label style, one save bar, one delete-confirmation flow, one
 * list editor. `panels.css` is imported once, from this file. The non-component
 * plumbing (dirty tracking, save state, value coercion) lives in `formState.ts`
 * so this module can export components only.
 */
import type { ReactNode } from 'react';
import { useCallback, useId, useState } from 'react';
import type { CapsuleDetail } from '../../types';
import { adminFetch } from '../adminClient';
import { orNull, str, useEditState, useSaveState } from './formState';
import type { EditState, SaveState } from './formState';
import './panels.css';

/** The contract the admin shell renders every panel with. */
export interface PanelProps {
  capsule: CapsuleDetail;
  onSaved: () => void | Promise<void>;
}

/* ----------------------------------------------------------- primitives -- */

export function PanelHead({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <header className="apnl-head">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="apnl-section">
      {title ? <h3 className="apnl-section-title">{title}</h3> : null}
      {children}
    </section>
  );
}

/** Side-by-side field group; collapses to one column when there is no room. */
export function FormRow({ children }: { children: ReactNode }) {
  return <div className="apnl-row">{children}</div>;
}

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  help?: ReactNode;
  children: ReactNode;
}

function FieldShell({ id, label, required, help, children }: FieldShellProps) {
  return (
    <div className="apnl-field">
      <label className="apnl-label" htmlFor={id}>
        {label}
        {required ? (
          <span className="apnl-req" title="Required">
            {' *'}
          </span>
        ) : null}
      </label>
      {children}
      {help ? <p className="apnl-help">{help}</p> : null}
    </div>
  );
}

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  mono?: boolean;
  inputMode?: 'text' | 'numeric' | 'url';
  autoComplete?: string;
}

export function TextField({
  label,
  value,
  onChange,
  help,
  placeholder,
  required,
  disabled,
  mono,
  inputMode,
  autoComplete = 'off',
}: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} help={help}>
      <input
        id={id}
        className={mono ? 'apnl-input apnl-mono' : 'apnl-input'}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        autoComplete={autoComplete}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

export interface TextAreaProps extends TextFieldProps {
  rows?: number;
}

export function TextArea({
  label,
  value,
  onChange,
  help,
  placeholder,
  required,
  disabled,
  mono,
  rows = 5,
}: TextAreaProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} required={required} help={help}>
      <textarea
        id={id}
        className={mono ? 'apnl-textarea apnl-mono' : 'apnl-textarea'}
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

export interface SelectOption<V extends string> {
  value: V;
  label: string;
}

export interface SelectFieldProps<V extends string> {
  label: string;
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  help?: ReactNode;
  disabled?: boolean;
}

export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
  help,
  disabled,
}: SelectFieldProps<V>) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} help={help}>
      <select
        id={id}
        className="apnl-select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as V)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: ReactNode;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, help, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className="apnl-field">
      <label className="apnl-check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="apnl-check-text">
          <span className="apnl-check-label">{label}</span>
          {help ? <span className="apnl-help">{help}</span> : null}
        </span>
      </label>
    </div>
  );
}

/** Non-editable echo of a derived value, e.g. the resolved video source. */
export function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  const empty = value === '';
  return (
    <div className="apnl-readonly">
      <span className="apnl-label">{label}</span>
      <span className="apnl-readonly-value" data-empty={empty ? 'true' : 'false'}>
        {empty ? '--' : value}
      </span>
    </div>
  );
}

/** Native disclosure -- used for the "advanced" escape hatches. */
export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="apnl-details">
      <summary>{summary}</summary>
      <div className="apnl-details-body">{children}</div>
    </details>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p className="apnl-alert" role="alert">
      {children}
    </p>
  );
}

export interface SaveBarProps {
  dirty: boolean;
  save: SaveState;
  onSave: () => void;
  onReset?: () => void;
  saveLabel?: string;
  savingLabel?: string;
  /** Right-aligned slot -- the delete control on list items. */
  extra?: ReactNode;
}

export function SaveBar({
  dirty,
  save,
  onSave,
  onReset,
  saveLabel = 'Save changes',
  savingLabel = 'Saving...',
  extra,
}: SaveBarProps) {
  return (
    <>
      {save.error ? <Alert>{save.error}</Alert> : null}
      <div className="apnl-savebar">
        <button
          type="button"
          className="apnl-btn apnl-btn--primary"
          disabled={!dirty || save.saving}
          onClick={onSave}
        >
          {save.saving ? savingLabel : saveLabel}
        </button>
        {onReset ? (
          <button
            type="button"
            className="apnl-btn apnl-btn--ghost"
            disabled={!dirty || save.saving}
            onClick={onReset}
          >
            Revert
          </button>
        ) : null}
        {dirty && !save.saving ? (
          <span className="apnl-status apnl-status--dirty">Unsaved changes</span>
        ) : null}
        {!dirty && save.status === 'saved' ? (
          <span className="apnl-status apnl-status--saved">Saved</span>
        ) : null}
        {extra ? (
          <>
            <span className="apnl-spacer" />
            {extra}
          </>
        ) : null}
      </div>
    </>
  );
}

/** Two-step delete: no `window.confirm`, the confirmation is inline. */
export function DeleteControl({
  label,
  question,
  busy,
  onConfirm,
}: {
  label: string;
  question: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        className="apnl-btn apnl-btn--danger"
        disabled={busy}
        onClick={() => setArmed(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="apnl-confirm">
      <span>{question}</span>
      <button type="button" className="apnl-btn apnl-btn--danger" disabled={busy} onClick={onConfirm}>
        {busy ? 'Deleting...' : 'Confirm delete'}
      </button>
      <button
        type="button"
        className="apnl-btn apnl-btn--ghost"
        disabled={busy}
        onClick={() => setArmed(false)}
      >
        Cancel
      </button>
    </span>
  );
}

/* ------------------------------------------------------------ list panel -- */

export interface ListFieldSpec<D> {
  key: Extract<keyof D, string>;
  label: string;
  kind?: 'text' | 'textarea';
  rows?: number;
  help?: ReactNode;
  placeholder?: string;
  required?: boolean;
}

function DraftFields<D extends Record<string, string>>({
  fields,
  draft,
  set,
  disabled,
}: {
  fields: ListFieldSpec<D>[];
  draft: D;
  set: EditState<D>['set'];
  disabled: boolean;
}) {
  return (
    <>
      {fields.map((field) =>
        field.kind === 'textarea' ? (
          <TextArea
            key={field.key}
            label={field.label}
            value={str(draft[field.key])}
            rows={field.rows}
            help={field.help}
            placeholder={field.placeholder}
            required={field.required}
            disabled={disabled}
            onChange={(value) => set(field.key, value as D[Extract<keyof D, string>])}
          />
        ) : (
          <TextField
            key={field.key}
            label={field.label}
            value={str(draft[field.key])}
            help={field.help}
            placeholder={field.placeholder}
            required={field.required}
            disabled={disabled}
            onChange={(value) => set(field.key, value as D[Extract<keyof D, string>])}
          />
        ),
      )}
    </>
  );
}

function missingRequired<D extends Record<string, string>>(
  fields: ListFieldSpec<D>[],
  draft: D,
): string | null {
  const missing = fields.filter((field) => field.required && str(draft[field.key]).trim() === '');
  if (missing.length === 0) return null;
  const names = missing.map((field) => field.label).join(', ');
  return `${names} ${missing.length === 1 ? 'is' : 'are'} required.`;
}

function toBody<D extends Record<string, string>>(
  fields: ListFieldSpec<D>[],
  draft: D,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    const value = str(draft[field.key]);
    // Required columns are NOT NULL, so they go out verbatim; optional ones send
    // null when emptied so the column is actually cleared.
    body[field.key] = field.required ? value : orNull(value);
  }
  return body;
}

interface ItemCardProps<T extends { id: number }, D extends Record<string, string>> {
  item: T;
  index: number;
  fields: ListFieldSpec<D>[];
  toDraft: (item: T) => D;
  nameKey: Extract<keyof D, string>;
  singular: string;
  collection: string;
  onSaved: PanelProps['onSaved'];
}

function ItemCard<T extends { id: number }, D extends Record<string, string>>({
  item,
  index,
  fields,
  toDraft,
  nameKey,
  singular,
  collection,
  onSaved,
}: ItemCardProps<T, D>) {
  const { draft, dirty, set, reset, commit } = useEditState<D>(toDraft(item));
  const save = useSaveState();
  const remove = useSaveState();

  const heading = str(draft[nameKey]).trim() || `Untitled ${singular}`;

  const handleSave = () => {
    const problem = missingRequired(fields, draft);
    if (problem) {
      save.fail(problem);
      return;
    }
    void save.run(async () => {
      await adminFetch(`/api/admin/${collection}/${item.id}`, {
        method: 'PATCH',
        body: toBody(fields, draft),
      });
      commit(draft);
      await onSaved();
    });
  };

  const handleDelete = () => {
    void remove.run(async () => {
      await adminFetch(`/api/admin/${collection}/${item.id}`, { method: 'DELETE' });
      await onSaved();
    });
  };

  return (
    <article className="apnl-item">
      <div className="apnl-item-head">
        <h3 className="apnl-item-name">
          {index + 1}. {heading}
        </h3>
        <span className="apnl-item-id">id {item.id}</span>
      </div>
      <DraftFields fields={fields} draft={draft} set={set} disabled={save.saving || remove.saving} />
      {remove.error ? <Alert>{remove.error}</Alert> : null}
      <SaveBar
        dirty={dirty}
        save={save}
        onSave={handleSave}
        onReset={reset}
        extra={
          <DeleteControl
            label={`Delete ${singular}`}
            question={`Delete "${heading}" permanently?`}
            busy={remove.saving}
            onConfirm={handleDelete}
          />
        }
      />
    </article>
  );
}

interface NewItemProps<D extends Record<string, string>> {
  capsuleId: number;
  fields: ListFieldSpec<D>[];
  blank: D;
  singular: string;
  collection: string;
  onSaved: PanelProps['onSaved'];
}

function NewItem<D extends Record<string, string>>({
  capsuleId,
  fields,
  blank,
  singular,
  collection,
  onSaved,
}: NewItemProps<D>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<D>(blank);
  const save = useSaveState();

  const set = useCallback<EditState<D>['set']>((key, value) => {
    setDraft((current) => ({ ...current, [key]: value }) as D);
  }, []);

  const touched = fields.some((field) => str(draft[field.key]) !== str(blank[field.key]));

  if (!open) {
    return (
      <button type="button" className="apnl-btn" onClick={() => setOpen(true)}>
        + Add {singular}
      </button>
    );
  }

  const handleCreate = () => {
    const problem = missingRequired(fields, draft);
    if (problem) {
      save.fail(problem);
      return;
    }
    void save.run(async () => {
      await adminFetch(`/api/admin/capsules/${capsuleId}/${collection}`, {
        method: 'POST',
        body: toBody(fields, draft),
      });
      setDraft(blank);
      setOpen(false);
      await onSaved();
    });
  };

  return (
    <article className="apnl-item apnl-item--new">
      <div className="apnl-item-head">
        <h3 className="apnl-item-name">New {singular}</h3>
      </div>
      <DraftFields fields={fields} draft={draft} set={set} disabled={save.saving} />
      {save.error ? <Alert>{save.error}</Alert> : null}
      <div className="apnl-savebar">
        <button
          type="button"
          className="apnl-btn apnl-btn--primary"
          disabled={save.saving || !touched}
          onClick={handleCreate}
        >
          {save.saving ? 'Adding...' : `Add ${singular}`}
        </button>
        <button
          type="button"
          className="apnl-btn apnl-btn--ghost"
          disabled={save.saving}
          onClick={() => {
            setDraft(blank);
            save.clearError();
            setOpen(false);
          }}
        >
          Cancel
        </button>
        {touched && !save.saving ? (
          <span className="apnl-status apnl-status--dirty">Unsaved changes</span>
        ) : null}
      </div>
    </article>
  );
}

export interface ListPanelProps<T extends { id: number }, D extends Record<string, string>> {
  title: string;
  description?: ReactNode;
  capsuleId: number;
  items: T[];
  /** Lowercase noun, e.g. "reflection". Used in buttons and confirmations. */
  singular: string;
  /** REST collection segment, e.g. "reflections". */
  collection: string;
  fields: ListFieldSpec<D>[];
  toDraft: (item: T) => D;
  blank: D;
  /** Which draft key to show as the card heading. */
  nameKey: Extract<keyof D, string>;
  onSaved: PanelProps['onSaved'];
}

/**
 * The shared "capsule has many X" editor: list, edit inline, add, delete with
 * an inline confirmation. Every card owns its own draft and save state, so one
 * failing save never disturbs a sibling that is mid-edit.
 */
export function ListPanel<T extends { id: number }, D extends Record<string, string>>({
  title,
  description,
  capsuleId,
  items,
  singular,
  collection,
  fields,
  toDraft,
  blank,
  nameKey,
  onSaved,
}: ListPanelProps<T, D>) {
  return (
    <div className="apnl">
      <PanelHead title={title} description={description} />
      <div className="apnl-list">
        {items.length === 0 ? (
          <p className="apnl-empty">
            No {singular} entries for this capsule yet. Add the first one below.
          </p>
        ) : (
          items.map((item, index) => (
            <ItemCard
              key={item.id}
              item={item}
              index={index}
              fields={fields}
              toDraft={toDraft}
              nameKey={nameKey}
              singular={singular}
              collection={collection}
              onSaved={onSaved}
            />
          ))
        )}
        <NewItem
          capsuleId={capsuleId}
          fields={fields}
          blank={blank}
          singular={singular}
          collection={collection}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}
