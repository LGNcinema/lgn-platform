/**
 * Shared form primitives for the admin editor panels.
 *
 * Everything the five panels render goes through here so the whole portal stays
 * consistent: one label style, one save bar, one delete-confirmation flow, one
 * list editor. `panels.css` is imported once, from this file. The non-component
 * plumbing (dirty tracking, save state, value coercion) lives in `formState.ts`
 * so this module can export components only.
 */
import type { ReactNode, Ref } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CapsuleDetail } from '../../types';
import { adminFetch } from '../adminClient';
import { orNull, str, useDirtyRegistration, useEditState, useSaveState } from './formState';
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

/**
 * Join the ids a control should point `aria-describedby` at: its own help text,
 * plus the panel's error alert when this field is the one that failed.
 */
function describedBy(helpId: string | undefined, errorId: string | undefined): string | undefined {
  const ids = [helpId, errorId].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  help?: ReactNode;
  helpId?: string;
  children: ReactNode;
}

function FieldShell({ id, label, required, help, helpId, children }: FieldShellProps) {
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
      {help ? (
        <p className="apnl-help" id={helpId}>
          {help}
        </p>
      ) : null}
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
  /** This field is the one the last validation error was about. */
  invalid?: boolean;
  /** Id of the alert element that explains the error, for `aria-describedby`. */
  errorId?: string;
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
  invalid,
  errorId,
}: TextFieldProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  return (
    <FieldShell id={id} label={label} required={required} help={help} helpId={helpId}>
      <input
        id={id}
        className={mono ? 'apnl-input apnl-mono' : 'apnl-input'}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(helpId, invalid ? errorId : undefined)}
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
  invalid,
  errorId,
}: TextAreaProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  return (
    <FieldShell id={id} label={label} required={required} help={help} helpId={helpId}>
      <textarea
        id={id}
        className={mono ? 'apnl-textarea apnl-mono' : 'apnl-textarea'}
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(helpId, invalid ? errorId : undefined)}
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
  const helpId = help ? `${id}-help` : undefined;
  return (
    <FieldShell id={id} label={label} help={help} helpId={helpId}>
      <select
        id={id}
        className="apnl-select"
        value={value}
        disabled={disabled}
        aria-describedby={helpId}
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

export interface DateTimeFieldProps {
  label: string;
  /**
   * A `datetime-local` value -- `YYYY-MM-DDTHH:mm` in the *viewer's own zone*,
   * carrying no timezone of its own. Conversion to and from the API's naive-UTC
   * `publish_at` belongs to the caller (see `admin/publishing.ts`); this control
   * only ever handles local wall-clock text.
   */
  value: string;
  onChange: (value: string) => void;
  help?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  errorId?: string;
  /** Lets a panel move focus here when the field is revealed by a choice. */
  inputRef?: Ref<HTMLInputElement>;
}

/** Local date + time picker. Minute precision -- the browser gives no seconds. */
export function DateTimeField({
  label,
  value,
  onChange,
  help,
  required,
  disabled,
  invalid,
  errorId,
  inputRef,
}: DateTimeFieldProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  return (
    <FieldShell id={id} label={label} required={required} help={help} helpId={helpId}>
      <input
        id={id}
        ref={inputRef}
        className="apnl-input apnl-input--datetime"
        type="datetime-local"
        value={value}
        disabled={disabled}
        required={required}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(helpId, invalid ? errorId : undefined)}
        onChange={(event) => onChange(event.target.value)}
      />
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
  const helpId = help ? `${id}-help` : undefined;
  return (
    <div className="apnl-field">
      <label className="apnl-check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={helpId}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="apnl-check-text">
          <span className="apnl-check-label">{label}</span>
          {help ? (
            <span className="apnl-help" id={helpId}>
              {help}
            </span>
          ) : null}
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

/** A quiet, non-destructive note -- explains a state, never an error. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="apnl-note" role="status">
      {children}
    </p>
  );
}

export function Alert({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p className="apnl-alert" role="alert" id={id}>
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
  /** Pin the bar to the bottom of the viewport (the long single-form panels). */
  sticky?: boolean;
  /** Id given to the error alert, so fields can point `aria-describedby` at it. */
  errorId?: string;
}

export function SaveBar({
  dirty,
  save,
  onSave,
  onReset,
  saveLabel = 'Save changes',
  savingLabel = 'Saving...',
  extra,
  sticky,
  errorId,
}: SaveBarProps) {
  const content = (
    <>
      {save.error ? <Alert id={errorId}>{save.error}</Alert> : null}
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

  // The dock carries the error with the buttons, so a validation message is
  // never stranded above the fold while the bar itself is pinned to the bottom.
  return sticky ? <div className="apnl-savedock">{content}</div> : content;
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
  const armRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  // The control that had focus is replaced when this swaps, so focus has to be
  // moved by hand or it falls back to <body> and keyboard users lose their place.
  const moveFocus = useRef(false);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    if (armed) confirmRef.current?.focus();
    else armRef.current?.focus();
  }, [armed]);

  if (!armed) {
    return (
      <button
        type="button"
        ref={armRef}
        className="apnl-btn apnl-btn--danger"
        disabled={busy}
        onClick={() => {
          moveFocus.current = true;
          setArmed(true);
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="apnl-confirm">
      <span>{question}</span>
      <button
        type="button"
        ref={confirmRef}
        className="apnl-btn apnl-btn--danger"
        disabled={busy}
        onClick={onConfirm}
      >
        {busy ? 'Deleting...' : 'Confirm delete'}
      </button>
      <button
        type="button"
        className="apnl-btn apnl-btn--ghost"
        disabled={busy}
        onClick={() => {
          moveFocus.current = true;
          setArmed(false);
        }}
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
  invalidKeys,
  errorId,
}: {
  fields: ListFieldSpec<D>[];
  draft: D;
  set: EditState<D>['set'];
  disabled: boolean;
  invalidKeys: string[];
  errorId: string;
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
            invalid={invalidKeys.includes(field.key)}
            errorId={errorId}
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
            invalid={invalidKeys.includes(field.key)}
            errorId={errorId}
            onChange={(value) => set(field.key, value as D[Extract<keyof D, string>])}
          />
        ),
      )}
    </>
  );
}

function missingRequiredKeys<D extends Record<string, string>>(
  fields: ListFieldSpec<D>[],
  draft: D,
): string[] {
  return fields
    .filter((field) => field.required && str(draft[field.key]).trim() === '')
    .map((field) => field.key as string);
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
  const errorId = useId();

  const heading = str(draft[nameKey]).trim() || `Untitled ${singular}`;
  // Recomputed every render, so the red flag clears as soon as the user types.
  const invalidKeys = save.error ? missingRequiredKeys(fields, draft) : [];

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
      <DraftFields
        fields={fields}
        draft={draft}
        set={set}
        disabled={save.saving || remove.saving}
        invalidKeys={invalidKeys}
        errorId={errorId}
      />
      {remove.error ? <Alert>{remove.error}</Alert> : null}
      <SaveBar
        dirty={dirty}
        save={save}
        onSave={handleSave}
        onReset={reset}
        errorId={errorId}
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
  const [added, setAdded] = useState(0);
  const save = useSaveState();
  const errorId = useId();

  const set = useCallback<EditState<D>['set']>((key, value) => {
    setDraft((current) => ({ ...current, [key]: value }) as D);
  }, []);

  const touched = fields.some((field) => str(draft[field.key]) !== str(blank[field.key]));
  // A half-typed new entry is unsaved work too -- the shell must warn about it.
  useDirtyRegistration(open && touched);

  const invalidKeys = save.error ? missingRequiredKeys(fields, draft) : [];

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
      // Stay open, cleared and ready: adding several in a row is the normal
      // case, and closing after each one meant re-finding this form every time.
      setDraft(blank);
      setAdded((count) => count + 1);
      await onSaved();
    });
  };

  if (!open) {
    return (
      <button type="button" className="apnl-btn" onClick={() => setOpen(true)}>
        + Add {singular}
      </button>
    );
  }

  return (
    <article className="apnl-item apnl-item--new">
      <div className="apnl-item-head">
        <h3 className="apnl-item-name">New {singular}</h3>
        {added > 0 ? (
          <span className="apnl-item-id">
            {added} added this session
          </span>
        ) : null}
      </div>
      <DraftFields
        fields={fields}
        draft={draft}
        set={set}
        disabled={save.saving}
        invalidKeys={invalidKeys}
        errorId={errorId}
      />
      {save.error ? <Alert id={errorId}>{save.error}</Alert> : null}
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
          {touched ? 'Discard' : 'Close'}
        </button>
        {touched && !save.saving ? (
          <span className="apnl-status apnl-status--dirty">Unsaved changes</span>
        ) : null}
        {!touched && save.status === 'saved' ? (
          <span className="apnl-status apnl-status--saved">Added -- ready for the next one</span>
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
        <NewItem
          capsuleId={capsuleId}
          fields={fields}
          blank={blank}
          singular={singular}
          collection={collection}
          onSaved={onSaved}
        />
        {items.length === 0 ? (
          <p className="apnl-empty">
            No {singular} entries for this capsule yet. Add the first one above.
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
      </div>
    </div>
  );
}
