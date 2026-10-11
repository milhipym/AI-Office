"""Text clean-up for model output shown in the UI."""

import re

# Pictographs, dingbats, misc symbols, keycaps, flags, variation selectors and
# zero-width joiners. Arrows, CJK and ordinary punctuation are left alone.
_EMOJI = re.compile(
    "(?:["
    "\U0001F000-\U0001FAFF"
    "\u2600-\u27BF"
    "\u2300-\u23FF"
    "\u2B00-\u2BFF"
    "\uFE0E\uFE0F\u200D\u20E3"
    "\U000E0020-\U000E007F"
    "])+"
)


def strip_emoji(text: str) -> str:
    """Remove emoji from model output.

    The space after an emoji is dropped only when the emoji started a word
    ("## 📌 요약" -> "## 요약"), and the space before it when it ended a line
    ("완료 ✅" -> "완료"); otherwise text on both sides stays apart.
    """
    text = text or ""

    def drop(m):
        before = text[m.start() - 1] if m.start() else "\n"
        after = text[m.end():m.end() + 1]
        if before.isspace() and after == " ":
            return "\0"  # marker: eat the following space too
        if before == " " and after in ("", "\n"):
            return "\1"  # marker: emoji ended the line, eat the space before it
        return ""

    cleaned = _EMOJI.sub(drop, text)
    return cleaned.replace("\0 ", "").replace("\0", "").replace(" \1", "").replace("\1", "")
