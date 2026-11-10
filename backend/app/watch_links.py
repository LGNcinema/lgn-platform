"""Per-platform links for "Where to watch".

TMDB tells us WHICH platforms carry a film (an id and a name) but never a link
to the film on them: the data is JustWatch's, and TMDB's agreement with JustWatch
only lets it say who offers a title. So the links are ours. Each one opens that
platform's own search for the film's title, one click from the film itself. It is
a search, not the film's own page: that would need the platform's internal id for
the title, which nobody gives us.

A platform appears here only if its search address was checked against the live
site (10 Nov 2026) or comes from a source that is kept current (marked below).
Anything not listed gets no link of its own and falls back to TMDB's page for the
film (see tmdb._watch_for), so a new or obscure platform is never a dead button.

Adding one: find its TMDB provider id (it is in any watch response, or
GET /watch/providers/movie), open its search page in a browser, copy the address,
put {q} where the title goes, and add a test in tests/test_watch_links.py.
"""

from __future__ import annotations

import re
from typing import NamedTuple, Optional
from urllib.parse import quote

# Amazon runs one store per country; everywhere else uses amazon.com.
AMAZON_TLD = {
    "GB": "co.uk", "DE": "de", "AT": "de", "FR": "fr", "IT": "it", "ES": "es", "NL": "nl", "SE": "se",
    "PL": "pl", "CA": "ca", "AU": "com.au", "JP": "co.jp", "IN": "in", "BR": "com.br", "MX": "com.mx",
    "TR": "com.tr",
}

AMAZON = "https://www.amazon.{amazon}/s?k={q}&i=instant-video"
APPLE_TV = "https://tv.apple.com/search?term={q}"
ROKU = "https://therokuchannel.roku.com/search/{q}"


class Platform(NamedTuple):
    url: str  # {q}: the title, percent-encoded. {region}: lower-case. {amazon}: Amazon's domain ending for the country.
    ids: frozenset
    name: Optional["re.Pattern[str]"]


def _p(url: str, ids=(), name: Optional[str] = None) -> Platform:
    return Platform(url, frozenset(ids), re.compile(name, re.I) if name else None)


# Services sold as a channel INSIDE another ("HBO Max Amazon Channel", "AMC Plus
# Apple TV channel", "MGM Plus Roku Premium Channel") are watched in that service,
# so they match first, by name.
CHANNELS = (
    _p(AMAZON, name=r"amazon channel$"),
    _p(APPLE_TV, name=r"apple tv channel$"),
    _p(ROKU, name=r"roku premium channel$"),
)

PLATFORMS = (
    # Checked: the page answers and shows the title.
    _p(AMAZON, ids=(9, 10, 119, 2100), name=r"^amazon"),
    _p(APPLE_TV, ids=(2, 350), name=r"^apple (tv|itunes)"),
    _p("https://tubitv.com/search/{q}", ids=(73,), name=r"^tubi"),
    _p("https://watch.plex.tv/search?q={q}", ids=(538,), name=r"^plex$"),
    _p("https://www.youtube.com/results?search_query={q}", ids=(192, 188), name=r"^youtube( premium| free)?$"),
    _p(ROKU, ids=(207,), name=r"^the roku channel$"),
    _p("https://www.cwtv.com/search/?q={q}", ids=(83,), name=r"^the cw$"),
    _p("https://www.hoopladigital.com/search?q={q}", ids=(212,), name=r"^hoopla$"),
    _p("https://www.amcplus.com/search?q={q}", ids=(526,), name=r"^amc( plus|\+)$"),
    _p("https://www.criterionchannel.com/search?q={q}", ids=(258,), name=r"^criterion channel"),
    _p("https://www.pbs.org/search/?q={q}", ids=(209,), name=r"^pbs$"),
    _p("https://mubi.com/en/search/films?query={q}", ids=(11,), name=r"^mubi$"),
    _p("https://www.justwatch.com/{region}/search?q={q}", ids=(2285, 2784, 2785), name=r"^justwatch tv"),
    # The site publishes this address itself (its OpenSearch file).
    _p("https://www.vudu.com/movies/search/{q}", ids=(7, 332), name=r"^fandango at home"),
    # Accepted by the site, which keeps the title through its redirects; the page
    # then fills in with a script, so what it shows could not be read here.
    _p("https://www.netflix.com/search?q={q}", ids=(8, 175, 1796), name=r"^netflix"),
    _p("https://www.hbomax.com/search?q={q}", ids=(1899, 384), name=r"^(hbo )?max$"),
    _p("https://www.paramountplus.com/search/?q={q}", ids=(531, 2303, 2616, 37), name=r"^(paramount( plus|\+)|showtime$)"),
    _p("https://www.peacocktv.com/watch/search?q={q}", ids=(386, 387), name=r"^peacock"),
    _p("https://play.google.com/store/search?q={q}&c=movies", ids=(3,), name=r"^google play"),
    _p("https://www.kanopy.com/s?query={q}", ids=(191,), name=r"^kanopy$"),
    _p("https://www.crunchyroll.com/search?q={q}", ids=(283,), name=r"^crunchyroll$"),
    _p("https://www.fubo.tv/search/{q}", ids=(257,), name=r"^fubotv$"),
    _p("https://www.starz.com/search?query={q}", ids=(43,), name=r"^starz$"),
    _p("https://vimeo.com/search?q={q}", ids=(2529,), name=r"^vimeo$"),
    # From the open-source registry mapping TMDB ids to search addresses
    # (git.jrvs.io/jake/sofa, lib/providers.ts). Both need a login, so they could
    # not be tried here: click-test them with an account.
    _p("https://www.disneyplus.com/search/{q}", ids=(337,), name=r"^disney( plus|\+)$"),
    _p("https://www.hulu.com/search?q={q}", ids=(15,), name=r"^hulu$"),
)


def link_for(provider_id: Optional[int], provider_name: str, title: str, region: str) -> Optional[str]:
    """The search link for this platform and film, or None if we don't know the
    platform. `region` is a two-letter country code."""
    name = (provider_name or "").strip()
    match = next((c for c in CHANNELS if c.name and c.name.search(name)), None)
    if match is None:
        match = next(
            (p for p in PLATFORMS if (provider_id in p.ids) or (p.name and p.name.search(name))),
            None,
        )
    if match is None or not title.strip():
        return None
    return match.url.format(
        q=quote(title.strip(), safe=""),
        region=region.lower(),
        amazon=AMAZON_TLD.get(region.upper(), "com"),
    )
