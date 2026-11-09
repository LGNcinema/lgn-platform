"""The universal prompt set: Reflect and Practice for Self, Neighbor and World,
used for every film LGN has not written its own questions for.

The wording is a PLACEHOLDER for LGN to edit (Admin > Films > Universal
prompts); it is written to work for any film, so it never names one.

POC: seeded into the local database by `seed_universal_prompts` on startup
(app/main.py) when there are none. There is deliberately no SQL migration yet --
when this ships, a migration will need to insert the same rows.
"""

DIMENSIONS = ("self", "neighbor", "world")
KINDS = ("reflect", "practice")

UNIVERSAL_PROMPTS = [
    {
        "kind": "reflect",
        "dimension": "self",
        "position": 1,
        "title": "Self question",
        "content": "What moment from this film stayed with you, and what does it stir up in you?",
    },
    {
        "kind": "reflect",
        "dimension": "neighbor",
        "position": 1,
        "title": "Neighbor question",
        "content": "Who in your life would you want to talk about this film with, and what would you want to ask them?",
    },
    {
        "kind": "reflect",
        "dimension": "world",
        "position": 1,
        "title": "World question",
        "content": "What does this film say about the world we share, and what might it be asking of us?",
    },
    {
        "kind": "practice",
        "dimension": "self",
        "position": 1,
        "title": "Sit with it",
        "steps": (
            "Set a timer for five minutes.\n"
            "Write down the one moment from the film you keep returning to.\n"
            "Notice what it asks of you, without trying to fix anything."
        ),
        "tips": "Keep it small. One honest sentence is enough.",
    },
    {
        "kind": "practice",
        "dimension": "neighbor",
        "position": 1,
        "title": "Take it to someone",
        "steps": (
            "Choose one person you trust.\n"
            "Tell them one moment from the film and why it stayed with you.\n"
            "Ask what they noticed, then listen without correcting."
        ),
        "tips": "You don't need them to have seen it. Start with the moment.",
    },
    {
        "kind": "practice",
        "dimension": "world",
        "position": 1,
        "title": "Carry it outward",
        "steps": (
            "Name one small, concrete action this film nudges you toward.\n"
            "Do it this week.\n"
            "Write down, or tell someone, what happened."
        ),
        "tips": "Small and real beats big and imagined.",
    },
]


def seed_universal_prompts(db) -> int:
    """Insert the universal set if there is none. Returns rows added."""
    from app import models

    exists = (
        db.query(models.FilmPrompt)
        .filter(models.FilmPrompt.source == "universal", models.FilmPrompt.external_film_id.is_(None))
        .first()
    )
    if exists:
        return 0
    for item in UNIVERSAL_PROMPTS:
        db.add(models.FilmPrompt(source="universal", external_film_id=None, **item))
    db.commit()
    return len(UNIVERSAL_PROMPTS)
