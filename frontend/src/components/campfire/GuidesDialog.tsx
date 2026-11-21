import './GuidesDialog.css';
import { LgnDialog } from '../LgnDialog';

interface Props {
  open: boolean;
  onClose: () => void;
  /** "For Filmmakers >": opens that page. */
  onOpenFilmmakers?: () => void;
}

/** The four guide tiers, from least to most curated, with their one-line
 *  meaning (Figma popup 2). The dots before each are the tier. */
export const GUIDE_TIERS = [
  { label: 'Universal', text: 'Questions that fit any film.' },
  { label: 'AI-started', text: 'Questions drafted with AI for this film.' },
  { label: 'LGN', text: 'Reviewed and shaped by our team.' },
  { label: 'LGN + Filmmaker', text: 'Shaped with the film’s makers, as every Monthly Short is.' },
] as const;

/** "●●●●" for a tier (1-4). */
export const tierDots = (tier: number) => '●'.repeat(tier);

/**
 * "How these guides are made". Figma popup 2 -- opened from a film page's
 * label of the same name and the landing page's "How guides work."
 */
export function GuidesDialog({ open, onClose, onOpenFilmmakers }: Props) {
  return (
    <LgnDialog open={open} onClose={onClose} className="guides-dialog" label="How these guides are made">
      <div className="guides-dialog-body">
        <p>
          Every film in the Library has a guide for reflection and practice. Some guides are a starting point, and some
          were shaped with the people who made the film. The dots show which.
        </p>
        <ul className="guides-dialog-tiers">
          {GUIDE_TIERS.map((tier, i) => (
            <li key={tier.label}>
              <span className="guides-dialog-dots" aria-hidden="true">
                {tierDots(i + 1)}
              </span>
              <span>
                <strong>{tier.label}.</strong> {tier.text}
              </span>
            </li>
          ))}
        </ul>
        <p>
          Our hope is for every film here to be claimed by the people who made it. No one knows a film better than they
          do, and a guide shaped by its makers is the truest one we can offer.
        </p>
        <p>
          Unless a guide is marked LGN + Filmmaker, LGN isn’t officially affiliated with the film. Our aim is to uplift
          filmmakers’ work, never to speak on their behalf.
        </p>
        {onOpenFilmmakers && (
          <div className="guides-dialog-cta">
            <p>Made a film?</p>
            <button
              type="button"
              className="lgn-btn"
              onClick={() => {
                onClose();
                onOpenFilmmakers();
              }}
            >
              For Filmmakers
            </button>
          </div>
        )}
      </div>
    </LgnDialog>
  );
}
