"""The per-platform "Where to watch" links (app/watch_links.py)."""

from urllib.parse import unquote, urlparse

import pytest

from app import watch_links
from app.watch_links import CHANNELS, PLATFORMS, link_for

TITLE = "The Goonies"


@pytest.mark.parametrize(
    "provider_id, name, expected",
    [
        (8, "Netflix", "https://www.netflix.com/search?q=The%20Goonies"),
        (1796, "Netflix basic with Ads", "https://www.netflix.com/search?q=The%20Goonies"),
        (9, "Amazon Prime Video", "https://www.amazon.com/s?k=The%20Goonies&i=instant-video"),
        (10, "Amazon Video", "https://www.amazon.com/s?k=The%20Goonies&i=instant-video"),
        (2100, "Amazon Prime Video with Ads", "https://www.amazon.com/s?k=The%20Goonies&i=instant-video"),
        (2, "Apple TV Store", "https://tv.apple.com/search?term=The%20Goonies"),
        (350, "Apple TV", "https://tv.apple.com/search?term=The%20Goonies"),
        (337, "Disney Plus", "https://www.disneyplus.com/search/The%20Goonies"),
        (15, "Hulu", "https://www.hulu.com/search?q=The%20Goonies"),
        (1899, "Max", "https://www.hbomax.com/search?q=The%20Goonies"),
        (384, "HBO Max", "https://www.hbomax.com/search?q=The%20Goonies"),
        (2303, "Paramount Plus Premium", "https://www.paramountplus.com/search/?q=The%20Goonies"),
        (37, "Showtime", "https://www.paramountplus.com/search/?q=The%20Goonies"),
        (386, "Peacock Premium", "https://www.peacocktv.com/watch/search?q=The%20Goonies"),
        (73, "Tubi TV", "https://tubitv.com/search/The%20Goonies"),
        (538, "Plex", "https://watch.plex.tv/search?q=The%20Goonies"),
        (3, "Google Play Movies", "https://play.google.com/store/search?q=The%20Goonies&c=movies"),
        (192, "YouTube", "https://www.youtube.com/results?search_query=The%20Goonies"),
        (188, "YouTube Premium", "https://www.youtube.com/results?search_query=The%20Goonies"),
        (191, "Kanopy", "https://www.kanopy.com/s?query=The%20Goonies"),
        (258, "Criterion Channel", "https://www.criterionchannel.com/search?q=The%20Goonies"),
        (11, "MUBI", "https://mubi.com/en/search/films?query=The%20Goonies"),
        (7, "Fandango At Home", "https://www.vudu.com/movies/search/The%20Goonies"),
        (332, "Fandango at Home Free", "https://www.vudu.com/movies/search/The%20Goonies"),
        (2784, "JustWatch TV Store", "https://www.justwatch.com/us/search?q=The%20Goonies"),
        (207, "The Roku Channel", "https://therokuchannel.roku.com/search/The%20Goonies"),
        (83, "The CW", "https://www.cwtv.com/search/?q=The%20Goonies"),
        (212, "Hoopla", "https://www.hoopladigital.com/search?q=The%20Goonies"),
        (526, "AMC+", "https://www.amcplus.com/search?q=The%20Goonies"),
        (1999, "YouTube Free", "https://www.youtube.com/results?search_query=The%20Goonies"),
    ],
)
def test_known_platforms_get_their_own_search(provider_id, name, expected):
    assert link_for(provider_id, name, TITLE, "US") == expected


@pytest.mark.parametrize(
    "provider_id, name, host",
    [
        # A channel sold inside Amazon / Apple TV is watched there, whatever the service.
        (582, "Paramount+ Amazon Channel", "www.amazon.com"),
        (1825, "HBO Max Amazon Channel", "www.amazon.com"),
        (1968, "Crunchyroll Amazon Channel", "www.amazon.com"),
        (294, "PBS Masterpiece Amazon Channel", "www.amazon.com"),
        (1854, "AMC Plus Apple TV channel", "tv.apple.com"),
        (1852, "Britbox Apple TV channel", "tv.apple.com"),
        (636, "MGM Plus Roku Premium Channel", "therokuchannel.roku.com"),
        (635, "AMC+ Roku Premium Channel", "therokuchannel.roku.com"),
    ],
)
def test_channels_go_to_the_service_they_are_sold_in(provider_id, name, host):
    assert urlparse(link_for(provider_id, name, TITLE, "US")).netloc == host


@pytest.mark.parametrize(
    "provider_id, name",
    [
        (999999, "Some Service Nobody Told Us About"),
        (2528, "YouTube TV"),          # live TV, not the film
        (122, "Disney+ Hotstar"),       # a different service from Disney+
        (300, "Pluto TV"),              # its search drops the query, so no link of our own
        (None, ""),
    ],
)
def test_unknown_platforms_get_no_link_of_their_own(provider_id, name):
    assert link_for(provider_id, name, TITLE, "US") is None


def test_a_platform_is_matched_by_id_even_if_its_name_changes():
    assert link_for(8, "Netflix, renamed again", TITLE, "US") == "https://www.netflix.com/search?q=The%20Goonies"


def test_amazon_uses_the_visitors_country_store():
    assert "www.amazon.co.uk/" in link_for(9, "Amazon Prime Video", TITLE, "GB")
    assert "www.amazon.de/" in link_for(9, "Amazon Prime Video", TITLE, "AT")
    assert "www.amazon.com.au/" in link_for(9, "Amazon Prime Video", TITLE, "au")  # any case
    assert "www.amazon.com/" in link_for(9, "Amazon Prime Video", TITLE, "ZZ")     # no store of its own


def test_justwatch_tv_uses_the_lowercase_region_in_its_path():
    assert link_for(2785, "JustWatch TV Plus", TITLE, "GB") == "https://www.justwatch.com/gb/search?q=The%20Goonies"


@pytest.mark.parametrize("title", ["Wall·E", "Amélie", "Why? (Part #1)", "Tom & Jerry", "100% Wolf", "Ocean's Eleven", "A+B=C"])
def test_titles_are_encoded_so_they_cannot_break_out_of_the_url(title):
    url = link_for(8, "Netflix", title, "US")
    query = url.split("q=", 1)[1]
    assert unquote(query) == title
    assert not set(" &#?+'\"/") & set(query), "something structural was left unescaped"
    assert urlparse(url).netloc == "www.netflix.com" and urlparse(url).fragment == ""


def test_a_blank_title_gets_no_link():
    assert link_for(8, "Netflix", "   ", "US") is None


def test_the_table_is_consistent():
    all_ids = [i for p in PLATFORMS for i in p.ids]
    assert len(all_ids) == len(set(all_ids)), "a provider id is claimed by two platforms"
    for platform in (*CHANNELS, *PLATFORMS):
        assert platform.url.startswith("https://")
        assert platform.ids or platform.name, "a rule that can never match"
        # Every template builds, leaves no placeholder behind, and puts the title in.
        built = platform.url.format(q="TITLE", region="us", amazon="com")
        assert "{" not in built and "TITLE" in built
