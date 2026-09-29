import './StoryMaking.css';
import type { CapsuleDetail } from '../../types';

interface Props {
  capsule: CapsuleDetail;
}

/**
 * Normalise a long-form text field for display with its line breaks kept.
 *
 * Content loaded through `supabase/seed.sql` carries the two-character
 * sequence `\n` instead of a real newline (see splitLines in filmInfo.ts), so
 * both forms become real newlines here. Unlike splitLines, blank lines and
 * leading spaces are kept: paragraph breaks matter in prose, and a
 * screenplay's indentation IS its formatting.
 */
const withLineBreaks = (value?: string | null): string =>
  (value ?? '').replace(/\r\n|\n/g, '\n').replace(/\r\n?/g, '\n').trim();

/**
 * "More on making this film" -- the film's behind-the-scenes text and its
 * screenplay, in the story page's right column. No Figma frame exists for
 * this; the type follows the Reflect right column ([CAMPFIRE]-REFLECT): 24px
 * medium headings, 20px body on a 30px line.
 *
 * The shell only offers this section when at least one of the two fields has
 * text, but a stale ?section=making link can still land here, so an empty
 * film gets a short note rather than a blank column.
 */
export function StoryMaking({ capsule }: Props) {
  const bts = withLineBreaks(capsule.film?.bts_text);
  const screenplay = withLineBreaks(capsule.film?.screenplay_text);

  if (!bts && !screenplay) {
    return (
      <div className="story-making">
        <p className="story-making-empty">There is nothing more on the making of this film yet.</p>
      </div>
    );
  }

  return (
    <div className="story-making">
      {bts && (
        <section className="story-making-section" aria-labelledby="story-making-bts">
          <h2 id="story-making-bts" className="story-making-heading">Behind the scenes</h2>
          <p className="story-making-body">{bts}</p>
        </section>
      )}
      {screenplay && (
        <section className="story-making-section" aria-labelledby="story-making-screenplay">
          <h2 id="story-making-screenplay" className="story-making-heading">Screenplay</h2>
          <p className="story-making-body story-making-screenplay">{screenplay}</p>
        </section>
      )}
    </div>
  );
}
