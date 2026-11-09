import './TmdbCredit.css';

/**
 * TMDB's required attribution: their logo and this exact notice. It lives on the
 * About page's Credits tab (components/about/Credits.tsx) because TMDB's API FAQ
 * says attribution "must be within your application's 'About' or 'Credits' type
 * section", and nowhere else. Do not reword the notice. TMDB's terms also say the
 * logo must be less prominent than LGN's own marks, so it is kept well under the
 * size of LGN's wordmark and is plain black or white (TMDB allows exactly those
 * two) rather than TMDB's green-to-blue.
 */
export function TmdbCredit() {
  return (
    <div className="tmdb-credit">
      <a
        href="https://www.themoviedb.org"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="The Movie Database (TMDB)"
      >
        {/* TMDB's own logo file, drawn in one plain colour (see TmdbCredit.css). */}
        <span className="tmdb-logo" aria-hidden="true" />
      </a>
      <p className="tmdb-notice">
        This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
      </p>
    </div>
  );
}
