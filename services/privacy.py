"""Mask personal data before text leaves the laptop.

Every OpenAI call goes through services.openai_client, which runs the prompt,
history and embedding inputs through mask(). Records in brain.db keep the
original text; only what is sent out is masked.

The patterns are deliberately narrow: a false positive garbles a work log, a
false negative leaks one value. Company-specific identifiers (policy or
contract numbers) are added with MASK_EXTRA_PATTERNS in .env.
"""

import re

import config

# Order matters: longer, more specific numbers first so a resident number is
# not half-eaten by the phone pattern.
_BUILTIN = [
    ("주민번호", r"(?<!\d)\d{6}\s?-\s?[1-8]\d{6}(?!\d)"),
    ("카드번호", r"(?<!\d)\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}(?!\d)|(?<!\d)\d{16}(?!\d)"),
    ("전화번호", r"(?<!\d)01[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)"),
    ("전화번호", r"(?<!\d)0(?:2|[3-6][1-5]|70)[- .]\d{3,4}[- .]\d{4}(?!\d)"),
    ("이메일", r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+"),
    # Plate letters only, so "12주3000" style text rarely matches by accident.
    ("차량번호", r"(?<!\d)\d{2,3}[가나다라마거너더러머버서어저고노도로모보소오조구누두루무부수우주아바사자배하허호]\s?\d{4}(?!\d)"),
]


def _compile():
    patterns = [(label, re.compile(rx)) for label, rx in _BUILTIN]
    for i, rx in enumerate(config.MASK_EXTRA_PATTERNS, 1):
        try:
            patterns.append(("식별번호", re.compile(rx)))
        except re.error as e:
            print(f"[!] MASK_EXTRA_PATTERNS #{i} ignored: {e}")
    return patterns


_PATTERNS = _compile()


def mask(text: str) -> tuple:
    """Return (masked text, number of values replaced)."""
    if not text or not config.MASK_PERSONAL_DATA:
        return text, 0
    total = 0
    for label, rx in _PATTERNS:
        text, n = rx.subn(f"[{label}]", text)
        total += n
    return text, total
