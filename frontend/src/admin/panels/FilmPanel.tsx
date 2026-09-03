/**
 * FilmPanel -- the capsule's film and, most importantly, its video source.
 *
 * Staff are handed whatever the studio emails them: a full `<iframe>` embed
 * snippet, a `player.vimeo.com/video/ID?h=HASH` link, a `vimeo.com/ID/HASH`
 * link, a YouTube URL, or a bare mp4. All of that goes into ONE field
 * (`video_url`); the backend normalizes it into video_provider / video_id /
 * video_hash on save. So the panel leads with a big paste box, shows what the
 * system understood underneath it, and keeps the raw provider columns behind an
 * "advanced" disclosure for the rare manual override.
 *
 * THE DERIVED-FIELD RULE (this is load-bearing -- see `handleVideoUrlChange`):
 * the backend only re-derives provider / id / hash from `video_url` when
 * `video_provider` is empty, and only re-fetches the Vimeo poster and runtime
 * when `thumbnail_url` / `video_duration_seconds` are empty. Because this panel
 * commits the server's row back into the draft after every save, a second save
 * would otherwise re-send the *previous* film's derived columns alongside the
 * new link -- the backend would skip re-parsing, and the public player (which
 * prefers the explicit columns) would keep playing the old film and showing its
 * poster. So: changing the link clears the fields it derives.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import type { Film, VideoProvider } from '../../types';
import { formatRuntime, resolveVideoSource } from '../../videoSource';
import { adminFetch } from '../adminClient';
import {
  Disclosure,
  FormRow,
  Note,
  PanelHead,
  ReadOnlyValue,
  SaveBar,
  Section,
  SelectField,
  TextArea,
  TextField,
} from './Fields';
import type { PanelProps } from './Fields';
import { intOrNull, orNull, str, useEditState, useSaveState } from './formState';

type FilmDraft = {
  title: string;
  director: string;
  duration: string;
  description: string;
  theme: string;
  bts_text: string;
  screenplay_text: string;
  thumbnail_url: string;
  captions_url: string;
  video_url: string;
  video_provider: VideoProvider | '';
  video_id: string;
  video_hash: string;
  video_aspect_ratio: string;
  video_duration_seconds: string;
};

/** Everything the server derives from `video_url` when it is left blank. */
const DERIVED_KEYS = [
  'video_provider',
  'video_id',
  'video_hash',
  'thumbnail_url',
  'video_duration_seconds',
] as const;

type DerivedKey = (typeof DERIVED_KEYS)[number];

const CLEARED: Pick<FilmDraft, DerivedKey> = {
  video_provider: '',
  video_id: '',
  video_hash: '',
  thumbnail_url: '',
  video_duration_seconds: '',
};

const PROVIDER_OPTIONS: { value: VideoProvider | ''; label: string }[] = [
  { value: '', label: 'Auto-detect from the pasted link' },
  { value: 'vimeo', label: 'Vimeo' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'mux', label: 'Mux' },
  { value: 'file', label: 'Direct file (mp4 / webm)' },
];

function toDraft(film: Film | undefined): FilmDraft {
  return {
    title: str(film?.title),
    director: str(film?.director),
    duration: str(film?.duration),
    description: str(film?.description),
    theme: str(film?.theme),
    bts_text: str(film?.bts_text),
    screenplay_text: str(film?.screenplay_text),
    thumbnail_url: str(film?.thumbnail_url),
    captions_url: str(film?.captions_url),
    video_url: str(film?.video_url),
    video_provider: (film?.video_provider ?? '') as VideoProvider | '',
    video_id: str(film?.video_id),
    video_hash: str(film?.video_hash),
    video_aspect_ratio: str(film?.video_aspect_ratio),
    video_duration_seconds: str(film?.video_duration_seconds),
  };
}

export function FilmPanel({ capsule, onSaved }: PanelProps) {
  const incoming = useMemo(() => toDraft(capsule.film), [capsule.film]);
  const { draft, baseline, dirty, set, setMany, reset, commit } = useEditState<FilmDraft>(incoming);
  const save = useSaveState();
  const errorId = useId();

  /**
   * Derived fields the user typed into by hand. These are never auto-cleared:
   * an explicit override always beats the parser, which is exactly what the
   * "Advanced" disclosure promises.
   */
  const [pinned, setPinned] = useState<DerivedKey[]>([]);

  // A new server row (a save, or a refetch adopted while clean) is a fresh
  // start: nothing is overridden until the user overrides it again.
  useEffect(() => {
    setPinned((current) => (current.length === 0 ? current : []));
  }, [baseline]);

  /** True once the pasted link differs from what the server currently holds. */
  const linkChanged = draft.video_url !== baseline.video_url;

  const handleVideoUrlChange = (value: string) => {
    const changed = value !== baseline.video_url;
    // Changed link -> blank the derived columns so the backend re-parses from
    // scratch. Reverted back to the saved link -> put the saved values back.
    const source = changed ? CLEARED : baseline;
    const keep = (key: DerivedKey) => pinned.includes(key);
    setMany({
      video_url: value,
      video_provider: keep('video_provider') ? draft.video_provider : source.video_provider,
      video_id: keep('video_id') ? draft.video_id : source.video_id,
      video_hash: keep('video_hash') ? draft.video_hash : source.video_hash,
      thumbnail_url: keep('thumbnail_url') ? draft.thumbnail_url : source.thumbnail_url,
      video_duration_seconds: keep('video_duration_seconds')
        ? draft.video_duration_seconds
        : source.video_duration_seconds,
    });
  };

  /** Any hand-edit of a derived field pins it; emptying it hands control back. */
  const setDerived = (key: DerivedKey, value: string) => {
    set(key, value);
    setPinned((current) => {
      const held = current.includes(key);
      if (value.trim() === '') return held ? current.filter((k) => k !== key) : current;
      return held ? current : [...current, key];
    });
  };

  // Mirrors the backend's precedence exactly: explicit provider columns win,
  // otherwise the pasted `video_url` is parsed. Same helper the public player
  // uses, so what staff see here is what the site will do.
  const resolved = useMemo(
    () =>
      resolveVideoSource({
        id: 0,
        capsule_id: capsule.id,
        title: draft.title,
        director: draft.director,
        video_url: draft.video_url,
        video_provider: draft.video_provider === '' ? undefined : draft.video_provider,
        video_id: draft.video_id,
        video_hash: draft.video_hash,
      }),
    [
      capsule.id,
      draft.title,
      draft.director,
      draft.video_url,
      draft.video_provider,
      draft.video_id,
      draft.video_hash,
    ],
  );

  const manualOverride = draft.video_provider !== '' && draft.video_id.trim() !== '';
  const runtime = formatRuntime(Number(draft.video_duration_seconds) || undefined);
  const hasFilm = capsule.film !== undefined && capsule.film !== null;

  const badSeconds = intOrNull(draft.video_duration_seconds) === undefined;
  const invalid = save.error
    ? {
        title: draft.title.trim() === '',
        director: draft.director.trim() === '',
        video_duration_seconds: badSeconds,
      }
    : { title: false, director: false, video_duration_seconds: false };

  const handleSave = () => {
    if (draft.title.trim() === '' || draft.director.trim() === '') {
      save.fail('Title and director are both required.');
      return;
    }
    const seconds = intOrNull(draft.video_duration_seconds);
    if (seconds === undefined) {
      save.fail('Runtime (seconds) must be a whole number, or left blank.');
      return;
    }

    void save.run(async () => {
      // PUT is an upsert: it creates the film row when the capsule has none.
      const saved = await adminFetch<Film>(`/api/admin/capsules/${capsule.id}/film`, {
        method: 'PUT',
        body: {
          title: draft.title,
          director: draft.director,
          duration: orNull(draft.duration),
          description: orNull(draft.description),
          theme: orNull(draft.theme),
          bts_text: orNull(draft.bts_text),
          screenplay_text: orNull(draft.screenplay_text),
          thumbnail_url: orNull(draft.thumbnail_url),
          captions_url: orNull(draft.captions_url),
          video_url: orNull(draft.video_url),
          video_provider: draft.video_provider === '' ? null : draft.video_provider,
          video_id: orNull(draft.video_id),
          video_hash: orNull(draft.video_hash),
          video_aspect_ratio: orNull(draft.video_aspect_ratio),
          video_duration_seconds: seconds,
        },
      });
      // Adopt the server's version of the row: saving a Vimeo source also fills
      // in thumbnail_url / video_duration_seconds from Vimeo, and staff should
      // see those appear rather than be told their form is still dirty.
      commit(toDraft(saved));
      await onSaved();
    });
  };

  return (
    <div className="apnl">
      <PanelHead
        title="Film"
        description={
          hasFilm
            ? 'The film shown on this capsule, and the video source the player uses.'
            : 'This capsule has no film yet. Fill this in and save to create one.'
        }
      />

      <Section title="Video source">
        <TextArea
          label="Paste embed code or link"
          value={draft.video_url}
          rows={4}
          mono
          disabled={save.saving}
          placeholder={'<iframe src="https://player.vimeo.com/video/1052574030?h=53c90178cb" ...></iframe>'}
          onChange={handleVideoUrlChange}
          help={
            <>
              Paste the whole <code>&lt;iframe&gt;</code> tag exactly as the studio sent it -- no need
              to dig the URL out of it. A <code>player.vimeo.com/video/ID?h=HASH</code> URL, a{' '}
              <code>vimeo.com/ID/HASH</code> link, a YouTube link, or a direct <code>.mp4</code> URL
              all work too. Saving normalizes whatever you paste into the provider fields below.
            </>
          }
        />

        <div className="apnl-resolved">
          <span className="apnl-label">
            {manualOverride
              ? 'Resolved source (from the manual fields below)'
              : linkChanged
                ? 'Resolved source (will be re-resolved from the link above on save)'
                : 'Resolved source (read from what you pasted)'}
          </span>
          {resolved ? (
            <div className="apnl-resolved-grid">
              <ReadOnlyValue label="Provider" value={resolved.provider} />
              <ReadOnlyValue label="Video id" value={resolved.id || str(resolved.url)} />
              <ReadOnlyValue label="Private hash" value={str(resolved.hash)} />
            </div>
          ) : (
            <p className="apnl-help">
              Nothing recognizable yet -- paste an embed snippet or a link above, or set the provider
              fields manually. The capsule page will show its fallback card until this resolves.
            </p>
          )}
          {linkChanged ? (
            <Note>
              {manualOverride
                ? 'The link changed, but the provider fields under "Advanced" are set by hand, so those still win. Clear them to let this new link decide.'
                : 'New link. The stored provider, video id, hash, poster image and runtime have been cleared -- saving will resolve them all from this link, and fetch a fresh Vimeo poster.'}
            </Note>
          ) : null}
          <p className="apnl-help">
            This is a preview of how the source reads right now. The server re-parses it on save, and
            the stored values are what the public player uses.
          </p>
        </div>

        <Disclosure summary="Advanced: set provider fields manually">
          <p className="apnl-help">
            Only needed when the automatic parse gets it wrong. Setting a provider and id here
            overrides whatever was pasted above -- clear them to hand control back to the parser.
          </p>
          <FormRow>
            <SelectField
              label="Provider"
              value={draft.video_provider}
              options={PROVIDER_OPTIONS}
              disabled={save.saving}
              onChange={(value) => setDerived('video_provider', value)}
            />
            <TextField
              label="Video id"
              value={draft.video_id}
              mono
              disabled={save.saving}
              placeholder="1052574030"
              onChange={(value) => setDerived('video_id', value)}
            />
            <TextField
              label="Private hash"
              value={draft.video_hash}
              mono
              disabled={save.saving}
              placeholder="53c90178cb"
              onChange={(value) => setDerived('video_hash', value)}
              help="Vimeo unlisted-link hash. Leave blank for public videos."
            />
          </FormRow>
        </Disclosure>

        <FormRow>
          <TextField
            label="Aspect ratio"
            value={draft.video_aspect_ratio}
            mono
            disabled={save.saving}
            placeholder="16 / 9"
            onChange={(value) => set('video_aspect_ratio', value)}
            help="CSS aspect-ratio, e.g. 16 / 9. Blank falls back to 16 / 9."
          />
          <TextField
            label="Runtime (seconds)"
            value={draft.video_duration_seconds}
            mono
            inputMode="numeric"
            disabled={save.saving}
            placeholder="1080"
            invalid={invalid.video_duration_seconds}
            errorId={errorId}
            onChange={(value) => setDerived('video_duration_seconds', value)}
            help={runtime ? `Shows as "${runtime}". Vimeo fills this in on save.` : 'Vimeo fills this in on save.'}
          />
        </FormRow>

        <FormRow>
          <TextField
            label="Thumbnail URL"
            value={draft.thumbnail_url}
            mono
            inputMode="url"
            disabled={save.saving}
            placeholder="https://i.vimeocdn.com/video/..."
            onChange={(value) => setDerived('thumbnail_url', value)}
            help="Usually leave blank: for Vimeo, saving auto-fetches the real poster frame (and the runtime) from Vimeo. Only fill this in to override that."
          />
          <TextField
            label="Captions URL"
            value={draft.captions_url}
            mono
            inputMode="url"
            disabled={save.saving}
            placeholder="https://.../captions.vtt"
            onChange={(value) => set('captions_url', value)}
            help="WebVTT track for direct-file videos. Vimeo and YouTube carry their own captions."
          />
        </FormRow>
      </Section>

      <Section title="Film details">
        <FormRow>
          <TextField
            label="Title"
            value={draft.title}
            required
            disabled={save.saving}
            invalid={invalid.title}
            errorId={errorId}
            onChange={(value) => set('title', value)}
          />
          <TextField
            label="Director"
            value={draft.director}
            required
            disabled={save.saving}
            invalid={invalid.director}
            errorId={errorId}
            onChange={(value) => set('director', value)}
          />
        </FormRow>
        <FormRow>
          <TextField
            label="Duration (display)"
            value={draft.duration}
            disabled={save.saving}
            placeholder="10 min"
            onChange={(value) => set('duration', value)}
            help="The label shown next to the film, written how you want it read."
          />
          <TextField
            label="Theme"
            value={draft.theme}
            disabled={save.saving}
            placeholder="Memory, distance, repair"
            onChange={(value) => set('theme', value)}
          />
        </FormRow>
        <TextArea
          label="Description"
          value={draft.description}
          rows={5}
          disabled={save.saving}
          onChange={(value) => set('description', value)}
          help="The synopsis on the capsule page."
        />
      </Section>

      <Section title="Extended material">
        <TextArea
          label="Behind the scenes"
          value={draft.bts_text}
          rows={8}
          disabled={save.saving}
          onChange={(value) => set('bts_text', value)}
          help="Long-form notes from the filmmaker. Line breaks are kept exactly as typed."
        />
        <TextArea
          label="Screenplay excerpt"
          value={draft.screenplay_text}
          rows={10}
          mono
          disabled={save.saving}
          onChange={(value) => set('screenplay_text', value)}
          help="Screenplay formatting (indentation, blank lines) is preserved verbatim."
        />
      </Section>

      <SaveBar
        dirty={dirty}
        save={save}
        onSave={handleSave}
        onReset={reset}
        sticky
        errorId={errorId}
        saveLabel={hasFilm ? 'Save film' : 'Create film'}
      />
    </div>
  );
}
