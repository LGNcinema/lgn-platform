/**
 * AboutPanel -- the About pages' text: Life > Numbers, LGN Cinema, People and
 * FAQs + Credits. Each page is a list of sections (a heading and its
 * paragraphs) in order; People is three lists (Team, Board of Directors,
 * Advisory Council). The page layout, menu and photos stay fixed.
 */
import { useCallback, useEffect, useState } from 'react';
import type { AboutContent, AboutPageKey, AboutSection, Person, PersonCategory } from '../../types';
import { adminFetch } from '../adminClient';
import { Alert, ListPanel, Note, PanelHead, Section } from './Fields';
import type { ListFieldSpec } from './Fields';
import { str } from './formState';

type SectionDraft = { heading: string; body: string };
type PersonDraft = {
  name: string;
  role: string;
  bio: string;
  film_lead: string;
  film_title: string;
  film_year: string;
  film_url: string;
};

const FORMAT_HELP = (
  <>
    Leave a blank line between paragraphs. <code>**The Library.**</code> sets a bold lead-in;{' '}
    <code>[Charliebird](https://...)</code> makes a link; <code>[For Filmmakers](/?view=for-filmmakers)</code> links to a page here.
  </>
);

const SECTION_FIELDS: ListFieldSpec<SectionDraft>[] = [
  { key: 'heading', label: 'Heading', kind: 'text' },
  { key: 'body', label: 'Text', kind: 'textarea', rows: 6, help: FORMAT_HELP },
];

const FAQ_FIELDS: ListFieldSpec<SectionDraft>[] = [
  { key: 'heading', label: 'Question', kind: 'text', required: true },
  {
    key: 'body',
    label: 'Answer',
    kind: 'textarea',
    rows: 4,
    help: <>A question without an answer shows on the page but can't be opened. {FORMAT_HELP}</>,
  },
];

const PERSON_FIELDS: ListFieldSpec<PersonDraft>[] = [
  { key: 'name', label: 'Name', kind: 'text', required: true },
  { key: 'role', label: 'Role', kind: 'text', placeholder: 'Founder and Executive Director' },
  { key: 'bio', label: 'Bio', kind: 'textarea', rows: 5 },
  { key: 'film_lead', label: 'Film line lead-in', kind: 'text', placeholder: 'A film that moved him' },
  { key: 'film_title', label: 'Film title', kind: 'text', help: 'Leave empty to hide the film line.' },
  { key: 'film_year', label: 'Film year', kind: 'text' },
  { key: 'film_url', label: 'Film link (optional)', kind: 'text', placeholder: 'https://' },
];

const toSectionDraft = (s: AboutSection): SectionDraft => ({ heading: str(s.heading), body: str(s.body) });
const toPersonDraft = (p: Person): PersonDraft => ({
  name: str(p.name),
  role: str(p.role),
  bio: str(p.bio),
  film_lead: str(p.film_lead),
  film_title: str(p.film_title),
  film_year: str(p.film_year),
  film_url: str(p.film_url),
});

const BLANK_SECTION: SectionDraft = { heading: '', body: '' };
const BLANK_PERSON: PersonDraft = { name: '', role: '', bio: '', film_lead: '', film_title: '', film_year: '', film_url: '' };

type Tab = 'life-numbers' | 'lgn-cinema' | 'people' | 'faqs';
const TABS: { id: Tab; label: string }[] = [
  { id: 'life-numbers', label: 'Life > Numbers' },
  { id: 'lgn-cinema', label: 'LGN Cinema' },
  { id: 'people', label: 'People' },
  { id: 'faqs', label: 'FAQs + Credits' },
];
const GROUPS: { key: PersonCategory; label: string; singular: string }[] = [
  { key: 'team', label: 'Team', singular: 'team member' },
  { key: 'board', label: 'Board of Directors', singular: 'board member' },
  { key: 'advisory', label: 'Advisory Council', singular: 'council member' },
];

export function AboutPanel() {
  const [content, setContent] = useState<AboutContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('life-numbers');

  const load = useCallback(async () => {
    try {
      setContent(await adminFetch<AboutContent>('/api/admin/about'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The About pages could not be loaded.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sectionsOf = (page: AboutPageKey) => content?.sections.filter((s) => s.page === page) ?? [];

  const sectionList = (page: AboutPageKey, singular: string, fields = SECTION_FIELDS) => (
    <ListPanel<AboutSection, SectionDraft>
      items={sectionsOf(page)}
      singular={singular}
      collection="about_sections"
      createPath="/api/admin/about/sections"
      fixedBody={{ page }}
      fields={fields}
      toDraft={toSectionDraft}
      blank={BLANK_SECTION}
      nameKey="heading"
      onSaved={load}
      reorderable
      emptyText={`No ${singular}s yet. Add the first one above.`}
    />
  );

  return (
    <div className="apnl">
      <PanelHead
        title="About pages"
        description={
          <>
            The text of the four About pages, in the order it appears. Changes show on the site within a
            minute. <a href={`/?view=about&sub=${tab}`} target="_blank" rel="noreferrer">View this page</a>
          </>
        }
      />

      <div className="admin-tabs" role="tablist" aria-label="About pages">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {!content && !error ? <Note>Loading...</Note> : null}

      {content && tab === 'life-numbers' && (
        <Section title="Sections">
          <Note>Under the Life &gt; Numbers wordmark, above the "Explore LGN Cinema" button.</Note>
          {sectionList('life-numbers', 'section')}
        </Section>
      )}

      {content && tab === 'lgn-cinema' && <Section title="Sections">{sectionList('lgn-cinema', 'section')}</Section>}

      {content && tab === 'people' &&
        GROUPS.map((g) => (
          <Section key={g.key} title={g.label}>
            <ListPanel<Person, PersonDraft>
              items={content.people.filter((p) => p.category === g.key)}
              singular={g.singular}
              collection="people"
              createPath="/api/admin/about/people"
              fixedBody={{ category: g.key }}
              fields={PERSON_FIELDS}
              toDraft={toPersonDraft}
              blank={BLANK_PERSON}
              nameKey="name"
              onSaved={load}
              reorderable
              emptyText={`Nobody in ${g.label} yet. The heading is hidden on the site until someone is added.`}
            />
          </Section>
        ))}

      {content && tab === 'faqs' && (
        <>
          <Section title="Questions">{sectionList('faqs', 'question', FAQ_FIELDS)}</Section>
          <Section title="Credits">
            <Note>The small print under the questions.</Note>
            {sectionList('credits', 'credits block')}
          </Section>
        </>
      )}
    </div>
  );
}
