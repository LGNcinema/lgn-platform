import './Credits.css';
import { TmdbCredit } from '../beyond/TmdbCredit';

/**
 * About -> Credits: what the site is built on, and who we thank for it.
 *
 * It is a tab of its own, and the only place TMDB is credited, because TMDB's
 * API FAQ says attribution must be "within your application's 'About' or
 * 'Credits' type section". Add the next credit (a typeface, a photographer, a
 * data source) as another <section className="about-credit"> below this one; they
 * space themselves.
 */
export function Credits() {
  return (
    <>
      <h1 className="about-title">Credits</h1>

      <section className="about-credit" aria-label="The Movie Database (TMDB)">
        <p className="about-credit-intro">
          Film details, posters and stills on our Go Beyond pages come from The Movie Database (TMDB).
        </p>
        <TmdbCredit />
      </section>

      {/* TMDB's where-to-watch data comes from JustWatch, and TMDB requires it be
          credited here and wherever it is shown (WhereToWatch.tsx). */}
      <section className="about-credit" aria-label="JustWatch">
        <p className="about-credit-intro">
          Where-to-watch information comes from{' '}
          <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">JustWatch</a>, through TMDB.
        </p>
      </section>
    </>
  );
}
