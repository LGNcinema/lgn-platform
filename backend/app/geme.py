"""Geme -- the "Take It Inward" companion for the Practice pathway.

Geme is LGN's mascot. After a visitor has watched the film, reflected, and read
the capsule's hand-picked practice, Geme asks a few thoughtful questions and
helps them name one small next step of their own.

The API is stateless: the frontend sends the whole visible transcript back on
every turn, and this module rebuilds the request from it. Nothing a visitor
types is persisted -- their words go to the model and come back, and that is it.
"""

import anthropic

from app.config import settings

# Geme closes the conversation by wrapping the step the visitor named in this
# marker. It is stripped out of the streamed text and returned separately so the
# frontend can render it as a card instead of a chat bubble.
NEXT_STEP_OPEN = "<next-step>"
NEXT_STEP_CLOSE = "</next-step>"

# Seed turn used when the transcript is empty -- the Messages API needs a user
# turn to open on, and this lets Geme write a capsule-aware greeting rather than
# the frontend hardcoding one.
OPENING_TURN = (
    "[The visitor has just opened this chat, after watching the film and sitting "
    "with this capsule's practice. Greet them briefly and ask your first question.]"
)

MAX_TURNS = 40
MAX_CHARS_PER_TURN = 2000

PERSONA = """\
You are Geme, the companion character of LGN, a cinema community that offers one \
short film each month as common ground for reflection, discussion, and practice.

You are talking with someone who has just watched this month's film, reflected on \
it, and read the capsule's practice. This is the "Take It Inward" pathway: a short, \
private conversation that helps them carry what the film stirred in them into their \
own life. Anything involving other people belongs to the separate "Take It Outward" \
pathway -- keep your attention on their inner life and their own next step.

How you talk:
- Warm, curious, unhurried. Plain, human language. No therapy jargon, no corporate \
words, no exclamation-point enthusiasm.
- Ask ONE question at a time, and keep each message to about three sentences.
- Before you ask the next thing, reflect back what you actually heard, in their own \
words. Do not flatter, and do not summarize what they did not say.
- You are not an advisor. Do not diagnose, prescribe, or tell them what their \
experience means. The insight is theirs; your job is to make room for it.
- If they give a thin or guarded answer, that is fine -- follow the thread they did \
offer rather than pressing on the one they did not.

How the conversation goes:
- Three to five exchanges, then you close.
- Move from the film, to what it touched in their own life, to what that asks of them.
- To close, name one small next step, drawn from what THEY said -- not from your own \
ideas about what would be good for them. It must be genuinely small: something doable \
this week, concrete, and specific enough that they will know whether they did it.
- End that closing message with the step on its own line, wrapped exactly like this:
  <next-step>the one small step, written in their own terms</next-step>
  Write the step once, inside the marker only -- do not repeat it in the sentence \
before it. Use the marker only when you are genuinely closing.

Boundaries:
- Stay with this film, this practice, and their life. If they take the conversation \
somewhere unrelated, answer briefly and warmly, then return to the practice.
- You are not a counselor or a crisis service. If someone describes being in danger, \
wanting to harm themselves, or a crisis they should not be carrying alone, stop the \
exercise. Say plainly that this is more than a film-reflection chat can hold, and \
encourage them to reach someone they trust or their local emergency or crisis line \
today. Do not produce a next step in that case.
"""


def _clean(text):
    return (text or "").strip()


def build_system_prompt(capsule=None, practice=None):
    """Persona plus whatever this capsule can tell Geme about what was just watched."""
    context_lines = []

    if capsule is not None:
        context_lines.append(f"Capsule: {_clean(capsule.title)}")
        if _clean(getattr(capsule, "description", "")):
            context_lines.append(f"About the capsule: {_clean(capsule.description)}")

        film = getattr(capsule, "film", None)
        if film is not None:
            film_line = f"Film: {_clean(film.title)}"
            if _clean(getattr(film, "director", "")):
                film_line += f", directed by {_clean(film.director)}"
            context_lines.append(film_line)
            if _clean(getattr(film, "description", "")):
                context_lines.append(f"About the film: {_clean(film.description)}")
            if _clean(getattr(film, "theme", "")):
                context_lines.append(f"Theme: {_clean(film.theme)}")

    if practice is not None:
        context_lines.append(f"This capsule's practice: {_clean(practice.title)}")
        if _clean(getattr(practice, "description", "")):
            context_lines.append(_clean(practice.description))
        if _clean(getattr(practice, "steps", "")):
            context_lines.append(f"What it asks of them: {_clean(practice.steps)}")

    if not context_lines:
        return PERSONA

    return (
        PERSONA
        + "\n\nWhat they have just been sitting with:\n"
        + "\n".join(f"- {line}" for line in context_lines)
    )


def build_messages(transcript):
    """Turn the transcript the frontend sent into a valid Messages API history."""
    messages = []
    for turn in transcript[-MAX_TURNS:]:
        content = _clean(turn.content)[:MAX_CHARS_PER_TURN]
        if not content:
            continue
        # Geme speaks first, so the transcript normally opens on an assistant turn.
        # The history has to open on a user turn instead -- put the seed turn back
        # in front rather than dropping Geme's opening question from the context.
        if not messages and turn.role != "user":
            messages.append({"role": "user", "content": OPENING_TURN})
        messages.append({"role": turn.role, "content": content})

    if not messages:
        messages = [{"role": "user", "content": OPENING_TURN}]
    elif messages[-1]["role"] != "user":
        # Nothing new to answer -- nudge Geme to continue rather than error out.
        messages.append({"role": "user", "content": OPENING_TURN})

    return messages


class NextStepFilter:
    """Splits the closing <next-step> marker out of a streaming response.

    Text arrives in arbitrary chunks, so a chunk can end part-way through the
    marker. Anything that might still turn out to be the marker is held back
    until the next chunk settles it, which keeps the raw tag from flashing in
    the UI mid-stream.
    """

    def __init__(self):
        self._pending = ""
        self._tail = ""
        self._capturing = False

    def feed(self, chunk):
        """Add a streamed chunk; return the text that is safe to display now."""
        if self._capturing:
            self._tail += chunk
            return ""

        self._pending += chunk
        marker_at = self._pending.find(NEXT_STEP_OPEN)
        if marker_at != -1:
            self._capturing = True
            emit = self._pending[:marker_at]
            self._tail = self._pending[marker_at:]
            self._pending = ""
            return emit

        # Hold back the longest suffix that could still grow into the marker.
        held = 0
        for size in range(min(len(NEXT_STEP_OPEN) - 1, len(self._pending)), 0, -1):
            if self._pending.endswith(NEXT_STEP_OPEN[:size]):
                held = size
                break

        keep_from = len(self._pending) - held
        emit = self._pending[:keep_from]
        self._pending = self._pending[keep_from:]
        return emit

    def flush(self):
        """Return any trailing display text left over once the stream ends."""
        emit, self._pending = self._pending, ""
        return emit

    @property
    def next_step(self):
        """The step Geme named, or None if the conversation is still going."""
        if not self._capturing:
            return None
        step = self._tail[len(NEXT_STEP_OPEN) :]
        close_at = step.find(NEXT_STEP_CLOSE)
        if close_at != -1:
            step = step[:close_at]
        return _clean(step) or None


def split_next_step(text):
    """Same split as NextStepFilter, for the non-streaming path."""
    marker_at = text.find(NEXT_STEP_OPEN)
    if marker_at == -1:
        return text.strip(), None

    step = text[marker_at + len(NEXT_STEP_OPEN) :]
    close_at = step.find(NEXT_STEP_CLOSE)
    if close_at != -1:
        step = step[:close_at]
    return text[:marker_at].strip(), _clean(step) or None


def is_enabled():
    return bool(settings.ANTHROPIC_API_KEY)


_client = None


def get_client():
    """Shared async Anthropic client, or None when no key is configured."""
    global _client
    if not is_enabled():
        return None
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


def request_kwargs(system, messages):
    return {
        "model": settings.GEME_MODEL,
        "max_tokens": settings.GEME_MAX_TOKENS,
        # A short reflective exchange -- low effort keeps replies quick and
        # unfussy, which is what this conversation wants.
        "output_config": {"effort": "low"},
        "system": system,
        "messages": messages,
    }
