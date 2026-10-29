/**
 * PreviewFrame -- the page the admin Preview tab loads inside its iframe.
 *
 * The public layout is measured against the browser window (`--dp` is
 * 100vw / 1920, and the columns are placed from the page centre), so it can
 * only look right in a window of its own. The Preview tab therefore gives it
 * one: an iframe exactly 1920 x 1080, scaled down to fit. Inside it, this page
 * renders the story the way App does -- header, story page, footer -- so vw,
 * media queries and `document` all mean what they mean on the real site.
 *
 * It holds no data of its own and fetches nothing. The admin tab posts it the
 * saved story over postMessage, and only a same-origin parent is listened to,
 * so opening /admin/preview-frame directly shows an empty page: an unpublished
 * film is never exposed by this route.
 */
import { useEffect, useState } from 'react';
import { hasBehindTheScenes, StoryBehind } from '../components/campfire/StoryBehind';
import { PhotoLoaderContext } from '../components/campfire/StoryPhoto';
import { StoryPractice } from '../components/campfire/StoryPractice';
import { StoryReflect } from '../components/campfire/StoryReflect';
import { StoryShell } from '../components/campfire/StoryShell';
import { StoryWatch } from '../components/campfire/StoryWatch';
import { WatchMode } from '../components/campfire/WatchMode';
import { formatStoryMonth, type StorySection } from '../components/campfire/campfire';
import { SiteFooter } from '../components/chrome/SiteFooter';
import { SiteHeader } from '../components/chrome/SiteHeader';
import type { CapsuleDetail, CapsulePhoto } from '../types';
import { API_URL, getToken } from './adminClient';

/** What the Preview tab sends. */
export interface PreviewMessage {
  type: 'lgn-preview';
  capsule: CapsuleDetail;
  storyNumber: number;
}

/** What this page sends once it is listening, so the tab knows to post. */
export const PREVIEW_READY = 'lgn-preview-ready';

const noop = () => {};

async function loadAdminPhoto(photo: CapsulePhoto): Promise<Blob | null> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/admin/capsule-photos/${photo.id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.ok ? res.blob() : null;
}

export function PreviewFrame() {
  const [data, setData] = useState<PreviewMessage | null>(null);
  // The Preview tab's second window opens on Behind the Film (?section=making).
  const [section, setSection] = useState<StorySection>(() =>
    new URLSearchParams(window.location.search).get('section') === 'making' ? 'making' : 'watch',
  );
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const msg = event.data as PreviewMessage | undefined;
      if (msg?.type === 'lgn-preview') setData(msg);
    };
    window.addEventListener('message', onMessage);
    if (window.parent !== window) window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  if (!data) return null;
  const { capsule, storyNumber } = data;

  // Watch is immersive on the site too: no header or footer.
  if (watching) return <WatchMode capsule={capsule} onExit={() => setWatching(false)} />;

  const page =
    section === 'making' ? (
      <StoryBehind capsule={capsule} onBack={() => setSection('watch')} />
    ) : (
      <StoryShell
        capsule={capsule}
        labels={['LGN', `Story No. ${storyNumber}`, formatStoryMonth(capsule.month)]}
        section={section}
        onSelectSection={setSection}
        onBackToCampfire={noop}
        gemeTuning={null}
        gemeTuningVersion={0}
        leftFoot={
          section === 'watch' && hasBehindTheScenes(capsule) ? (
            <button type="button" className="lgn-btn" onClick={() => setSection('making')}>
              How this film was made
            </button>
          ) : undefined
        }
      >
        {section === 'watch' && <StoryWatch capsule={capsule} onEnterWatch={() => setWatching(true)} />}
        {section === 'reflect' && <StoryReflect capsule={capsule} />}
        {section === 'practice' && <StoryPractice capsule={capsule} />}
      </StoryShell>
    );

  return (
    <>
      <SiteHeader currentView="capsule" theme="light" onNavigate={noop} />
      <div className="page-body" style={{ position: 'relative', flexGrow: 1 }}>
        <main>
          {/* An unpublished story's photos aren't public: fetch them with the
              admin token instead. */}
          <PhotoLoaderContext.Provider value={loadAdminPhoto}>{page}</PhotoLoaderContext.Provider>
        </main>
        <SiteFooter theme="light" onNavigate={noop} />
      </div>
    </>
  );
}
