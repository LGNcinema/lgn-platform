import { useId, useState, type ReactNode } from 'react';
import './InvestPage.css';

interface Props {
  /** "Storyboard >" under Share. */
  onOpenStoryboard: () => void;
  /** "For Filmmakers >" under Build. */
  onOpenFilmmakers: () => void;
}

/** The Givebutter donation widget's id (edited in Givebutter). */
const GIVEBUTTER_WIDGET_ID = 'Lyl381';

const GIVE_URL = 'https://donate.stripe.com/cNi9AT2g6fxc6j1bs4cjS00';

type Row = { key: string; title: string; body?: ReactNode };

/**
 * Invest. Figma "INVEST": "Invest", the Givebutter donation widget and the
 * giving details on the left; on the right an intro and three ruled rows --
 * Build, Share, Give -- all closed to start (UX). Two Give lines are
 * placeholders.
 */
export function InvestPage({ onOpenStoryboard, onOpenFilmmakers }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const ids = useId();

  const rows: Row[] = [
    {
      key: 'build',
      title: 'Build',
      body: (
        <>
          <p>Help grow the Library. On any film’s guide, you can:</p>
          <ul className="invest-list">
            <li>Suggest a question or practice for that film, to help others take it beyond the screen.</li>
            <li>Share what you know about who made the film, why they made it, and how.</li>
            <li>Claim the guide, if you made the film.</li>
          </ul>
          <button type="button" className="lgn-btn invest-btn" onClick={onOpenFilmmakers}>
            For Filmmakers
          </button>
        </>
      ),
    },
    {
      key: 'share',
      title: 'Share',
      body: (
        <>
          <p>Bring someone along. You can:</p>
          <ul className="invest-list">
            <li>Send a film’s guide to someone who came to mind while you watched.</li>
            <li>Go through a guide together with a friend, family, or group.</li>
            <li>Add your story to the Storyboard, so others can see where a film led you.</li>
          </ul>
          <button type="button" className="lgn-btn invest-btn" onClick={onOpenStoryboard}>
            Storyboard
          </button>
        </>
      ),
    },
    {
      key: 'give',
      title: 'Give',
      body: (
        <>
          <p>Numbers are powerful tools. Here’s one way to put them to work for good. Your gift:</p>
          <ul className="invest-list">
            <li>Keeps LGN Cinema free for everyone.</li>
            <li>Placeholder: what donations make possible, such as licensing films or paying filmmakers.</li>
            <li>Placeholder: a second specific use.</li>
          </ul>
          <a className="lgn-btn invest-btn" href={GIVE_URL} target="_blank" rel="noopener noreferrer">
            Give Here
          </a>
        </>
      ),
    },
  ];

  return (
    <div className="invest">
      <aside className="invest-side">
        <h1 className="invest-title">Invest</h1>
        {/* Givebutter's script (index.html) fills this in. */}
        <div className="invest-widget">
          <givebutter-widget id={GIVEBUTTER_WIDGET_ID}></givebutter-widget>
        </div>
        <div className="invest-side-text">
          <p>Gifts to Life is Greater than Numbers, Inc. are charitable contributions.</p>
          <p>501(c)(3) EIN: 33-2376438.</p>
          <p>
            To give by check or in another way, contact{' '}
            <a className="rich-link" href="mailto:invest@lgncinema.org">invest@lgncinema.org</a>.
          </p>
        </div>
        <p className="invest-small">
          As a registered 501(c)(3), donations to Life is Greater than Numbers, Inc. are tax-deductible to the fullest
          extent allowed by law. Charitable disclosure &amp; state registration info will be added here as we complete
          our national registration process. This page is not intended as a solicitation in jurisdictions where Life is
          Greater than Numbers, Inc. is not yet registered or exempt from registration.
        </p>
      </aside>

      <div className="invest-main">
        <p className="invest-intro">
          LGN Cinema is free for everyone, and it grows through the people who use it.
          <br />
          There are three ways to invest in the LGN vision. However you invest, thank you.
        </p>
        {rows.map((row) => {
          const isOpen = open === row.key && Boolean(row.body);
          return (
            <section key={row.key} className={`invest-row${isOpen ? ' is-open' : ''}`}>
              <h2 className="invest-row-title">
                <button
                  type="button"
                  className="invest-row-toggle"
                  aria-expanded={row.body ? isOpen : undefined}
                  aria-controls={row.body ? `${ids}-${row.key}` : undefined}
                  disabled={!row.body}
                  onClick={() => setOpen(isOpen ? null : row.key)}
                >
                  <span>{row.title}</span>
                  {row.body && (
                    <span className="invest-row-caret" aria-hidden="true">
                      {isOpen ? 'v' : '>'}
                    </span>
                  )}
                </button>
              </h2>
              {row.body && (
                <div id={`${ids}-${row.key}`} className="invest-row-body" hidden={!isOpen}>
                  {isOpen && row.body}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
