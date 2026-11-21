import { useEffect, useState } from 'react';
import './StoryShell.css';
import './StoryBehind.css';
import type { CapsuleDetail } from '../../types';
import { StoryPhoto } from './StoryPhoto';
import { RichText } from '../RichText';
import { CastCrewDialog } from './StoryDialogs';
import { filmFacts, parseCredits } from '../../filmInfo';

interface Props {
  capsule: CapsuleDetail;
  /** "< [film]": back to the film's page. */
  onBack: () => void;
}


/** Whether the story has a behind-the-scenes page to offer. */
export function hasBehindTheScenes(capsule: CapsuleDetail): boolean {
  return Boolean(
    capsule.bts_hero ||
      capsule.bts_logo ||
      capsule.bts_copyright?.trim() ||
      parseCredits(capsule.bts_credits).length ||
      capsule.bts_photos?.length ||
      capsule.bts_sections?.length,
  );
}

/**
 * "Behind the film". Figma "BEHIND THE FILM", at 1920:
 *
 * "<" back to the film; the large picture x 40..1880; then two columns --
 * on the left the title (48 size), the film's year / director / runtime, its
 * description and "+ Cast and Crew" (the credits, in a popup), with the
 * copyright line and logo under them; on the right (the 660 line) "Behind
 * the film" and the written sections as ruled rows, each heading at 660 and
 * its paragraphs at 970. Then a 3-column gallery.
 *
 * Every part comes from the admin's Behind the Film tab and is left out when
 * empty.
 */
export function StoryBehind({ capsule, onBack }: Props) {
  const photos = capsule.bts_photos ?? [];
  const sections = capsule.bts_sections ?? [];
  const copyright = capsule.bts_copyright?.trim();
  const credits = capsule.bts_credits?.trim();
  const facts = filmFacts(capsule.film);
  const [castOpen, setCastOpen] = useState(false);

  // A section change keeps the scroll position; this page starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [capsule.id]);

  return (
    <div className="story-behind">
      <button type="button" className="story-shell-back" aria-label={`Back to ${capsule.title}`} onClick={onBack}>
        &lt;
      </button>

      {capsule.bts_hero && <StoryPhoto photo={capsule.bts_hero} className="story-behind-hero" alt="" />}

      <div className="story-behind-columns">
        <div className="story-behind-film">
          <h1 className="story-behind-title">{capsule.title}</h1>
          {facts.length > 0 && (
            <p className="story-behind-facts">
              {facts.map((f, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {f}
                </span>
              ))}
            </p>
          )}
          {capsule.film?.description?.trim() && <p className="story-behind-description">{capsule.film.description.trim()}</p>}
          {credits && (
            <button type="button" className="story-shell-cast" onClick={() => setCastOpen(true)}>
              + Cast and Crew
            </button>
          )}
          {(copyright || capsule.bts_logo) && (
            <div className="story-behind-rights">
              {copyright && <p className="story-behind-copyright">{copyright}</p>}
              {capsule.bts_logo && (
                <StoryPhoto photo={capsule.bts_logo} className="story-behind-logo" alt="Distributor / production company logo" />
              )}
            </div>
          )}
        </div>

        {sections.length > 0 && (
          <div className="story-behind-written">
            <h2 className="story-behind-heading">Behind the film</h2>
            {sections.map((s) => (
              <section key={s.id} className="story-behind-section">
                <h3 className="story-behind-section-heading">{s.heading?.trim()}</h3>
                <RichText text={s.body} className="story-behind-section-body" />
              </section>
            ))}
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <ul className="story-behind-gallery" aria-label="Photos from the making of the film">
          {photos.map((photo) => (
            <li key={photo.id}>
              <StoryPhoto photo={photo} className="story-behind-photo" />
            </li>
          ))}
        </ul>
      )}

      {credits && (
        <CastCrewDialog open={castOpen} onClose={() => setCastOpen(false)} title={capsule.title} credits={credits} />
      )}
    </div>
  );
}
