# Data model and API

All routes below are mounted under `/api`. The implementation is in `backend/app/models.py` and `backend/app/routers/`.

## Domain model

```mermaid
erDiagram
    GUEST o|--o{ RSVP : "admin reconciles"
    GUEST {
        int id PK
        string name
        string email nullable
        int max_guests
        boolean invite_sent
    }
    RSVP {
        int id PK
        int guest_id FK nullable
        string submitted_name
        string email
        boolean attending
        int guest_count
        string additional_guest_names nullable
        boolean sunday_event
        boolean hotel_reservation_requested
        boolean friday_night
        boolean saturday_night
        boolean sunday_night
        string dietaries nullable
        string message nullable
        datetime created_at
        datetime updated_at
    }
    RSVP_RATE_LIMIT_EVENT {
        int id PK
        string client_fingerprint
        datetime created_at
    }
    CONTENT_ENTRY {
        int id PK
        string kind
        int sort_order
        string title
        string optional_display_fields
        datetime updated_at
    }
    HOMEPAGE_SECTION {
        int id PK
        string title
        string subtitle nullable
        string content
        int position
        int sort_order
        datetime created_at
        datetime updated_at
    }
```

### Guest and RSVP

`Guest` is a private paper-invitation/party record. It is never selected by a public endpoint. `email` is optional invitation metadata, `max_guests` is 1–12, and `invite_sent` tracks physical invitation delivery.

`RSVP` is one self-identifying public submission. `submitted_name` and normalized lowercase `email` are required contact snapshots. `guest_id` is nullable and can be set only through protected admin reconciliation. The relationship is many-to-one so duplicates remain visible. No uniqueness constraint exists on name, email, or `guest_id`.

Every public write inserts a record. It never updates based on name/email. Admins can edit or delete a specific record by database ID. A same-email count in the admin response is a duplicate-review signal only.

Public `guest_count` is restricted to 1–6. A declining response must use one and cannot contain Sunday, hotel, room-night, additional-guest, or dietary choices. Attending parties above one require additional guest names. Room nights require a hotel request, and a hotel request requires at least one selected night. The optional message remains available to declining guests.

Text limits are: name 160, email 254, additional guest names 600, dietary requirements 1,000, and message 2,000 characters. Optional text is trimmed and blank text becomes `null`. Unknown request fields are rejected.

### Rate-limit events

`RSVPRateLimitEvent` stores a 64-character HMAC client fingerprint and timestamp. It never stores the raw address. Each non-honeypot attempt is recorded before challenge verification. Events older than one day are removed during later attempts.

### Content entries

`ContentEntry` stores one ordered item for `schedule`, `accommodation`, or `travel`. `title` is required and trimmed. Other display fields are optional; whitespace-only strings become `null`. `website_url` must be an absolute `http` or `https` URL. Public reads order by `sort_order`, then `id`.

### Custom homepage sections

`HomepageSection` stores a reusable plain-text section for the public homepage. `title` and `content` are required and trimmed; a blank `subtitle` becomes `null`. Limits are 160 characters for title, 300 for subtitle, and 10,000 for content. Unknown request fields are rejected.

`position` is a required integer from 0 through 6 identifying a gap in the fixed homepage composition: after the hero, then after Wedding Details, RSVP, the map, Schedule, Accommodation, or Getting There & Away. `sort_order` orders multiple custom sections within one position, with `id` as the deterministic tie-breaker. Creation appends within the chosen position; moving to another position appends there; reorder and delete operations compact the affected order.

## Public endpoints

| Method and path | Behavior |
| --- | --- |
| `GET /health` | Returns `{ "ok": true }` without querying the database. |
| `POST /rsvps` | Verifies abuse controls, creates a new unmatched RSVP, then independently attempts the admin notification and guest confirmation. Returns `201` with a generic status even if either post-commit email fails. |
| `GET /content/{kind}` | Lists ordered public content. Unknown kinds return `404`. |
| `GET /homepage-sections` | Lists custom homepage sections by `position`, `sort_order`, then `id`. Timestamps are omitted. |

There is no public guest or RSVP read/search endpoint.

Every successful public insert is a new submission and, when configured, gets a “New RSVP” admin notification plus a “received” confirmation sent to the persisted RSVP email. Same-name or same-email repeats are not updates and notify separately. The admin notification deliberately omits the submitter's email, additional guest names, dietary information, message, and other detailed fields; the admin page remains canonical for Lucy and Kosta.

The guest confirmation returns the applicable persisted RSVP summary to its own submitted address. With the public party-size and hotel controls currently hidden, their stored default values are not displayed in email. Attending copies contain Sunday attendance, dietary requirements, and comment; declining copies omit attendance-dependent fields and can contain the comment. HTML values are escaped and a matching plain-text part is always supplied.

The RSVP request shape is:

```json
{
  "full_name": "Example Guest",
  "email": "guest@example.com",
  "attending": true,
  "guest_count": 2,
  "additional_guest_names": "Second Guest",
  "sunday_event": true,
  "hotel_reservation_requested": true,
  "friday_night": false,
  "saturday_night": true,
  "sunday_night": false,
  "dietaries": "Vegetarian",
  "message": "Looking forward to it",
  "website": "",
  "turnstile_token": "challenge-result"
}
```

`website` is the hidden honeypot and must stay empty for genuine visitors. `turnstile_token` is produced by the public widget and is always verified by the backend. Failed verification returns `400`, rate limiting returns `429`, schema failures return `422`, and missing backend protection configuration fails closed. Client-facing errors intentionally omit internal verification details.

## Admin authorization

Every `/admin/*` endpoint requires an `x-admin-secret` header matching `ADMIN_SECRET` using constant-time comparison. If the server has no admin secret, all admin requests fail. A valid secret grants all current admin capabilities, so responses and CSVs must be treated as sensitive.

## Admin invitation and RSVP endpoints

| Method and path | Behavior |
| --- | --- |
| `POST /admin/guest` | Creates a paper-invitation record. |
| `GET /admin/guests` | Lists invitation records with matched RSVP counts. |
| `POST /admin/guests/bulk` | Imports UTF-8 CSV invitation rows. |
| `GET /admin/guests/export` | Exports the private invitation list. |
| `PATCH /admin/guest/{guest_id}/invite-sent` | Updates physical invitation delivery tracking. |
| `DELETE /admin/guest/{guest_id}` | Deletes an invitation and unmatches, but preserves, linked RSVPs. |
| `GET /admin/rsvps` | Lists every response, contact field, event choice, timestamp, match, and same-email count. |
| `GET /admin/rsvps/export` | Exports all RSVP and reconciliation fields. |
| `PUT /admin/rsvp/{rsvp_id}` | Validates and updates a specific response, then attempts an “updated” confirmation to the final persisted email. Email failure does not change the update response. |
| `PATCH /admin/rsvp/{rsvp_id}/reconcile` | Matches/unmatches a response. Matching enforces that invitation's `max_guests`. |
| `DELETE /admin/rsvp/{rsvp_id}` | Deletes a specific response. |
| `GET /admin/summary` | Returns invitation, RSVP, matched/unmatched, attendance, Sunday, and hotel counts. |

Bulk invitation import requires `name`; `email` and `max_guests` are optional. Rows are validated through `GuestRequest`. Import creates records without deduplicating or changing RSVP data.

Summary figures count RSVP records, not party-size totals. Because repeats are separate records, totals may exceed invitation counts until administrators reconcile/delete confirmed duplicates.

## Admin content endpoints

For each supported `{kind}`:

| Method and path | Behavior |
| --- | --- |
| `GET /admin/content/{kind}` | Protected equivalent of the public ordered list. |
| `POST /admin/content/{kind}` | Creates an entry; omitted `sort_order` appends it. |
| `PUT /admin/content/{kind}/reorder` | Accepts `{ "ids": [...] }` containing the complete, unique ID set. |
| `PUT /admin/content/{kind}/{entry_id}` | Replaces editable fields. |
| `DELETE /admin/content/{kind}/{entry_id}` | Deletes an entry and compacts order. |

Custom homepage sections use these protected endpoints:

| Method and path | Behavior |
| --- | --- |
| `GET /admin/homepage-sections` | Lists every custom section in homepage order, including timestamps. |
| `POST /admin/homepage-sections` | Creates and appends a section at its required `position`. |
| `PUT /admin/homepage-sections/reorder` | Accepts `{ "position": 2, "ids": [...] }` containing every unique section ID at that position. |
| `PUT /admin/homepage-sections/{section_id}` | Replaces title, optional subtitle, content, and position. |
| `DELETE /admin/homepage-sections/{section_id}` | Deletes a section and compacts its former position. |

## Schema migration and startup

Startup first creates missing tables, then runs the versioned migrations in `backend/migrations/versions/`, including the public RSVP, homepage section, and RSVP dietaries migrations. Applied versions are recorded once in `schema_migration`. For legacy databases, the first migration:

- preserves invitation rows while removing obsolete invitation credential and plus-one columns;
- preserves RSVP rows, copying invitation name/email into submitted contact fields where needed;
- makes `rsvp.guest_id` nullable and removes its uniqueness constraint;
- adds submitted identity, additional guest names, and creation timestamp columns;
- creates the indexes required by the new model.

SQLite rebuilds the two related tables transactionally with foreign keys temporarily disabled. PostgreSQL applies explicit alterations and removes the legacy unique constraint by inspection. The second migration creates `homepagesection` and its ordering indexes for existing databases. The third adds the nullable `rsvp.dietaries` column and removes the obsolete dietary column. The migrations are repeatable and tested. The old additive RSVP/content compatibility functions remain only for earlier non-token column versions; `create_all()` alone never alters existing schemas.
