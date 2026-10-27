import './GuidesDialog.css';
import { LgnDialog } from '../LgnDialog';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** The four guide tiers, from least to most curated. */
export const GUIDE_TIERS = ['Universal', 'AI-started', 'LGN', 'LGN + Filmmaker'] as const;

/**
 * "How these guides are made". Figma v3: "Campfire—how these guides are
 * made" -- opened from the Campfire's "How it works." and a film page's
 * label of the same name.
 */
export function GuidesDialog({ open, onClose }: Props) {
  return (
    <LgnDialog
      open={open}
      onClose={onClose}
      className="guides-dialog"
      label={
        <>
          How these guides
          <br />
          are made
        </>
      }
    >
      <div className="guides-dialog-body">
        <p>
          Our monthly Go Beyond films are made by hand, with their filmmakers. Guides for other
          films start with AI-assisted questions written by LGN, and grow as our team reviews them
          and filmmakers add their own.
        </p>
        <p>
          LGN isn't affiliated with these films or their makers, and we never speak for them. To
          hear from the filmmakers, follow the links to their own interviews.
        </p>
        <p>Guide tiers are based on filmmaker involvement in content curation:</p>
        <ul className="guides-dialog-tiers">
          {GUIDE_TIERS.map((tier, i) => (
            <li key={tier}>
              <span aria-hidden="true">{'●'.repeat(i + 1)}</span> {tier}
            </li>
          ))}
        </ul>
      </div>
    </LgnDialog>
  );
}
