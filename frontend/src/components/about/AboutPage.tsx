import { useEffect, useId, useState } from 'react';
import './AboutPage.css';
import { API_URL } from '../../api';
import type { AboutContent, AboutPageKey, AboutSection, Person, PersonCategory } from '../../types';
import type { AboutSubView } from '../chrome/SiteHeader';
import { RichText } from '../RichText';

interface Props {
  sub: AboutSubView;
  onSelect: (sub: AboutSubView) => void;
  theme: 'light' | 'dark';
}

const MENU: { key: AboutSubView; label: string }[] = [
  { key: 'life-numbers', label: 'Life > Numbers' },
  { key: 'lgn-cinema', label: 'LGN Cinema' },
  { key: 'people', label: 'People' },
  { key: 'faqs', label: 'FAQs + Credits' },
];

const PEOPLE_GROUPS: { key: PersonCategory; label: string }[] = [
  { key: 'team', label: 'Team' },
  { key: 'board', label: 'Board of Directors' },
  { key: 'advisory', label: 'Advisory Council' },
];

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; content: AboutContent };

/**
 * The About pages. Figma "ABOUT—LIFE > NUMBERS", "—LGN CINEMA", "—PEOPLE"
 * and "—FAQ's + Credits": the menu on the left (the current page marked
 * "> " and in black, the others grey), the text from the 660 line, and a
 * fixed photo -- on the right, or under the menu on People.
 *
 * The text is edited in the admin's About pages (sections and people), so
 * it is fetched; the layout, menu and photos are fixed.
 */
export function AboutPage({ sub, onSelect, theme }: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/about`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<AboutContent>;
      })
      .then((content) => setLoad({ state: 'ready', content }))
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ state: 'failed' });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [sub]);

  const sections = (page: AboutPageKey): AboutSection[] =>
    load.state === 'ready' ? load.content.sections.filter((s) => s.page === page) : [];
  const people = load.state === 'ready' ? load.content.people : [];

  return (
    <div className={`about about--${sub}`}>
      <nav className="about-menu" aria-label="About">
        {MENU.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`about-menu-link${sub === key ? ' is-current' : ''}`}
            aria-current={sub === key ? 'page' : undefined}
            onClick={() => onSelect(key)}
          >
            {sub === key && <span aria-hidden="true">&gt; </span>}
            {label}
          </button>
        ))}
        {sub === 'people' && <img className="about-photo about-photo--menu" src="/images/about-people.jpg" alt="" />}
      </nav>

      <div className="about-main">
        {load.state === 'failed' && <p className="about-note">This page couldn’t load. Please try again in a moment.</p>}

        {sub === 'life-numbers' && (
          <>
            <h1 className="about-wordmark">
              <img
                src={theme === 'dark' ? '/images/lgn-logo-registered-white.svg' : '/images/lgn-logo-registered.svg'}
                alt="Life > Numbers"
              />
            </h1>
            <Sections items={sections('life-numbers')} />
            <button type="button" className="lgn-btn about-cta" onClick={() => onSelect('lgn-cinema')}>
              Explore LGN Cinema
            </button>
          </>
        )}

        {sub === 'lgn-cinema' && (
          <>
            <h1 className="visually-hidden">LGN Cinema</h1>
            <Sections items={sections('lgn-cinema')} />
          </>
        )}

        {sub === 'people' && (
          <>
            <h1 className="visually-hidden">People</h1>
            {PEOPLE_GROUPS.map(({ key, label }) => {
              const group = people.filter((p) => p.category === key);
              if (group.length === 0) return null;
              return (
                <section key={key} className="about-people">
                  <h2 className="about-people-heading">{label}</h2>
                  {group.map((person) => (
                    <PersonRow key={person.id} person={person} />
                  ))}
                </section>
              );
            })}
          </>
        )}

        {sub === 'faqs' && (
          <>
            <h1 className="visually-hidden">FAQs and Credits</h1>
            <Faqs items={sections('faqs')} />
            {sections('credits').map((s) => (
              <section key={s.id} className="about-credits">
                {s.heading && <h2 className="about-credits-heading">{s.heading}</h2>}
                <RichText text={s.body} className="about-body" />
              </section>
            ))}
          </>
        )}
      </div>

      {sub === 'life-numbers' && <img className="about-photo about-photo--tall" src="/images/about-life-numbers.jpg" alt="" />}
      {sub === 'lgn-cinema' && <img className="about-photo about-photo--wide" src="/images/about-lgn-cinema.jpg" alt="" />}
    </div>
  );
}

function Sections({ items }: { items: AboutSection[] }) {
  return (
    <>
      {items.map((s) => (
        <section key={s.id} className="about-section">
          {s.heading && <h2 className="about-heading">{s.heading}</h2>}
          <RichText text={s.body} className="about-body" />
        </section>
      ))}
    </>
  );
}

/** A name and role on the left; the bio and "A film that moved him: ..." on
 *  the right; a rule above each. */
function PersonRow({ person }: { person: Person }) {
  const film = person.film_title?.trim();
  return (
    <article className="about-person">
      <div className="about-person-id">
        <h3 className="about-person-name">{person.name}</h3>
        {person.role && <p className="about-person-role">{person.role}</p>}
      </div>
      <div className="about-person-text">
        <RichText text={person.bio} className="about-body" />
        {film && (
          <p className="about-person-film">
            {person.film_lead?.trim() || 'A film that moved them'}:{' '}
            {person.film_url ? (
              <a className="rich-link" href={person.film_url} target="_blank" rel="noopener noreferrer">
                {film}
              </a>
            ) : (
              <span className="rich-link">{film}</span>
            )}
            {person.film_year && ` (${person.film_year})`}
          </p>
        )}
      </div>
    </article>
  );
}

/** Questions as ruled rows, all closed to start; one open at a time. A
 *  question without an answer yet is shown but can't open. */
function Faqs({ items }: { items: AboutSection[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const ids = useId();
  return (
    <div className="about-faqs">
      {items.map((s) => {
        const answer = s.body?.trim();
        const isOpen = open === s.id && Boolean(answer);
        return (
          <section key={s.id} className={`about-faq${isOpen ? ' is-open' : ''}`}>
            <h2 className="about-faq-q">
              <button
                type="button"
                className="about-faq-toggle"
                aria-expanded={isOpen}
                aria-controls={`${ids}-${s.id}`}
                disabled={!answer}
                onClick={() => setOpen(isOpen ? null : s.id)}
              >
                <span>{s.heading}</span>
                <span className="about-faq-caret" aria-hidden="true">{isOpen ? 'v' : '>'}</span>
              </button>
            </h2>
            <div id={`${ids}-${s.id}`} hidden={!isOpen}>
              {isOpen && <RichText text={answer} className="about-body about-faq-a" />}
            </div>
          </section>
        );
      })}
    </div>
  );
}
