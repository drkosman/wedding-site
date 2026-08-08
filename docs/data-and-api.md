# Data model and API

All routes below are mounted under `/api`. The implementation is in `backend/app/models.py` and `backend/app/routers/`.

## Domain model

```mermaid
erDiagram
    GUEST ||--o| RSVP : has
    GUEST {
        int id PK
        string name
        string email nullable
        string token UK
        boolean plus_one_allowed
        int max_guests
        boolean invite_sent
    }
    RSVP {
        int id PK
        int guest_id FK,UK
        boolean attending
        int guest_count
        boolean sunday_event
        boolean hotel_reservation_requested
        boolean friday_night
        boolean saturday_night
        boolean sunday_night
        string dietary_requirements nullable
        string message nullable
        datetime updated_at
    }
    CONTENT_ENTRY {
        int id PK
        string kind
        int sort_order
        string title
        string optional_display_fields
        datetime updated_at
    }
```

### Guest and RSVP

A `Guest` is an invitation/party record, not necessarily one individual attendee. Its unique token identifies the invitation. `plus_one_allowed` controls whether the public frontend shows the party-size field, while `max_guests` is the limit enforced by public and admin RSVP writes.

An `RSVP` is the latest response for one guest. The unique foreign key makes the relationship optional one-to-one. Submissions overwrite the response and `updated_at`; there is no audit/history table. Deleting a guest through the admin API explicitly deletes its RSVP first.

The backend validates `guest_count >= 1` and rejects counts above the associated guest's `max_guests`. It does not otherwise normalize related choices: declining guests can still have Sunday, hotel, room-night, dietary, or message values, and room-night flags are independent of the hotel-request flag.

`GuestRequest` does not currently enforce a positive `max_guests` or consistency between `plus_one_allowed` and `max_guests`. The admin UI maintains that consistency for normal interactive creation, but direct API and CSV clients must do so themselves.

### Content entries

`ContentEntry` stores one ordered item for `schedule`, `accommodation`, or `travel`. `title` is required and trimmed. Other display fields are optional; whitespace-only strings become `null`. `website_url`, used by accommodation entries, must be an absolute `http` or `https` URL.

The model is intentionally shared across content kinds, so not every column is rendered by every section. Public reads order items by `sort_order`, then `id`. Deletion compacts the remaining order. Reordering must provide every entry ID for that kind exactly once.

On database initialization, defaults are inserted only when a content kind has no existing row. Existing content is not overwritten.

## Public endpoints

| Method and path | Behavior |
| --- | --- |
| `GET /health` | Returns `{ "ok": true }`. Does not query the database. |
| `GET /guest/{token}` | Finds an invitation by token and returns guest display/capability fields plus the current RSVP, or `404`. The database ID, token, and invite-sent state are omitted. |
| `POST /rsvp/{token}` | Creates or replaces the current RSVP for the token. Returns `404` for an unknown token, `422` for schema validation failures, and `400` when `guest_count` exceeds `max_guests`. |
| `GET /content/{kind}` | Lists ordered public content. Unknown kinds return `404`. |

The RSVP request shape is:

```json
{
  "attending": true,
  "guest_count": 1,
  "sunday_event": false,
  "hotel_reservation_requested": false,
  "friday_night": false,
  "saturday_night": false,
  "sunday_night": false,
  "dietary_requirements": null,
  "message": null
}
```

Only `attending` is required; the other values shown are schema defaults or nullable fields.

## Admin authorization

Every `/admin/*` endpoint requires an `x-admin-secret` header matching `ADMIN_SECRET`. Comparison uses `hmac.compare_digest`. If the server has no `ADMIN_SECRET`, all admin requests fail. There are no scoped roles: a valid secret grants access to all admin operations, including personal data and destructive endpoints.

Do not put real secrets, personal tokens, guest data, exported CSV content, or invitation output in documentation or examples.

## Admin guest and RSVP endpoints

| Method and path | Behavior |
| --- | --- |
| `POST /admin/guest` | Creates a guest and generates a UUID token. Email is optional. |
| `GET /admin/guests` | Lists every guest joined to its optional RSVP, including personal tokens and response data. |
| `POST /admin/guests/bulk` | Creates guests from a UTF-8 multipart CSV upload named `file`. |
| `GET /admin/guests/export` | Downloads `guests.csv` with guest, token, invitation, and RSVP fields. Treat the file as sensitive. |
| `PATCH /admin/guest/{guest_id}/invite-sent` | Sets the invitation-sent tracking flag. |
| `PUT /admin/guest/{guest_id}/rsvp` | Creates or replaces a guest's current RSVP using the public RSVP request shape. |
| `DELETE /admin/guest/{guest_id}/rsvp` | Deletes the response but keeps the guest. |
| `DELETE /admin/guest/{guest_id}` | Deletes the guest and its response. |
| `GET /admin/summary` | Returns record counts for guests, RSVPs, attending/declining responses, Sunday responses, and hotel requests. |

Bulk import expects a `name` column. It optionally reads `email`, `plus_one_allowed`, and `max_guests`; `plus_one_allowed` is true only when the text equals `true` case-insensitively, and `max_guests` must parse as an integer. Import always creates new guests and tokens: it does not deduplicate, update records, import RSVPs, or import invitation-sent state.

Summary attendance, Sunday, and hotel figures count RSVP records, not the sum of party sizes.

## Admin content endpoints

For each supported `{kind}`:

| Method and path | Behavior |
| --- | --- |
| `GET /admin/content/{kind}` | Protected equivalent of the public ordered list. |
| `POST /admin/content/{kind}` | Creates an entry; omitted `sort_order` appends it. |
| `PUT /admin/content/{kind}/reorder` | Accepts `{ "ids": [...] }` containing the complete, unique ID set for the kind. |
| `PUT /admin/content/{kind}/{entry_id}` | Replaces the editable fields of an entry. |
| `DELETE /admin/content/{kind}/{entry_id}` | Deletes an entry and compacts the remaining order. |

## Schema setup and compatibility updates

There is no migration framework or version history. `backend/app/database.py` currently performs only these upgrades for existing tables:

- makes PostgreSQL `guest.email` nullable;
- adds/backfills/indexes `guest.token` and adds `guest.invite_sent`;
- adds `rsvp.guest_count`, Sunday/hotel/night flags;
- adds `contententry.sort_order`, `updated_at`, and optional text/display columns.

`create_all()` creates missing tables but does not alter arbitrary existing columns. Any future schema change outside this explicit list needs a deliberate migration or a new, safely repeatable compatibility step.

