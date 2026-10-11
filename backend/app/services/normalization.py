import ipaddress
import re
from urllib.parse import urlparse, urlunparse


def infer_indicator_type(value: str) -> str:
    candidate = (value or "").strip()
    if not candidate:
        raise ValueError("Indicator value is required")

    try:
        ipaddress.ip_address(candidate)
        return "ip"
    except ValueError:
        pass

    if re.match(r"^https?://", candidate, flags=re.IGNORECASE):
        return "url"

    if re.match(r"^(?:[a-z0-9.-]+\.)+[a-z]{2,}(?:/.*)?$", candidate, flags=re.IGNORECASE):
        return "domain"

    if re.fullmatch(r"[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64}", candidate, flags=re.IGNORECASE):
        return "hash"

    return "text"


def normalize_indicator_value(value: str, indicator_type: str | None = None) -> str:
    candidate = (value or "").strip()
    if not candidate:
        raise ValueError("Indicator value is required")

    inferred_type = indicator_type or infer_indicator_type(candidate)

    if inferred_type == "ip":
        return str(ipaddress.ip_address(candidate))

    if inferred_type == "domain":
        return candidate.lower().rstrip(".")

    if inferred_type == "hash":
        return candidate.lower()

    if inferred_type == "url":
        parsed = urlparse(candidate if "//" in candidate else f"//{candidate}")
        if not parsed.scheme:
            parsed = urlparse(f"http://{candidate}")
        normalized_netloc = parsed.netloc.lower()
        normalized_path = parsed.path or "/"
        normalized_url = urlunparse(
            (
                parsed.scheme.lower(),
                normalized_netloc,
                normalized_path,
                parsed.params,
                parsed.query,
                parsed.fragment,
            )
        )
        return normalized_url

    return candidate.strip()
