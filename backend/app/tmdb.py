"""TMDB client for Beyond the Screen: search and film details, fetched live.

Rules this module keeps (TMDB's API terms; see the plan):
  * Nothing from TMDB is stored. Callers get plain dicts and may only hand them
    to the browser or, for AI generation, to the model -- never a table.
  * Posters are hot-linked from image.tmdb.org, never copied.
  * Adult titles are excluded from search and flagged on details.
  * A 429 is reported as `rate_limited` so the caller can degrade gracefully.

No key + ENV=development: answers from a small built-in sample (FIXTURES), so
the feature runs locally with no TMDB account. These are invented summaries,
not TMDB data.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional

from app.config import settings

API = "https://api.themoviedb.org/3"
IMAGE_BASE = "https://image.tmdb.org/t/p"
TIMEOUT_SECONDS = 6
SEARCH_LIMIT = 8
CAST_LIMIT = 5
STILL_SIZE = "w1280"
STILL_MIN_WIDTH = 1280
WATCH_PAGE = "https://www.themoviedb.org"

# Where-to-watch groups, in the order shown: (our key, TMDB's key, label).
WATCH_GROUPS = (
    ("stream", "flatrate", "Stream"),
    ("free", "free", "Free"),
    ("ads", "ads", "Free with ads"),
    ("rent", "rent", "Rent"),
    ("buy", "buy", "Buy"),
)


class TmdbError(Exception):
    """kind: not_configured | not_found | rate_limited | unavailable"""

    def __init__(self, kind: str, message: str = ""):
        super().__init__(message or kind)
        self.kind = kind


def has_credentials() -> bool:
    return bool(settings.TMDB_READ_ACCESS_TOKEN or settings.TMDB_API_KEY)


def is_fixture_mode() -> bool:
    return not has_credentials() and settings.ENV == "development"


def is_available() -> bool:
    return has_credentials() or is_fixture_mode()


def poster_url(path: Optional[str], size: str = "w342") -> Optional[str]:
    return f"{IMAGE_BASE}/{size}{path}" if path else None


def pick_still(images: Optional[dict]) -> Optional[str]:
    """A film's hero still. TMDB calls these "backdrops": 16:9 publicity art,
    listed best-voted first. Take the best one with no text on it (a title
    printed across it would sit under the play button); only if every one has
    text, take the best of those. Nothing at all gives None (the page falls back
    to the poster)."""
    backdrops = [
        b for b in (images or {}).get("backdrops", [])
        if b.get("file_path") and b.get("width", 0) >= STILL_MIN_WIDTH
    ]
    textless = [b for b in backdrops if not b.get("iso_639_1")]
    best = (textless or backdrops or [None])[0]
    return poster_url(best["file_path"], size=STILL_SIZE) if best else None


def _year(date: Optional[str]) -> Optional[int]:
    try:
        return int((date or "")[:4])
    except ValueError:
        return None


def _get(path: str, **params) -> dict:
    if not has_credentials():
        raise TmdbError("not_configured", "TMDB_API_KEY is not set.")
    headers = {"Accept": "application/json"}
    query = {"language": "en-US", **params}
    if settings.TMDB_READ_ACCESS_TOKEN:
        # The v4 token goes in a header, never in the URL (URLs end up in logs).
        headers["Authorization"] = f"Bearer {settings.TMDB_READ_ACCESS_TOKEN}"
    else:
        query["api_key"] = settings.TMDB_API_KEY
    request = urllib.request.Request(f"{API}{path}?{urllib.parse.urlencode(query)}", headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise TmdbError("not_found") from exc
        if exc.code == 429:
            raise TmdbError("rate_limited") from exc
        raise TmdbError("unavailable", f"TMDB answered {exc.code}.") from exc
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        raise TmdbError("unavailable", "Could not reach TMDB.") from exc


def search(query: str) -> list[dict]:
    """Movies matching `query`: [{tmdb_id, title, year, poster_url}]."""
    query = query.strip()
    if not query:
        return []
    if is_fixture_mode():
        needle = query.lower()
        hits = [f for f in FIXTURES.values() if needle in f["title"].lower() and not f["adult"]]
        return [_summary(f) for f in hits[:SEARCH_LIMIT]]
    data = _get("/search/movie", query=query, include_adult="false", page=1)
    out = []
    for item in data.get("results", []):
        if item.get("adult"):
            continue
        out.append(
            {
                "tmdb_id": item["id"],
                "title": item.get("title") or item.get("original_title") or "Untitled",
                "year": _year(item.get("release_date")),
                "poster_url": poster_url(item.get("poster_path")),
            }
        )
        if len(out) >= SEARCH_LIMIT:
            break
    return out


def details(tmdb_id: int) -> dict:
    """One film, with director, main cast and a hero still (one TMDB call:
    credits and images appended)."""
    if is_fixture_mode():
        film = FIXTURES.get(tmdb_id)
        if not film:
            raise TmdbError("not_found")
        return dict(film)
    item = _get(f"/movie/{int(tmdb_id)}", append_to_response="credits,images", include_image_language="en,null")
    crew = item.get("credits", {}).get("crew", [])
    cast = item.get("credits", {}).get("cast", [])
    directors = [c["name"] for c in crew if c.get("job") == "Director"]
    return {
        "tmdb_id": item["id"],
        "title": item.get("title") or item.get("original_title") or "Untitled",
        "year": _year(item.get("release_date")),
        "release_date": item.get("release_date") or None,
        "overview": item.get("overview") or "",
        "genres": [g["name"] for g in item.get("genres", [])],
        "director": ", ".join(directors) or None,
        "cast": [c["name"] for c in cast[:CAST_LIMIT]],
        "runtime": item.get("runtime") or None,
        "poster_url": poster_url(item.get("poster_path")),
        "still_url": pick_still(item.get("images")),
        "adult": bool(item.get("adult")),
    }


def watch(tmdb_id: int, region: str) -> dict:
    """Where one film can be watched in one region, grouped (stream, free, free
    with ads, rent, buy). TMDB's data, which TMDB sources from JustWatch: whoever
    shows it MUST credit JustWatch, or TMDB revokes the API key.

    TMDB gives one link per region (its own page for the film, which links out to
    each service), not one per service, so `link` is shared by every provider."""
    region = region.upper()
    if is_fixture_mode():
        film = FIXTURES.get(tmdb_id)
        if not film or film["adult"]:
            raise TmdbError("not_found")
        return _watch_for(_sample_providers(region), region, tmdb_id)
    item = _get(f"/movie/{int(tmdb_id)}", append_to_response="watch/providers")
    if item.get("adult"):
        raise TmdbError("not_found")
    return _watch_for(item.get("watch/providers", {}).get("results", {}), region, item["id"])


def _watch_for(results: dict, region: str, tmdb_id: int) -> dict:
    entry = results.get(region) or {}
    groups = []
    for key, source, label in WATCH_GROUPS:
        ranked = sorted(entry.get(source) or [], key=lambda p: (p.get("display_priority", 999), p.get("provider_name", "")))
        names: list[str] = []
        for provider in ranked:
            name = (provider.get("provider_name") or "").strip()
            if name and name not in names:
                names.append(name)
        if names:
            groups.append({"kind": key, "label": label, "providers": names})
    # Only ever hand the page a link to TMDB itself.
    link = entry.get("link") or ""
    if not link.startswith(f"{WATCH_PAGE}/"):
        link = f"{WATCH_PAGE}/movie/{int(tmdb_id)}/watch"
    return {"region": region, "available": bool(groups), "link": link, "groups": groups}


def _sample_providers(region: str) -> dict:
    """Development with no TMDB credential: invented services, clearly labelled,
    so the Where-to-watch panel can be tried."""
    rows = {
        "flatrate": ["Sample Streaming"],
        "rent": ["Sample Rentals"],
        "buy": ["Sample Store"],
    }
    return {region: {key: [{"provider_name": n, "display_priority": 1} for n in names] for key, names in rows.items()}}


def _summary(film: dict) -> dict:
    return {
        "tmdb_id": film["tmdb_id"],
        "title": film["title"],
        "year": film["year"],
        "poster_url": film["poster_url"],
    }


def _fx(tmdb_id, title, year, director, runtime, genres, cast, overview, adult=False):
    return {
        "tmdb_id": tmdb_id,
        "title": title,
        "year": year,
        "release_date": f"{year}-01-01",
        "overview": overview,
        "genres": genres,
        "director": director,
        "cast": cast,
        "runtime": runtime,
        "poster_url": None,  # no posters in fixtures: exercises the title card
        "still_url": None,  # nor stills
        "adult": adult,
    }


# Invented one-line summaries; real titles and credits only so the UI looks real.
FIXTURES: dict[int, dict] = {
    f["tmdb_id"]: f
    for f in [
        _fx(129, "Spirited Away", 2001, "Hayao Miyazaki", 125, ["Animation", "Family", "Fantasy"],
            ["Rumi Hiiragi", "Miyu Irino"], "A girl must find her courage in a strange world of spirits to free her parents."),
        _fx(13, "Forrest Gump", 1994, "Robert Zemeckis", 142, ["Comedy", "Drama", "Romance"],
            ["Tom Hanks", "Robin Wright"], "A kind man drifts through decades of American life, always in the middle of history."),
        _fx(496243, "Parasite", 2019, "Bong Joon Ho", 133, ["Comedy", "Thriller", "Drama"],
            ["Song Kang-ho", "Cho Yeo-jeong"], "Two families, one wealthy and one struggling, become tangled together."),
        _fx(157336, "Interstellar", 2014, "Christopher Nolan", 169, ["Adventure", "Drama", "Science Fiction"],
            ["Matthew McConaughey", "Anne Hathaway"], "Explorers travel through a wormhole in search of a future for humanity."),
        _fx(278, "The Shawshank Redemption", 1994, "Frank Darabont", 142, ["Drama", "Crime"],
            ["Tim Robbins", "Morgan Freeman"], "Two prisoners form a friendship over years and find hope inside a prison."),
        _fx(12, "Finding Nemo", 2003, "Andrew Stanton", 100, ["Animation", "Family"],
            ["Albert Brooks", "Ellen DeGeneres"], "An anxious clownfish crosses the ocean to find his lost son."),
        _fx(603, "The Matrix", 1999, "Lana Wachowski, Lilly Wachowski", 136, ["Action", "Science Fiction"],
            ["Keanu Reeves", "Laurence Fishburne"], "A hacker learns that his world is not what it seems."),
        _fx(10681, "WALL-E", 2008, "Andrew Stanton", 98, ["Animation", "Family", "Science Fiction"],
            ["Ben Burtt", "Elissa Knight"], "A lonely robot left to tidy an abandoned Earth finds something worth following."),
        _fx(19404, "Dilwale Dulhania Le Jayenge", 1995, "Aditya Chopra", 189, ["Romance", "Drama"],
            ["Shah Rukh Khan", "Kajol"], "Two travelers meet on a trip across Europe and must face their families."),
        _fx(999001, "Sample Adult Title", 2000, "Nobody", 90, ["Drama"], [],
            "Used by tests: adult titles never appear in search.", adult=True),
    ]
}


if __name__ == "__main__":  # python -m app.tmdb "the godfather"
    # A live check that the credentials work. Prints results, never the keys.
    import sys

    term = " ".join(sys.argv[1:]) or "the godfather"
    print("credentials:", "token" if settings.TMDB_READ_ACCESS_TOKEN else "api key" if settings.TMDB_API_KEY else "none (sample mode)")
    try:
        hits = search(term)
        print(f"search {term!r}: {len(hits)} results")
        for h in hits[:3]:
            print("  ", h["tmdb_id"], h["title"], h["year"], h["poster_url"])
        if hits:
            d = details(hits[0]["tmdb_id"])
            print("details:", d["title"], "| director:", d["director"], "| cast:", ", ".join(d["cast"][:3]), "| runtime:", d["runtime"])
    except TmdbError as exc:
        print("TMDB error:", exc.kind)
        sys.exit(1)
