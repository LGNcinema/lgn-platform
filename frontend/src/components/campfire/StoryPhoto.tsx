import { createContext, useContext, useEffect, useState } from 'react';
import { API_URL } from '../../api';
import type { CapsulePhoto } from '../../types';

/**
 * How a story photo's bytes are fetched. On the public site, null: the photo
 * is a plain <img> on its public URL. The admin preview provides a loader
 * that fetches with the admin token instead, because an unpublished story's
 * photos are not public.
 */
export const PhotoLoaderContext = createContext<((photo: CapsulePhoto) => Promise<Blob | null>) | null>(null);

interface Props {
  photo: CapsulePhoto;
  className?: string;
  alt?: string;
}

export function StoryPhoto({ photo, className, alt }: Props) {
  const loader = useContext(PhotoLoaderContext);
  const [src, setSrc] = useState<string | null>(loader ? null : `${API_URL}${photo.url}`);

  useEffect(() => {
    if (!loader) {
      setSrc(`${API_URL}${photo.url}`);
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    loader(photo)
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
  }, [loader, photo]);

  return src ? (
    <img className={className} src={src} alt={alt ?? photo.caption ?? ''} loading="lazy" decoding="async" />
  ) : (
    <span className={className} aria-hidden="true" />
  );
}
