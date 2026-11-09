"""A small in-memory rate limit, per client address and bucket.

Best effort on purpose: each serverless instance keeps its own counts, so this
slows a single noisy client and a simple bot; it is not a hard global limit.
The global brakes for anything that costs money (the AI) are the daily cap and
kill switch in app/film_ai.py, which live in the database.
"""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

_hits: dict = defaultdict(deque)
_MAX_KEYS = 5000


def client_ip(request: Request) -> str:
    # Behind Vercel the client is the first address in X-Forwarded-For.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check(request: Request, bucket: str, limit: int, window_seconds: int) -> None:
    """Raise 429 when this client has used `limit` requests in the window."""
    now = time.monotonic()
    key = (bucket, client_ip(request))
    hits = _hits[key]
    while hits and now - hits[0] > window_seconds:
        hits.popleft()
    if len(hits) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please wait a moment and try again.",
            headers={"Retry-After": str(window_seconds)},
        )
    hits.append(now)
    if len(_hits) > _MAX_KEYS:  # never grow without bound
        for stale in [k for k, v in _hits.items() if not v or now - v[-1] > window_seconds][:1000]:
            _hits.pop(stale, None)


def reset() -> None:
    """Forget everything (tests)."""
    _hits.clear()
