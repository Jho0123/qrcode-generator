# Dynamic QR Code Generator

A small FastAPI service for generating dynamic QR codes — short links that
redirect through the server, so the destination can be changed, expired, or
deactivated after the code has already been printed or shared.

## Features

- Create a short link and QR code from any URL
- Update the destination at any time — the QR image and short link never change
- Optional expiration timestamps, enforced server-side
- Soft delete (deactivate a link without erasing its history)
- Per-link scan analytics — total scans and scans by day
- URL normalization and a domain blocklist
- Built-in web UI, served directly by the API — no separate frontend build step

## Tech stack

- **Backend:** FastAPI, SQLAlchemy, SQLite
- **QR generation:** `qrcode` + Pillow
- **Frontend:** vanilla HTML/CSS/JS, served as static files by FastAPI

## Getting started

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open [http://localhost:8000](http://localhost:8000).

### Running on your local network

To scan a generated QR code from a phone on the same Wi-Fi network, bind to
all interfaces and point `BASE_URL` at your machine's LAN IP:

```bash
BASE_URL="http://<your-lan-ip>:8000" uvicorn app.main:app --host 0.0.0.0 --reload
```

## How it works

- `POST /api/qr/create` generates a 7-character Base62 token (SHA-256 hash +
  collision retry against the database) and stores `{token -> url}` in SQLite.
- `GET /r/{token}` is the redirect endpoint. It checks an in-memory cache
  first, then falls back to SQLite — `302` on a hit, `404` if the token
  doesn't exist, `410` if the link is deleted or past its expiry — and logs
  the scan for analytics.
- `GET /api/qr/{token}/image` renders a QR code on the fly that encodes the
  **short link**, never the destination URL. That's what makes it dynamic:
  the destination can change without the printed code ever going stale.

## API reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/qr/create` | Create a short link and QR code |
| `GET` | `/api/qr/{token}` | Get link metadata |
| `PATCH` | `/api/qr/{token}` | Update the destination and/or expiry |
| `DELETE` | `/api/qr/{token}` | Soft-delete a link |
| `GET` | `/api/qr/{token}/image` | QR code image (PNG) |
| `GET` | `/api/qr/{token}/analytics` | Scan counts and scans by day |
| `GET` | `/r/{token}` | Redirect to the destination (`302`/`404`/`410`) |

## Project structure

```
app/
├── main.py            FastAPI app setup, static file mounting
├── routes.py          API endpoints
├── models.py          SQLAlchemy models
├── schemas.py         Request/response models
├── token_gen.py        Short token generation
├── url_validator.py   URL validation and normalization
├── database.py        DB engine and session setup
└── static/            Web UI (HTML/CSS/JS)
```
