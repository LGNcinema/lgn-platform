import { useId, useState } from 'react';
import './forms.css';
import type { CapsuleSummary } from '../../types';

export interface PickedFilm {
  title: string;
  year: string;
  /** Set when the film is one of LGN's published stories. */
  capsuleId?: number;
}

interface Props {
  /** Published stories, searched by title. */
  films: CapsuleSummary[];
  /** Called with the typed or chosen film. */
  onPick: (film: PickedFilm) => void;
  /** Search button label. */
  buttonLabel?: string;
}

/**
 * "Film Title" + "Release year" + "Search >" (Figma: the Storyboard form's
 * film tag and For Filmmakers' "Identify the film"). The search looks through
 * LGN's published films; when nothing matches, the typed title and year are
 * used as they are -- "Can't find it? Type the title + year, and we'll add it
 * when we review."
 */
export function FilmPicker({ films, onPick, buttonLabel = 'Search' }: Props) {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [matches, setMatches] = useState<CapsuleSummary[] | null>(null);
  const id = useId();

  const search = () => {
    const q = title.trim().toLowerCase();
    if (!q) return;
    const found = films.filter((f) => f.title.toLowerCase().includes(q));
    setMatches(found);
  };

  const useTyped = () => {
    if (!title.trim()) return;
    onPick({ title: title.trim(), year: year.trim() });
    setTitle('');
    setYear('');
    setMatches(null);
  };

  return (
    <div className="film-picker">
      <div className="film-picker-row">
        <input
          className="lgn-field lgn-field--quiet film-picker-title"
          placeholder="Film Title"
          aria-label="Film title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setMatches(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              search();
            }
          }}
        />
        <input
          className="lgn-field lgn-field--quiet film-picker-year"
          placeholder="Release year"
          aria-label="Release year"
          inputMode="numeric"
          maxLength={4}
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
        />
        <button type="button" className="lgn-btn film-picker-btn" onClick={search}>
          {buttonLabel}
        </button>
      </div>
      <p className="lgn-label form-hint" id={`${id}-hint`}>
        Can’t find it? Type the title + year, and we’ll add it when we review.
      </p>
      {matches !== null && (
        <div className="film-picker-results" role="status">
          {matches.map((f) => (
            <button
              key={f.id}
              type="button"
              className="lgn-chip"
              onClick={() => {
                onPick({ title: f.title, year: '', capsuleId: f.id });
                setTitle('');
                setYear('');
                setMatches(null);
              }}
            >
              + {f.title}
            </button>
          ))}
          <button type="button" className="lgn-chip" onClick={useTyped}>
            + Use “{title.trim()}{year ? ` (${year})` : ''}”
          </button>
        </div>
      )}
    </div>
  );
}
