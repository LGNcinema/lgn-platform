"""Shared-password authentication for the internal LGN admin portal.

Design constraints, in order of importance:

1.  **Not a database vendor's auth product.** The platform has already moved
    hosts once (Supabase -> Neon), so the admin
    gate must not depend on it. A single shared password lives in the backend
    `.env` and is only ever compared server-side.
2.  **Stdlib only.** No PyJWT, no itsdangerous, no passlib -- an HMAC-signed
    token is ~40 lines of `hmac` + `hashlib` + `base64`, and adding a
    dependency for it would be the larger risk.
3.  **Stateless.** There is no session table. A token carries its own expiry
    and is validated purely by re-computing its signature, so the API stays
    horizontally scalable and a restart does not log staff out.

Token format::

    base64url(payload_json) "." base64url(hmac_sha256(payload_json, secret))

with payload ``{"exp": <unix timestamp>}``.

SECURITY -- the single most important rule in this module: an unset or empty
``ADMIN_PASSWORD`` means the admin portal is **NOT CONFIGURED**, and every
admin endpoint answers ``503 Service Unavailable``. It must never fall through
to "no authentication required"; a misconfigured deploy has to fail closed.

Note also that this is a *shared* password: there is exactly one admin
identity, so the API can prove that an editor knew the password but cannot
attribute an edit to a person. There is no per-user audit trail.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Header, HTTPException, status

from app.config import settings

# Separator between payload and signature. Not present in base64url output.
_SEPARATOR = "."

NOT_CONFIGURED_DETAIL = "Admin portal is not configured"
INVALID_PASSWORD_DETAIL = "Invalid password"
INVALID_TOKEN_DETAIL = "Invalid or expired admin token"
MISSING_TOKEN_DETAIL = "Missing admin bearer token"


# ---------------------------------------------------------------------------
# Configuration state
# ---------------------------------------------------------------------------

def is_configured() -> bool:
    """True only when a non-empty admin password is set.

    Read from ``settings`` on every call rather than captured at import time,
    so tests (and a reload) see the current environment.
    """
    return bool((settings.ADMIN_PASSWORD or "").strip())


def _signing_secret() -> bytes:
    """The HMAC key used to sign and verify admin tokens.

    Prefers an explicitly-configured ``ADMIN_SECRET``. Otherwise it is derived
    deterministically from the admin password.

    Deriving from the password means that **changing ADMIN_PASSWORD
    immediately invalidates every token that was ever issued**, because the
    signing key changes with it. That is the desired behaviour: rotating the
    shared password is the only revocation mechanism a stateless,
    single-identity scheme has, and it should log everyone out at once. Set
    ADMIN_SECRET explicitly only if you want password rotation *not* to end
    live sessions.
    """
    explicit = (settings.ADMIN_SECRET or "").strip()
    if explicit:
        return explicit.encode("utf-8")
    password = (settings.ADMIN_PASSWORD or "").strip()
    return hashlib.sha256(b"lgn-admin:" + password.encode("utf-8")).hexdigest().encode("utf-8")


# ---------------------------------------------------------------------------
# base64url helpers (unpadded, URL-safe -- token travels in a header)
# ---------------------------------------------------------------------------

def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _sign(payload: bytes) -> bytes:
    return hmac.new(_signing_secret(), payload, hashlib.sha256).digest()


# ---------------------------------------------------------------------------
# Password check
# ---------------------------------------------------------------------------

def verify_password(candidate: str) -> bool:
    """Constant-time comparison of a submitted password against the configured one.

    Never logs or echoes either value. Returns False when unconfigured; callers
    are expected to have already raised 503 in that case.
    """
    if not is_configured():
        return False
    expected = (settings.ADMIN_PASSWORD or "").strip()
    return hmac.compare_digest((candidate or "").encode("utf-8"), expected.encode("utf-8"))


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------

def create_token() -> tuple[str, datetime]:
    """Issue a signed admin token. Returns ``(token, expires_at)`` in UTC."""
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.ADMIN_TOKEN_TTL_HOURS)
    payload = json.dumps({"exp": int(expires_at.timestamp())}, separators=(",", ":")).encode("utf-8")
    token = f"{_b64encode(payload)}{_SEPARATOR}{_b64encode(_sign(payload))}"
    return token, expires_at


def verify_token(token: str) -> bool:
    """True when `token` is well-formed, correctly signed, and not expired.

    Fails closed on anything unexpected -- malformed base64, non-JSON payload,
    a missing `exp`, or an unconfigured portal.
    """
    if not is_configured() or not token:
        return False

    parts = token.split(_SEPARATOR)
    if len(parts) != 2:
        return False
    encoded_payload, encoded_signature = parts

    try:
        payload = _b64decode(encoded_payload)
        signature = _b64decode(encoded_signature)
    except (ValueError, TypeError):
        return False

    # Constant-time signature check before the payload is trusted at all.
    if not hmac.compare_digest(signature, _sign(payload)):
        return False

    try:
        claims = json.loads(payload.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return False

    expiry = claims.get("exp") if isinstance(claims, dict) else None
    if not isinstance(expiry, (int, float)) or isinstance(expiry, bool):
        return False

    return datetime.now(timezone.utc).timestamp() < expiry


def _bearer_token(authorization: Optional[str]) -> Optional[str]:
    """Extract the token from an ``Authorization: Bearer <token>`` header."""
    if not authorization:
        return None
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer":
        return None
    return value.strip() or None


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def require_admin(authorization: Optional[str] = Header(None)) -> bool:
    """Gate an endpoint behind the shared admin password.

    * 503 -- the portal has no password configured (fail closed, never open).
    * 401 -- no bearer token, or one that is missing/expired/tampered with.
    """
    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=NOT_CONFIGURED_DETAIL,
        )

    token = _bearer_token(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=MISSING_TOKEN_DETAIL,
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_TOKEN_DETAIL,
            headers={"WWW-Authenticate": "Bearer"},
        )

    return True


def require_configured() -> None:
    """503 when the portal is unconfigured. For the login route, which has no token yet."""
    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=NOT_CONFIGURED_DETAIL,
        )
