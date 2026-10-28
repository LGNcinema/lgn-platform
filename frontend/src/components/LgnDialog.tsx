import { useEffect, useRef, type ReactNode } from 'react';
import './LgnDialog.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The small caps label in the top-left corner ("HOW THESE GUIDES ARE MADE"). */
  label: ReactNode;
  /** Extra class for the panel, to set its width and spacing. */
  className?: string;
  children: ReactNode;
}

/**
 * The V3 pop-up: an #EDEDED panel over the blurred page, with a small caps
 * label top-left and "[x]" top-right. Figma: "how these guides are made",
 * the pre-watch card and the Storyboard form.
 *
 * A native <dialog> opened with showModal(), so the browser handles focus,
 * Escape and keeping the rest of the page inert. A click on the backdrop
 * closes it too.
 */
export function LgnDialog({ open, onClose, label, className, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`lgn-dialog${className ? ` ${className}` : ''}`}
      // Escape (and anything else that closes the dialog) reports back.
      onClose={onClose}
      onClick={(e) => {
        // The dialog element itself is the backdrop area; its content is inside.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lgn-dialog-inner">
        <div className="lgn-dialog-bar">
          <p className="lgn-label lgn-dialog-label">{label}</p>
          <button type="button" className="lgn-dialog-close lgn-label" aria-label="Close" onClick={onClose}>
            [x]
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
