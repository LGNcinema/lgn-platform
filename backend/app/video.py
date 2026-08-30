"""Helpers for normalizing a raw video reference into a provider-tagged source.

An LGN admin is typically handed whatever the studio sends them: a full Vimeo
`<iframe>` embed snippet, a bare player URL, a public vimeo.com link, or a plain
mp4. `parse_video_source` turns any of those into the normalized triple

    (provider, video_id, video_hash)

that the `films` table stores, so the frontend can render the right player
without sniffing URLs itself.

Providers: "vimeo", "mux", "youtube", "file".
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from typing import Optional, Tuple
from urllib.parse import parse_qs, urlparse

# Provider constants (mirrors the CHECK-style contract used by the frontend).
PROVIDER_VIMEO = "vimeo"
PROVIDER_MUX = "mux"
PROVIDER_YOUTUBE = "youtube"
PROVIDER_FILE = "file"

VALID_PROVIDERS = (PROVIDER_VIMEO, PROVIDER_MUX, PROVIDER_YOUTUBE, PROVIDER_FILE)

# `<iframe ... src="...">` — tolerant of single/double quotes and attribute order.
_IFRAME_SRC_RE = re.compile(r"""<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']""", re.IGNORECASE)

# Fallback: any http(s) URL sitting inside a blob of markup/text.
_ANY_URL_RE = re.compile(r"""https?://[^\s"'<>\\]+""", re.IGNORECASE)

# https://player.vimeo.com/video/1052574030
_VIMEO_PLAYER_PATH_RE = re.compile(r"^/video/(\d+)(?:/([0-9A-Za-z]+))?/?$")
# https://vimeo.com/1052574030  or  https://vimeo.com/1052574030/53c90178cb
_VIMEO_PATH_RE = re.compile(r"^/(?:channels/[^/]+/|groups/[^/]+/videos/)?(\d+)(?:/([0-9A-Za-z]+))?/?$")

_MUX_HOSTS = ("stream.mux.com", "player.mux.com", "image.mux.com")
_YOUTUBE_HOSTS = ("youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com",
                  "www.youtube-nocookie.com")


@dataclass(frozen=True)
class VideoSource:
    """Normalized, provider-tagged description of a film's video."""

    provider: Optional[str] = None
    video_id: Optional[str] = None
    video_hash: Optional[str] = None

    def as_tuple(self) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        return (self.provider, self.video_id, self.video_hash)


def extract_url(raw: str) -> Optional[str]:
    """Pull a usable URL out of `raw`, which may be an iframe snippet or a bare URL.

    HTML entities (notably the `&amp;` that shows up in copy-pasted embed code)
    are unescaped so the query string parses correctly.
    """
    if not raw:
        return None

    candidate = raw.strip()

    match = _IFRAME_SRC_RE.search(candidate)
    if match:
        candidate = match.group(1).strip()
    elif "<" in candidate or ">" in candidate:
        # Markup, but not an iframe we recognize — grab the first URL in it.
        url_match = _ANY_URL_RE.search(html.unescape(candidate))
        candidate = url_match.group(0) if url_match else candidate

    # Unescape after extraction so `&amp;` inside a src attribute becomes `&`.
    candidate = html.unescape(candidate).strip()

    if not candidate:
        return None
    # Protocol-relative embeds (`//player.vimeo.com/...`) still need a scheme.
    if candidate.startswith("//"):
        candidate = "https:" + candidate
    return candidate


def parse_video_source(raw: Optional[str]) -> VideoSource:
    """Normalize `raw` into a (provider, video_id, video_hash) triple.

    Accepts a full Vimeo iframe embed snippet, a player.vimeo.com URL, a
    vimeo.com/ID[/HASH] URL, a YouTube URL, a Mux stream/playback URL, or a
    plain file URL. Returns an all-``None`` VideoSource when nothing usable is
    found, so callers can leave the columns NULL.
    """
    url = extract_url(raw or "")
    if not url:
        return VideoSource()

    try:
        parsed = urlparse(url)
    except ValueError:
        return VideoSource()

    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    query = parse_qs(parsed.query)

    # --- Vimeo ---------------------------------------------------------
    if host == "player.vimeo.com" or host.endswith(".player.vimeo.com"):
        match = _VIMEO_PLAYER_PATH_RE.match(path)
        if match:
            video_hash = match.group(2) or _first(query.get("h"))
            return VideoSource(PROVIDER_VIMEO, match.group(1), video_hash)
        return VideoSource(PROVIDER_VIMEO, None, _first(query.get("h")))

    if host == "vimeo.com" or host.endswith(".vimeo.com"):
        match = _VIMEO_PATH_RE.match(path)
        if match:
            video_hash = match.group(2) or _first(query.get("h"))
            return VideoSource(PROVIDER_VIMEO, match.group(1), video_hash)
        return VideoSource(PROVIDER_VIMEO, None, _first(query.get("h")))

    # --- YouTube -------------------------------------------------------
    if host in _YOUTUBE_HOSTS:
        video_id = _first(query.get("v"))
        if not video_id:
            # /embed/ID, /v/ID, /shorts/ID
            embed = re.match(r"^/(?:embed|v|shorts)/([0-9A-Za-z_-]{6,})", path)
            video_id = embed.group(1) if embed else None
        return VideoSource(PROVIDER_YOUTUBE, video_id, None)

    if host in ("youtu.be", "www.youtu.be"):
        segment = path.lstrip("/").split("/")[0]
        return VideoSource(PROVIDER_YOUTUBE, segment or None, None)

    # --- Mux -----------------------------------------------------------
    if host in _MUX_HOSTS or host.endswith(".mux.com"):
        # https://stream.mux.com/<playbackId>.m3u8 | https://player.mux.com/<playbackId>
        segment = path.lstrip("/").split("/")[0]
        playback_id = re.sub(r"\.(m3u8|mp4|jpg|png|webp)$", "", segment, flags=re.IGNORECASE)
        return VideoSource(PROVIDER_MUX, playback_id or None, None)

    # --- Anything else is treated as a directly-playable file ----------
    if parsed.scheme in ("http", "https") or path:
        return VideoSource(PROVIDER_FILE, None, None)

    return VideoSource()


def _first(values: Optional[list]) -> Optional[str]:
    if not values:
        return None
    value = values[0].strip()
    return value or None
