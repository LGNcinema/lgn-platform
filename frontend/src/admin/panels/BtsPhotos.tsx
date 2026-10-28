/**
 * BtsPhotos -- the story's behind-the-scenes photos: upload, caption, reorder,
 * delete. Shown on the Watch tab under the behind-the-scenes text.
 *
 * Not on the public site yet: where they appear in V3 (likely a carousel
 * behind a "Behind the Scenes" button) is still to be decided. Photos are
 * shrunk in this browser before upload (longest side 1600px, JPEG), so a phone
 * photo never travels at full size.
 */
import { useEffect, useRef, useState } from 'react';
import type { CapsulePhoto } from '../../types';
import { API_URL, adminFetch, getToken } from '../adminClient';
import { Alert, Note, Section } from './Fields';
import type { PanelProps } from './Fields';

const MAX_SIDE = 1600;

/** A picked file as a JPEG data URL, at most MAX_SIDE on its longest side. */
async function shrink(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error('That photo could not be opened here. Try a JPG or PNG.');
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not prepare the photo.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The photo, fetched with the admin token (drafts' photos aren't public). */
function AdminPhoto({ id }: { id: number }) {
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
  return <span className="apnl-bts-thumb">{src ? <img src={src} alt="" /> : null}</span>;
}

function PhotoRow({
  photo,
  first,
  last,
  onMove,
  onChanged,
}: {
  photo: CapsulePhoto;
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
      <AdminPhoto id={photo.id} />
      <div className="apnl-bts-fields">
        <label className="admin-field-label" htmlFor={`bts-caption-${photo.id}`}>
          Caption (optional)
        </label>
        <input
          id={`bts-caption-${photo.id}`}
          className="apnl-input"
          value={caption}
          disabled={busy}
          onChange={(e) => setCaption(e.target.value)}
        />
        <div className="apnl-bts-actions">
          {dirty && (
            <button
              type="button"
              className="apnl-btn apnl-btn--primary"
              disabled={busy}
              onClick={() => void run(() => adminFetch(`/api/admin/capsule-photos/${photo.id}`, { method: 'PATCH', body: { caption } }))}
            >
              Save caption
            </button>
          )}
          <button type="button" className="apnl-btn apnl-btn--ghost" disabled={busy || first} onClick={() => onMove(-1)} aria-label="Move earlier">
            ↑
          </button>
          <button type="button" className="apnl-btn apnl-btn--ghost" disabled={busy || last} onClick={() => onMove(1)} aria-label="Move later">
            ↓
          </button>
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

export function BtsPhotos({ capsule, onSaved }: PanelProps) {
  const photos = capsule.bts_photos ?? [];
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files);
    setUploading(list.length);
    try {
      for (const file of list) {
        const image = await shrink(file);
        await adminFetch(`/api/admin/capsules/${capsule.id}/photos`, { method: 'POST', body: { image } });
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

  return (
    <Section title="Behind-the-scenes photos">
      <Note>
        For a carousel above the behind-the-scenes text. Saved now, but not shown on the public site until
        its place in the V3 film page is decided.
      </Note>
      {photos.length > 0 && (
        <ol className="apnl-bts-list">
          {photos.map((photo, i) => (
            <PhotoRow
              key={photo.id}
              photo={photo}
              first={i === 0}
              last={i === photos.length - 1}
              onMove={(dir) => void move(i, dir)}
              onChanged={onSaved}
            />
          ))}
        </ol>
      )}
      <div className="apnl-savebar">
        <button type="button" className="apnl-btn" disabled={uploading > 0} onClick={() => fileRef.current?.click()}>
          {uploading > 0 ? `Uploading ${uploading}...` : '+ Add photos'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void upload(e.target.files)}
        />
      </div>
      {error && <Alert>{error}</Alert>}
    </Section>
  );
}
