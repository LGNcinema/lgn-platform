import { useEffect, useMemo } from 'react';
import './StoryShell.css';
import './StoryBehind.css';
import type { CapsuleDetail } from '../../types';
import { StoryPhoto } from './StoryPhoto';

interface Props {
  capsule: CapsuleDetail;
  /** "< [film]": back to the film's page. */
  onBack: () => void;
}

interface CreditRow {
  role: string;
  names: string;
}

/**
 * The admin's credits text as groups of rows: one "Role: Name, Name" per line,
 * a blank line between groups. A role with no names yet is left out, so the
 * standard roles can sit in the admin unfilled. A line without a colon is all
 * names.
 */
export function parseCredits(text: string | null | undefined): CreditRow[][] {
  const groups: CreditRow[][] = [];
  let current: CreditRow[] = [];
  for (const raw of (text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      if (current.length) groups.push(current);
      current = [];
      continue;
    }
    const colon = line.indexOf(':');
    const role = colon === -1 ? '' : line.slice(0, colon).trim();
    const names = (colon === -1 ? line : line.slice(colon + 1)).trim();
    if (names) current.push({ role, names });
  }
  if (current.length) groups.push(current);
  return groups;
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

/** Paragraphs from a text field: blank lines separate them. */
const paragraphs = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/**
 * "How this film was made". Figma v3: "Campfire—bts".
 *
 * At 1920: "< [film]" where the film page has "< Go Beyond"; the large picture
 * x 40..1881 from y 274 (16:9); the title (48px); then a row with the copyright
 * line and logo at the left margin and the credits from x = 660 (roles) and
 * 970 (names); a 3 x 3 gallery; and the written sections, each heading at the
 * left margin and its paragraphs from x = 660, 900 wide.
 *
 * Every part comes from the admin's Behind the Scenes tab and is left out when
 * empty.
 */
export function StoryBehind({ capsule, onBack }: Props) {
  const credits = useMemo(() => parseCredits(capsule.bts_credits), [capsule.bts_credits]);
  const photos = capsule.bts_photos ?? [];
  const sections = capsule.bts_sections ?? [];
  const copyright = capsule.bts_copyright?.trim();

  // A section change keeps the scroll position; this page starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [capsule.id]);

  return (
    <div className="story-behind">
      <button type="button" className="story-shell-back" onClick={onBack}>
        &lt; {capsule.title}
      </button>

      {capsule.bts_hero && <StoryPhoto photo={capsule.bts_hero} className="story-behind-hero" alt="" />}

      <h1 className="story-behind-title">{capsule.title}</h1>

      {(copyright || capsule.bts_logo || credits.length > 0) && (
        <div className="story-behind-info">
          <div className="story-behind-rights">
            {copyright && <p className="story-behind-copyright">{copyright}</p>}
            {capsule.bts_logo && (
              <StoryPhoto photo={capsule.bts_logo} className="story-behind-logo" alt="Distributor / production company logo" />
            )}
          </div>

          {credits.length > 0 && (
            <section className="story-behind-credits" aria-labelledby="story-behind-credits">
              <h2 id="story-behind-credits" className="story-behind-credits-label">
                Credits
              </h2>
              {credits.map((group, g) => (
                <dl key={g} className="story-behind-credit-group">
                  {group.map((row, i) => (
                    <div key={i} className="story-behind-credit">
                      <dt>{row.role}</dt>
                      <dd>{row.names}</dd>
                    </div>
                  ))}
                </dl>
              ))}
            </section>
          )}
        </div>
      )}

      {photos.length > 0 && (
        <ul className="story-behind-gallery" aria-label="Photos from the making of the film">
          {photos.map((photo) => (
            <li key={photo.id}>
              <StoryPhoto photo={photo} className="story-behind-photo" />
            </li>
          ))}
        </ul>
      )}

      {sections.map((s) => (
        <section key={s.id} className="story-behind-section">
          <h2 className="story-behind-section-heading">{s.heading?.trim()}</h2>
          <div className="story-behind-section-body">
            {paragraphs(s.body).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
