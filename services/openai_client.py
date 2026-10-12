"""Thin wrapper around the OpenAI SDK.

All agents go through these helpers so we have a single place to handle
errors, missing API keys, and model switching.
"""

import json
import time
from typing import Optional

from config import (
    EMBEDDING_MODEL,
    OPENAI_API_KEY,
    OPENAI_IMAGE_MODEL,
    OPENAI_MODEL,
    is_openai_configured,
)
from services.privacy import mask

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    if not is_openai_configured():
        return None
    try:
        from openai import OpenAI
        # Without a timeout the SDK waits up to 10 minutes per call and the
        # synchronous Flask request hangs with it.
        _client = OpenAI(api_key=OPENAI_API_KEY, timeout=90.0, max_retries=1)
        return _client
    except ImportError:
        return None


class OpenAIError(Exception):
    """Raised when an OpenAI API call fails or the client is unavailable."""


def chat_completion(
    system_prompt: str,
    user_message: str,
    history: Optional[list] = None,
    model: Optional[str] = None,
    temperature: Optional[float] = 0.7,
    json_mode: bool = False,
) -> dict:
    """Call chat.completions.create and return a normalized dict.

    temperature=None omits the parameter, which reasoning models require.

    Returns: {"text": str, "model": str, "tokens": int, "latency_ms": int}
    """
    client = _get_client()
    if client is None:
        raise OpenAIError("OpenAI client is not configured. Set OPENAI_API_KEY in .env")

    messages = [{"role": "system", "content": system_prompt}]
    if history:
        # Only include last 10 messages to limit token usage
        for h in history[-10:]:
            role = "user" if h.get("agent") == "user" else "assistant"
            messages.append({"role": role, "content": h.get("message", "")})
    messages.append({"role": "user", "content": user_message})
    # The system prompt carries stored records too, so mask every message.
    masked = 0
    for m in messages:
        m["content"], n = mask(m["content"])
        masked += n

    start = time.time()
    try:
        kwargs = {"model": model or OPENAI_MODEL, "messages": messages}
        if temperature is not None:
            kwargs["temperature"] = temperature
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = client.chat.completions.create(**kwargs)
    except Exception as e:
        raise OpenAIError(f"OpenAI chat completion failed: {e}") from e

    latency_ms = int((time.time() - start) * 1000)
    return {
        "text": resp.choices[0].message.content or "",
        "model": resp.model,
        "tokens": resp.usage.total_tokens if resp.usage else 0,
        "latency_ms": latency_ms,
        "masked": masked,
    }


def json_completion(system_prompt: str, user_message: str, model: Optional[str] = None) -> dict:
    """Chat completion in JSON mode, parsed. Raises OpenAIError on bad JSON.

    Returns: {"data": dict, "model": str, "tokens": int, "latency_ms": int}
    """
    result = chat_completion(
        system_prompt=system_prompt,
        user_message=user_message,
        model=model,
        temperature=None,
        json_mode=True,
    )
    try:
        data = json.loads(result["text"])
    except json.JSONDecodeError as e:
        raise OpenAIError(f"Model returned invalid JSON: {e}") from e
    if not isinstance(data, dict):
        raise OpenAIError("Model returned JSON that is not an object")
    return {**result, "data": data}


def embed(texts: list, model: Optional[str] = None) -> list:
    """Return one embedding vector (list of floats) per input text."""
    client = _get_client()
    if client is None:
        raise OpenAIError("OpenAI client is not configured. Set OPENAI_API_KEY in .env")
    if not texts:
        return []
    texts = [mask(t)[0] for t in texts]
    try:
        resp = client.embeddings.create(model=model or EMBEDDING_MODEL, input=texts)
    except Exception as e:
        raise OpenAIError(f"OpenAI embedding failed: {e}") from e
    return [d.embedding for d in sorted(resp.data, key=lambda d: d.index)]


def generate_image(prompt: str, size: str = "1024x1024") -> dict:
    """Generate an image via DALL-E 3 and return the URL.

    Returns: {"url": str, "revised_prompt": str, "latency_ms": int}
    """
    client = _get_client()
    if client is None:
        raise OpenAIError("OpenAI client is not configured. Set OPENAI_API_KEY in .env")

    start = time.time()
    try:
        resp = client.images.generate(
            model=OPENAI_IMAGE_MODEL,
            prompt=mask(prompt)[0],
            size=size,
            quality="standard",
            n=1,
        )
    except Exception as e:
        raise OpenAIError(f"OpenAI image generation failed: {e}") from e

    latency_ms = int((time.time() - start) * 1000)
    data = resp.data[0]
    return {
        "url": data.url,
        "revised_prompt": getattr(data, "revised_prompt", prompt),
        "latency_ms": latency_ms,
    }


def web_search_response(query: str) -> dict:
    """Use the Responses API with the web_search tool for live search.

    Returns: {"text": str, "citations": list, "latency_ms": int}
    Each citation: {"index": int, "title": str, "url": str}
    """
    client = _get_client()
    if client is None:
        raise OpenAIError("OpenAI client is not configured. Set OPENAI_API_KEY in .env")

    start = time.time()
    try:
        resp = client.responses.create(
            model=OPENAI_MODEL,
            tools=[{"type": "web_search"}],
            input=mask(query)[0],
        )
    except Exception as e:
        # Fallback: regular chat completion if Responses API not available
        try:
            fallback = chat_completion(
                system_prompt=(
                    "You are a researcher. Answer based on your knowledge. "
                    "Note explicitly that you cannot access the live web."
                ),
                user_message=query,
            )
            return {
                "text": fallback["text"],
                "citations": [],
                "latency_ms": fallback["latency_ms"],
                "fallback": True,
            }
        except Exception as inner:
            raise OpenAIError(
                f"Both web_search and fallback failed: {e} / {inner}"
            ) from e

    latency_ms = int((time.time() - start) * 1000)

    # Parse citations from annotations
    text_parts = []
    citations = []
    citation_index = 0
    seen_urls = set()

    output = getattr(resp, "output", []) or []
    for item in output:
        if getattr(item, "type", None) == "message":
            for content in getattr(item, "content", []) or []:
                if getattr(content, "type", None) == "output_text":
                    text_parts.append(content.text or "")
                    for ann in getattr(content, "annotations", []) or []:
                        if getattr(ann, "type", None) == "url_citation":
                            url = getattr(ann, "url", "")
                            if url and url not in seen_urls:
                                citation_index += 1
                                seen_urls.add(url)
                                citations.append({
                                    "index": citation_index,
                                    "title": getattr(ann, "title", url) or url,
                                    "url": url,
                                })

    return {
        "text": "\n\n".join(text_parts) or getattr(resp, "output_text", "") or "",
        "citations": citations,
        "latency_ms": latency_ms,
    }
