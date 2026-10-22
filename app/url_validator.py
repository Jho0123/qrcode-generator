from urllib.parse import urlparse, urlunparse

MAX_URL_LENGTH = 2048

BLOCKED_DOMAINS = {
    "evil.com",
    "malware.example.com",
    "phishing.example.com",
}


def is_blocked_domain(hostname: str | None) -> bool:
    if hostname is None:
        return True
    return hostname.lower() in BLOCKED_DOMAINS


def validate_url(url: str) -> str:
    """Format check, normalization, and blocklist validation."""
    if not url or len(url) > MAX_URL_LENGTH:
        raise ValueError(f"URL must be between 1 and {MAX_URL_LENGTH} characters")

    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL scheme must be http or https")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL must include a hostname")

    if is_blocked_domain(hostname):
        raise ValueError(f"Domain '{hostname}' is blocked")

    # Normalize: lowercase host, strip the scheme's default port, upgrade
    # http -> https, and drop any trailing slash from the path. Path/query
    # case is left untouched since servers may treat them case-sensitively.
    default_port = 443 if parsed.scheme == "https" else 80
    netloc = hostname.lower()
    if parsed.port and parsed.port != default_port:
        netloc = f"{netloc}:{parsed.port}"

    path = parsed.path.rstrip("/")

    normalized = urlunparse(("https", netloc, path, parsed.params, parsed.query, parsed.fragment))
    return normalized
