/**
 * BtsPhotos -- photos for the story's behind-the-scenes page ("How this film
 * was made"): the gallery (up to nine; upload, caption, reorder, delete), or,
 * with `kind` 'hero' / 'logo', the page's one large picture or its logo
 * (upload replaces, delete clears).
 *
 * Photos are shrunk in this browser before upload (longest side 2400px for
 * the large picture, 1600px otherwise; JPEG, or PNG for a logo so its
 * transparency survives), so a phone photo never travels at full size.
 */
import { useEffect, useRef, useState } from 'react';
import type { CapsuleDetail, CapsulePhoto } from '../../types';
import { API_URL, adminFetch, getToken } from '../adminClient';
import { Alert, Note, Section } from './Fields';
import type { PanelProps } from './Fields';

export type PhotoKind = 'bts' | 'hero' | 'logo';

/** The gallery is a 3 x 3 grid; the server holds it to this too. */
const MAX_GALLERY = 9;

/** A picked file as a data URL, at most `maxSide` on its longest side. */
async function shrink(file: File, maxSide: number, png: boolean): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error('That photo could not be opened here. Try a JPG or PNG.');
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not prepare the photo.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The photo, fetched with the admin token (drafts' photos aren't public). */
function AdminPhoto({ id, contain }: { id: number; contain?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    const token = getToken();
    fetch(`${API_URL}/api/admin/capsule-photos/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return <span className={`apnl-bts-thumb${contain ? ' apnl-bts-thumb--contain' : ''}`}>{src ? <img src={src} alt="" /> : null}</span>;
}

function PhotoRow({
  photo,
  single,
  first,
  last,
  onMove,
  onChanged,
}: {
  photo: CapsulePhoto;
  /** The large picture or the logo: no caption, nothing to reorder. */
  single: boolean;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onChanged: () => void | Promise<void>;
}) {
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = caption !== (photo.caption ?? '');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="apnl-bts-row">
      <AdminPhoto id={photo.id} contain={single} />
      <div className="apnl-bts-fields">
        {!single && (
          <>
            <label className="admin-field-label" htmlFor={`bts-caption-${photo.id}`}>
              Caption (optional, read aloud to screen readers)
            </label>
            <input
              id={`bts-caption-${photo.id}`}
              className="apnl-input"
              value={caption}
              disabled={busy}
              onChange={(e) => setCaption(e.target.value)}
            />
          </>
        )}
        <div className="apnl-bts-actions">
          {!single && dirty && (
            <button
              type="button"
              className="apnl-btn apnl-btn--primary"
              disabled={busy}
              onClick={() => void run(() => adminFetch(`/api/admin/capsule-photos/${photo.id}`, { method: 'PATCH', body: { caption } }))}
            >
              Save caption
            </button>
          )}
          {!single && (
            <>
              <button type="button" className="apnl-btn apnl-btn--ghost" disabled={busy || first} onClick={() => onMove(-1)} aria-label="Move earlier">
                ↑
              </button>
              <button type="button" className="apnl-btn apnl-btn--ghost" disabled={busy || last} onClick={() => onMove(1)} aria-label="Move later">
                ↓
              </button>
            </>
          )}
          <button
            type="button"
            className="apnl-btn apnl-btn--ghost apnl-btn--danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Delete this photo permanently?')) {
                void run(() => adminFetch(`/api/admin/capsule-photos/${photo.id}`, { method: 'DELETE' }));
              }
            }}
          >
            Delete
          </button>
        </div>
        {error && <Alert>{error}</Alert>}
      </div>
    </li>
  );
}

/** Each kind's place on the page, and how it is uploaded. */
const KINDS: Record<PhotoKind, { title: string; note: string; maxSide: number; png: boolean }> = {
  hero: {
    title: 'Large picture',
    note: 'Across the top of the page, under "< [film]". A wide still (16:9) works best.',
    maxSide: 2400,
    png: false,
  },
  logo: {
    title: 'Distributor / production company logo',
    note: 'Under the copyright line. A PNG with a transparent background works best.',
    maxSide: 1200,
    png: true,
  },
  bts: {
    title: 'Gallery',
    note: `Up to ${MAX_GALLERY} photos, three to a row, in this order.`,
    maxSide: 1600,
    png: false,
  },
};

function photosOf(capsule: CapsuleDetail, kind: PhotoKind): CapsulePhoto[] {
  if (kind === 'hero') return capsule.bts_hero ? [capsule.bts_hero] : [];
  if (kind === 'logo') return capsule.bts_logo ? [capsule.bts_logo] : [];
  return capsule.bts_photos ?? [];
}

interface Props extends PanelProps {
  kind: PhotoKind;
}

export function BtsPhotos({ capsule, onSaved, kind }: Props) {
  const spec = KINDS[kind];
  const single = kind !== 'bts';
  const photos = photosOf(capsule, kind);
  const room = single ? 1 : MAX_GALLERY - photos.length;
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files).slice(0, Math.max(room, 0));
    if (files.length > list.length) setError(`The gallery holds ${MAX_GALLERY} photos, so only the first ${list.length} were added.`);
    setUploading(list.length);
    try {
      for (const file of list) {
        const image = await shrink(file, spec.maxSide, spec.png);
        await adminFetch(`/api/admin/capsules/${capsule.id}/photos`, { method: 'POST', body: { image, kind } });
        setUploading((n) => n - 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A photo could not be uploaded.');
    } finally {
      setUploading(0);
      if (fileRef.current) fileRef.current.value = '';
      await onSaved();
    }
  };

  // Swap positions with the neighbour (positions are renumbered 1..n first, so
  // equal or missing ones from older rows sort out too).
  const move = async (index: number, dir: -1 | 1) => {
    const order = photos.map((p) => p.id);
    const other = index + dir;
    [order[index], order[other]] = [order[other], order[index]];
    setError(null);
    try {
      await Promise.all(
        order.map((id, i) => adminFetch(`/api/admin/capsule-photos/${id}`, { method: 'PATCH', body: { position: i + 1 } })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The new order could not be saved.');
    }
    await onSaved();
  };

  const addLabel = single ? (photos.length ? 'Replace' : '+ Upload') : '+ Add photos';

  return (
    <Section title={spec.title}>
      <Note>{spec.note}</Note>
      {photos.length > 0 && (
        <ol className="apnl-bts-list">
          {photos.map((photo, i) => (
            <PhotoRow
              key={photo.id}
              photo={photo}
              single={single}
              first={i === 0}
              last={i === photos.length - 1}
              onMove={(dir) => void move(i, dir)}
              onChanged={onSaved}
            />
          ))}
        </ol>
      )}
      <div className="apnl-savebar">
        <button type="button" className="apnl-btn" disabled={uploading > 0 || room <= 0} onClick={() => fileRef.current?.click()}>
          {uploading > 0 ? `Uploading ${uploading}...` : room <= 0 ? `Gallery full (${MAX_GALLERY})` : addLabel}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple={!single}
          hidden
          onChange={(e) => void upload(e.target.files)}
        />
      </div>
      {error && <Alert>{error}</Alert>}
    </Section>
  );
}
