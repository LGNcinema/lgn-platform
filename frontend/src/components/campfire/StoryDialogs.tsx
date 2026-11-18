import { useState } from 'react';
import './StoryDialogs.css';
import { LgnDialog } from '../LgnDialog';
import { copyToClipboard } from './clipboard';
import { parseCredits } from '../../filmInfo';

interface DialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "Share this film". Figma popup 5: "Send this guide to someone." and four
 * boxed buttons. "More" opens the device's own share sheet where there is one.
 */
export function ShareDialog({ open, onClose, title }: DialogProps & { title: string }) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');
  const url = window.location.href;
  const text = `${title}, with a guide for reflection and practice on LGN Cinema`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <LgnDialog open={open} onClose={onClose} className="story-dialog" label="Share this film">
      <div className="story-dialog-body">
        <p>Send this guide to someone.</p>
        <div className="story-dialog-buttons">
          <button
            type="button"
            className="lgn-btn"
            onClick={async () => setCopied((await copyToClipboard(url)) ? 'ok' : 'failed')}
          >
            {copied === 'ok' ? 'Link copied' : 'Copy link'}
          </button>
          <a className="lgn-btn" href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}:\n${url}`)}`}>
            Email
          </a>
          <a className="lgn-btn" href={`sms:?&body=${encodeURIComponent(`${text}: ${url}`)}`}>
            Message
          </a>
          {canShare && (
            <button type="button" className="lgn-btn" onClick={() => void navigator.share({ title, text, url }).catch(() => {})}>
              More
            </button>
          )}
        </div>
        {copied === 'failed' && <p className="story-dialog-note">Couldn’t copy automatically. The link is: {url}</p>}
      </div>
    </LgnDialog>
  );
}

/** "Need support?" Figma popup 4. */
export function SupportDialog({ open, onClose }: DialogProps) {
  return (
    <LgnDialog open={open} onClose={onClose} className="story-dialog" label="Need support?">
      <div className="story-dialog-body">
        <p>
          Films can bring up a lot, and sometimes more than we expected. If something here has stirred up feelings that
          are hard to carry, you don’t have to carry them alone.
        </p>
        <p>
          <strong>Talk to someone you trust.</strong> A friend, a family member, or a counselor is a good place to start.
        </p>
        <p>
          <strong>In the United States,</strong> you can call or text 988, or chat at{' '}
          <a className="rich-link" href="https://988lifeline.org" target="_blank" rel="noopener noreferrer">
            988lifeline.org
          </a>
          , to reach the 988 Suicide &amp; Crisis Lifeline. It’s free and open 24 hours a day.
        </p>
        <p>
          <strong>Outside the United States,</strong> find free, confidential support in your country at{' '}
          <a className="rich-link" href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">
            findahelpline.com
          </a>
          .
        </p>
        <p>
          <strong>If you or someone else is in immediate danger,</strong> call 911 or your local emergency number.
        </p>
        <p>LGN Cinema is a place for reflection. It isn’t a substitute for professional care.</p>
      </div>
    </LgnDialog>
  );
}

/** "Cast and crew". Figma popup 11: roles on the left, names on the right,
 *  from the story's credits ("Role: Name, Name" a line; a blank line between
 *  groups). */
export function CastCrewDialog({ open, onClose, title, credits }: DialogProps & { title: string; credits: string }) {
  const groups = parseCredits(credits);

  return (
    <LgnDialog
      open={open}
      onClose={onClose}
      className="story-dialog story-dialog--credits"
      label={
        <>
          {title}
          <br />
          Cast and crew
        </>
      }
    >
      <div className="story-dialog-body credits-grid">
        {groups.map((group, gi) => (
          <div key={gi} className="credits-group">
            {group.map((row, ri) => (
              <div key={ri} className="credits-row">
                <span className="credits-role">{row.role}</span>
                <span className="credits-names">
                  {row.names
                    .split(',')
                    .map((n) => n.trim())
                    .filter(Boolean)
                    .map((n, ni) => (
                      <span key={ni}>{n}</span>
                    ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </LgnDialog>
  );
}

/** Formats a local date/time as an iCalendar UTC stamp: 20270114T190000Z. */
function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * "Add intention to calendar". Figma popup 10: "When will you do it?", a day
 * and time, then Apple / Outlook (an .ics file) or Google (its event form).
 * The event: "Self practice: <film>", the practice as its note, and a link
 * back to the film's guide. Nothing is sent to LGN.
 */
export function CalendarDialog({
  open,
  onClose,
  title,
  circle,
  note,
}: DialogProps & { title: string; circle: string; note: string }) {
  const [when, setWhen] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(19, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T19:00`;
  });
  const start = new Date(when);
  const valid = !Number.isNaN(start.getTime());
  const end = valid ? new Date(start.getTime() + 30 * 60 * 1000) : start;
  const eventTitle = `${circle} practice: ${title}`;
  const link = window.location.href;
  const details = `${note}\n\nThe film’s guide on LGN: ${link}`;

  const ics = () => {
    const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);
    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LGN Cinema//Practice//EN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@lgncinema.org`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${escape(eventTitle)}`,
      `DESCRIPTION:${escape(details)}`,
      `URL:${link}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([body], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${circle.toLowerCase()}-practice.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const google = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle,
    details,
    dates: valid ? `${icsStamp(start)}/${icsStamp(end)}` : '',
  }).toString()}`;

  return (
    <LgnDialog open={open} onClose={onClose} className="story-dialog" label="Add intention to calendar">
      <div className="story-dialog-body">
        <label className="story-dialog-prompt" htmlFor="practice-when">
          When will you do it?
        </label>
        <input
          id="practice-when"
          className="lgn-field lgn-field--quiet story-dialog-when"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
        <div className="story-dialog-buttons">
          <button type="button" className="lgn-btn" disabled={!valid} onClick={ics}>
            Apple / Outlook
          </button>
          <a className={`lgn-btn${valid ? '' : ' is-disabled'}`} href={google} target="_blank" rel="noopener noreferrer">
            Google
          </a>
        </div>
      </div>
    </LgnDialog>
  );
}
