import { Fragment, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  adminApi,
  adminHeaders,
  clearAdminSecret,
  getStoredAdminSecret,
  storeAdminSecret,
} from '../api/adminClient';
import ContentManager from '../components/admin/ContentManager';

type AdminSummary = {
  total_guests: number;
  total_rsvps: number;
  attending: number;
  not_attending: number;
  sunday_event: number;
  hotel_reservation_requests: number;
};

type GuestRow = {
  id: number;
  name: string;
  email?: string | null;
  token?: string | null;
  plus_one_allowed: boolean;
  max_guests: number;
  invite_sent: boolean;
  attending?: boolean | null;
  guest_count?: number | null;
  sunday_event?: boolean | null;
  hotel_reservation_requested?: boolean | null;
  friday_night?: boolean | null;
  saturday_night?: boolean | null;
  sunday_night?: boolean | null;
  dietary_requirements?: string | null;
  message?: string | null;
  updated_at?: string | null;
};

type NewGuestForm = {
  name: string;
  email: string;
  plus_one_allowed: boolean;
  max_guests: number;
};

type GuestEmail = {
  subject: string;
  text: string;
  html: string;
};

type EditableRsvpForm = {
  attending: 'yes' | 'no';
  guest_count: number;
  sunday_event: 'yes' | 'no';
  hotel_reservation_requested: boolean;
  friday_night: boolean;
  saturday_night: boolean;
  sunday_night: boolean;
  dietary_requirements: string;
  message: string;
};

const WEDDING_DATE = 'Saturday, 1 May 2027';
const WEDDING_LOCATION = 'Barnacarry Bay, Scotland';
const EMAIL_PHOTO_PATHS = {
  hero: '/email-photos/lucyandkosta.jpeg',
  location: '/email-photos/barnacarry.jpeg',
};

const scheduleFields = [
  { key: 'date' as const, label: 'Date / Day', placeholder: 'Saturday' },
  { key: 'time' as const, label: 'Time', placeholder: '3:00 PM' },
  { key: 'title' as const, label: 'Title', placeholder: 'Ceremony' },
  { key: 'location' as const, label: 'Location', placeholder: "St John's Cathedral" },
  { key: 'description' as const, label: 'Description', type: 'textarea' as const },
  { key: 'notes' as const, label: 'Notes', type: 'textarea' as const },
];

const accommodationFields = [
  { key: 'title' as const, label: 'Name', placeholder: 'Hotel name' },
  { key: 'website_url' as const, label: 'Website URL', type: 'url' as const },
  { key: 'address' as const, label: 'Address' },
  { key: 'price_notes' as const, label: 'Price / Rate Notes' },
  { key: 'distance' as const, label: 'Distance' },
  { key: 'notes' as const, label: 'Label / Notes', placeholder: 'Nearest town' },
  { key: 'description' as const, label: 'Description', type: 'textarea' as const },
];

const travelFields = [
  { key: 'title' as const, label: 'Title', placeholder: 'By train' },
  { key: 'description' as const, label: 'Description', type: 'textarea' as const },
];

function formatBoolean(value?: boolean | null) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Pending';
}

function formatDate(value?: string | null) {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getRsvpLink(token?: string | null) {
  if (!token) return null;
  return `${window.location.origin}/?token=${encodeURIComponent(token)}`;
}

function getAssetUrl(path: string) {
  return `${window.location.origin}${path}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function buildGuestEmail(guest: GuestRow): GuestEmail {
  const link = getRsvpLink(guest.token);

  if (!link) {
    throw new Error(`Guest ${guest.id} is missing a personal RSVP token.`);
  }

  const firstName = getFirstName(guest.name);
  const escapedFirstName = escapeHtml(firstName);
  const escapedLink = escapeHtml(link);
  const heroPhotoUrl = escapeHtml(getAssetUrl(EMAIL_PHOTO_PATHS.hero));
  const locationPhotoUrl = escapeHtml(getAssetUrl(EMAIL_PHOTO_PATHS.location));
  const subject = 'Lucy & Kosta: Wedding RSVP';
  const text = [
    `Hi ${firstName},`,
    '',
    'We would love for you to join us as we celebrate our wedding.',
    '',
    `${WEDDING_DATE}`,
    `${WEDDING_LOCATION}`,
    '',
    `Please RSVP using your personal link: ${link}`,
    '',
    'With love,',
    'Lucy & Kosta',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f0f1f7;color:#2b2f38;font-family:Georgia,'Times New Roman',serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Your personal RSVP link for Lucy and Kosta's wedding at Barnacarry Bay.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f0f1f7;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:640px;background:#ffffff;border:1px solid #e5e7eb;">
            <tr>
              <td>
                <img src="${heroPhotoUrl}" width="640" alt="Lucy and Kosta" style="display:block;width:100%;max-width:640px;height:auto;border:0;">
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:40px 34px 28px;">
                <p style="margin:0 0 12px;color:#608296;font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Wedding Invitation</p>
                <h1 style="margin:0;color:#2b2f38;font-size:38px;line-height:1.15;font-weight:400;">Lucy &amp; Kosta</h1>
                <p style="margin:18px 0 0;color:#6b7280;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;">${escapeHtml(WEDDING_DATE)}<br>${escapeHtml(WEDDING_LOCATION)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 34px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="border-top:1px solid #e5e7eb;line-height:1px;font-size:1px;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 34px 10px;">
                <p style="margin:0 0 18px;color:#2b2f38;font-family:Arial,sans-serif;font-size:17px;line-height:1.75;">Hi ${escapedFirstName},</p>
                <p style="margin:0 0 18px;color:#2b2f38;font-family:Arial,sans-serif;font-size:17px;line-height:1.75;">We would love for you to join us as we celebrate our wedding on the west coast of Scotland.</p>
                <p style="margin:0;color:#2b2f38;font-family:Arial,sans-serif;font-size:17px;line-height:1.75;">The ceremony will be happening in <strong>Oban, Scotland</strong>, followed by drinks, dinner, and dancing by the bay.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 34px;">
                <img src="${locationPhotoUrl}" width="572" alt="Barnacarry Bay" style="display:block;width:100%;max-width:572px;height:auto;border:0;">
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 34px 36px;">
                <p style="margin:0 0 22px;color:#6b7280;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;">Please RSVP through your personal link so we can confirm your details.</p>
                <a href="${escapedLink}" style="display:inline-block;background:#608296;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:.3px;padding:14px 24px;border-radius:4px;">RSVP Here</a>
                <p style="margin:24px 0 0;color:#6b7280;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;">If the button does not work, copy this link:<br><a href="${escapedLink}" style="color:#608296;text-decoration:underline;">${escapedLink}</a></p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 34px 38px;background:#f6e7d7;">
                <p style="margin:0;color:#2b2f38;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;">With love,<br><strong>Lucy &amp; Kosta</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createEmailExport(guest: GuestRow) {
  const email = buildGuestEmail(guest);

  return [
    `<!-- To: ${escapeHtml(guest.email || 'No email on file')} -->`,
    `<!-- Subject: ${escapeHtml(email.subject)} -->`,
    email.html,
  ].join('\n');
}

function createRsvpDraft(guest: GuestRow): EditableRsvpForm {
  return {
    attending: guest.attending === false ? 'no' : 'yes',
    guest_count: guest.guest_count ?? 1,
    sunday_event: guest.sunday_event ? 'yes' : 'no',
    hotel_reservation_requested: guest.hotel_reservation_requested ?? false,
    friday_night: guest.friday_night ?? false,
    saturday_night: guest.saturday_night ?? false,
    sunday_night: guest.sunday_night ?? false,
    dietary_requirements: guest.dietary_requirements ?? '',
    message: guest.message ?? '',
  };
}

export default function Admin() {
  const [secret, setSecret] = useState(() => getStoredAdminSecret());
  const [secretInput, setSecretInput] = useState('');
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(Boolean(secret));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatingInviteSentIds, setUpdatingInviteSentIds] = useState<Set<number>>(() => new Set());
  const [editingGuestId, setEditingGuestId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditableRsvpForm | null>(null);
  const [savingRsvpId, setSavingRsvpId] = useState<number | null>(null);
  const [clearingRsvpId, setClearingRsvpId] = useState<number | null>(null);
  const [deletingGuestId, setDeletingGuestId] = useState<number | null>(null);
  const [newGuest, setNewGuest] = useState<NewGuestForm>({
    name: '',
    email: '',
    plus_one_allowed: false,
    max_guests: 1,
  });
  const [addingGuest, setAddingGuest] = useState(false);

  const responseRate = useMemo(() => {
    if (!summary?.total_guests) return '0%';
    return `${Math.round((summary.total_rsvps / summary.total_guests) * 100)}%`;
  }, [summary]);

  const inviteSentCount = useMemo(
    () => guests.filter((guest) => guest.invite_sent).length,
    [guests],
  );

  useEffect(() => {
    if (!secret) return;

    Promise.all([
      adminApi.get<AdminSummary>('/summary', { headers: adminHeaders(secret) }),
      adminApi.get<GuestRow[]>('/guests', { headers: adminHeaders(secret) }),
    ])
      .then(([summaryResponse, guestsResponse]) => {
        setSummary(summaryResponse.data);
        setGuests(guestsResponse.data);
      })
      .catch(() => {
        clearAdminSecret();
        setSecret('');
        setSummary(null);
        setGuests([]);
        setError('Admin access failed. Check the secret and try again.');
      })
      .finally(() => setLoading(false));
  }, [secret]);

  const refreshDashboard = async () => {
    const [summaryResponse, guestsResponse] = await Promise.all([
      adminApi.get<AdminSummary>('/summary', { headers: adminHeaders(secret) }),
      adminApi.get<GuestRow[]>('/guests', { headers: adminHeaders(secret) }),
    ]);

    setSummary(summaryResponse.data);
    setGuests(guestsResponse.data);
  };

  const handleUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedSecret = secretInput.trim();
    if (!trimmedSecret) return;

    setError(null);
    setNotice(null);
    setLoading(true);
    storeAdminSecret(trimmedSecret);
    setSecret(trimmedSecret);
    setSecretInput('');
  };

  const handleLogout = () => {
    clearAdminSecret();
    setSecret('');
    setSummary(null);
    setGuests([]);
    setEditingGuestId(null);
    setEditForm(null);
    setNotice(null);
    setError(null);
  };

  const handleAddGuest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newGuest.name.trim();
    const email = newGuest.email.trim();

    if (!name) {
      setError('Guest name is required.');
      return;
    }

    setAddingGuest(true);
    setError(null);
    setNotice(null);

    try {
      await adminApi.post(
        '/guest',
        {
          name,
          email: email || null,
          plus_one_allowed: newGuest.plus_one_allowed,
          max_guests: newGuest.max_guests,
        },
        { headers: adminHeaders(secret) },
      );
      await refreshDashboard();
      setNewGuest({
        name: '',
        email: '',
        plus_one_allowed: false,
        max_guests: 1,
      });
      setNotice(`${name} was added to the guest list.`);
    } catch {
      setError('Guest could not be added. Please check the details and try again.');
    } finally {
      setAddingGuest(false);
    }
  };

  const handleDownloadCsv = async () => {
    setError(null);

    try {
      const response = await adminApi.get('/guests/export', {
        headers: adminHeaders(secret),
        responseType: 'blob',
      });

      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'wedding-guests.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('CSV export failed. Please try again.');
    }
  };

  const handleInviteSentChange = async (guest: GuestRow, inviteSent: boolean) => {
    setError(null);
    setNotice(null);
    setUpdatingInviteSentIds((current) => new Set(current).add(guest.id));
    setGuests((currentGuests) =>
      currentGuests.map((currentGuest) =>
        currentGuest.id === guest.id ? { ...currentGuest, invite_sent: inviteSent } : currentGuest,
      ),
    );

    try {
      await adminApi.patch(
        `/guest/${guest.id}/invite-sent`,
        { invite_sent: inviteSent },
        { headers: adminHeaders(secret) },
      );
    } catch {
      setGuests((currentGuests) =>
        currentGuests.map((currentGuest) =>
          currentGuest.id === guest.id
            ? { ...currentGuest, invite_sent: guest.invite_sent }
            : currentGuest,
        ),
      );
      setError(`Invite sent status could not be saved for ${guest.name}.`);
    } finally {
      setUpdatingInviteSentIds((current) => {
        const nextIds = new Set(current);
        nextIds.delete(guest.id);
        return nextIds;
      });
    }
  };

  const handleCopyGuestEmail = async (guest: GuestRow) => {
    setError(null);
    setNotice(null);

    try {
      const email = buildGuestEmail(guest);

      try {
        if ('ClipboardItem' in window && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([email.html], { type: 'text/html' }),
              'text/plain': new Blob([email.text], { type: 'text/plain' }),
            }),
          ]);
        } else {
          await navigator.clipboard.writeText(email.text);
        }
      } catch {
        downloadFile(
          `${guest.name.toLowerCase().replaceAll(' ', '-')}-email.html`,
          createEmailExport(guest),
          'text/html;charset=utf-8',
        );
        setNotice(`Clipboard was unavailable, so ${guest.name}'s email was downloaded.`);
        return;
      }

      setNotice(`HTML email copied for ${guest.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email template could not be created.');
    }
  };

  const handleDownloadGuestEmail = (guest: GuestRow) => {
    try {
      setError(null);
      downloadFile(
        `${guest.name.toLowerCase().replaceAll(' ', '-')}-email.html`,
        createEmailExport(guest),
        'text/html;charset=utf-8',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email template could not be created.');
    }
  };

  const handleDownloadBulkEmails = () => {
    if (!guests.length) {
      setError('No guests are available for email export yet.');
      return;
    }

    try {
      const content = guests
        .map((guest) => createEmailExport(guest))
        .join('\n\n<!-- Next guest email -->\n\n');

      setError(null);
      setNotice(`Exported ${guests.length} guest HTML emails.`);
      downloadFile('guest-email-templates.html', content, 'text/html;charset=utf-8');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email templates could not be created.');
    }
  };

  const handleEditGuest = (guest: GuestRow) => {
    setError(null);
    setNotice(null);

    if (editingGuestId === guest.id) {
      setEditingGuestId(null);
      setEditForm(null);
      return;
    }

    setEditingGuestId(guest.id);
    setEditForm(createRsvpDraft(guest));
  };

  const handleSaveRsvp = async (guest: GuestRow) => {
    if (!editForm) return;

    const guestCount = Math.max(1, Math.min(guest.max_guests, Number(editForm.guest_count) || 1));

    if (guestCount > guest.max_guests) {
      setError(`${guest.name} cannot exceed a party size of ${guest.max_guests}.`);
      return;
    }

    setSavingRsvpId(guest.id);
    setError(null);
    setNotice(null);

    try {
      await adminApi.put(
        `/guest/${guest.id}/rsvp`,
        {
          attending: editForm.attending === 'yes',
          guest_count: guestCount,
          sunday_event: editForm.sunday_event === 'yes',
          hotel_reservation_requested: editForm.hotel_reservation_requested,
          friday_night: editForm.friday_night,
          saturday_night: editForm.saturday_night,
          sunday_night: editForm.sunday_night,
          dietary_requirements: editForm.dietary_requirements.trim() || null,
          message: editForm.message.trim() || null,
        },
        { headers: adminHeaders(secret) },
      );
      await refreshDashboard();
      setEditingGuestId(null);
      setEditForm(null);
      setNotice(`Saved RSVP changes for ${guest.name}.`);
    } catch (err: unknown) {
      const message =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof err.response === 'object' &&
        err.response !== null &&
        'data' in err.response &&
        typeof err.response.data === 'object' &&
        err.response.data !== null &&
        'detail' in err.response.data &&
        typeof err.response.data.detail === 'string'
          ? err.response.data.detail
          : `RSVP changes could not be saved for ${guest.name}.`;
      setError(message);
    } finally {
      setSavingRsvpId(null);
    }
  };

  const handleClearRsvp = async (guest: GuestRow) => {
    if (!guest.updated_at && guest.attending == null) {
      setError(`${guest.name} does not have an RSVP to clear.`);
      return;
    }

    if (!window.confirm(`Clear ${guest.name}'s RSVP but keep them on the guest list?`)) {
      return;
    }

    setClearingRsvpId(guest.id);
    setError(null);
    setNotice(null);

    try {
      await adminApi.delete(`/guest/${guest.id}/rsvp`, {
        headers: adminHeaders(secret),
      });
      await refreshDashboard();
      if (editingGuestId === guest.id) {
        setEditForm(
          createRsvpDraft({
            ...guest,
            attending: null,
            guest_count: null,
            sunday_event: null,
            hotel_reservation_requested: null,
            friday_night: null,
            saturday_night: null,
            sunday_night: null,
            dietary_requirements: null,
            message: null,
          }),
        );
      }
      setNotice(`Cleared RSVP for ${guest.name}.`);
    } catch {
      setError(`RSVP could not be cleared for ${guest.name}.`);
    } finally {
      setClearingRsvpId(null);
    }
  };

  const handleDeleteGuest = async (guest: GuestRow) => {
    if (!window.confirm(`Delete ${guest.name} and their RSVP permanently?`)) {
      return;
    }

    setDeletingGuestId(guest.id);
    setError(null);
    setNotice(null);

    try {
      await adminApi.delete(`/guest/${guest.id}`, {
        headers: adminHeaders(secret),
      });
      await refreshDashboard();
      if (editingGuestId === guest.id) {
        setEditingGuestId(null);
        setEditForm(null);
      }
      setNotice(`Deleted ${guest.name} from the guest list.`);
    } catch {
      setError(`${guest.name} could not be deleted.`);
    } finally {
      setDeletingGuestId(null);
    }
  };

  if (!secret) {
    return (
      <main className="min-h-screen bg-secondary px-6 py-16">
        <form onSubmit={handleUnlock} className="card mx-auto max-w-md space-y-6">
          <div>
            <h1 className="text-3xl font-semibold">Admin</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the admin secret to view guest responses.
            </p>
          </div>

          <div className="form-group">
            <label className="label" htmlFor="admin-secret">
              Admin secret
            </label>
            <input
              id="admin-secret"
              type="password"
              value={secretInput}
              onChange={(event) => setSecretInput(event.target.value)}
              className="input"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button type="submit" className="btn btn-primary w-full">
            Unlock Dashboard
          </button>
        </form>
      </main>
    );
  }

  return (
    <>
      {secret && (
        <main className="min-h-screen bg-secondary px-4 py-8 md:px-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-semibold">Wedding Admin</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Guest list, RSVP status, hotel requests, and exports.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="btn btn-primary"
                  disabled={loading}
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={handleDownloadBulkEmails}
                  className="btn btn-secondary"
                  disabled={loading || guests.length === 0}
                >
                  Export All Emails
                </button>
                <button type="button" onClick={handleLogout} className="btn btn-secondary">
                  Lock
                </button>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
              {[
                ['Guests', summary?.total_guests ?? 0],
                ['Invites Sent', inviteSentCount],
                ['RSVPs', summary?.total_rsvps ?? 0],
                ['Response Rate', responseRate],
                ['Attending', summary?.attending ?? 0],
                ['Sunday Event', summary?.sunday_event ?? 0],
                ['Hotel Requests', summary?.hotel_reservation_requests ?? 0],
              ].map(([label, value]) => (
                <article key={label} className="card-soft">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
                </article>
              ))}
            </section>

            {error && <p className="card border-red-200 text-sm text-red-700">{error}</p>}
            {notice && <p className="card border-green-200 text-sm text-green-700">{notice}</p>}

            <div className="grid gap-8 xl:grid-cols-2">
              <ContentManager
                secret={secret}
                kind="schedule"
                title="Schedule Content"
                fields={scheduleFields}
              />
              <ContentManager
                secret={secret}
                kind="accommodation"
                title="Accommodation Content"
                fields={accommodationFields}
              />
            </div>

            <ContentManager
              secret={secret}
              kind="travel"
              title="Travel Content"
              fields={travelFields}
            />

            <section className="card">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">Add Guest</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a guest record and generate their personal RSVP link automatically.
                </p>
              </div>

              <form onSubmit={handleAddGuest} className="grid gap-4 md:grid-cols-12 md:items-end">
                <div className="form-group md:col-span-4">
                  <label className="label" htmlFor="guest-name">
                    Name
                  </label>
                  <input
                    id="guest-name"
                    type="text"
                    value={newGuest.name}
                    onChange={(event) =>
                      setNewGuest((current) => ({ ...current, name: event.target.value }))
                    }
                    className="input"
                    autoComplete="name"
                  />
                </div>

                <div className="form-group md:col-span-4">
                  <label className="label" htmlFor="guest-email">
                    Email
                  </label>
                  <input
                    id="guest-email"
                    type="email"
                    value={newGuest.email}
                    onChange={(event) =>
                      setNewGuest((current) => ({ ...current, email: event.target.value }))
                    }
                    className="input"
                    autoComplete="email"
                  />
                </div>

                <div className="form-group md:col-span-2">
                  <label className="label" htmlFor="guest-max-guests">
                    Party size
                  </label>
                  <input
                    id="guest-max-guests"
                    type="number"
                    min="1"
                    max="12"
                    value={newGuest.max_guests}
                    onChange={(event) => {
                      const maxGuests = Math.max(1, Number(event.target.value) || 1);
                      setNewGuest((current) => ({
                        ...current,
                        max_guests: maxGuests,
                        plus_one_allowed: maxGuests > 1,
                      }));
                    }}
                    className="input"
                  />
                </div>

                <label className="flex min-h-11 items-center gap-3 text-sm font-medium md:col-span-1">
                  <input
                    type="checkbox"
                    checked={newGuest.plus_one_allowed}
                    onChange={(event) =>
                      setNewGuest((current) => ({
                        ...current,
                        plus_one_allowed: event.target.checked,
                        max_guests: event.target.checked ? Math.max(current.max_guests, 2) : 1,
                      }))
                    }
                  />
                  Plus one
                </label>

                <button
                  type="submit"
                  className="btn btn-primary md:col-span-1"
                  disabled={addingGuest}
                >
                  {addingGuest ? 'Adding...' : 'Add'}
                </button>
              </form>
            </section>

            <section className="card overflow-hidden p-0">
              <div className="border-b border-[var(--color-border)] p-5">
                <h2 className="text-xl font-semibold">Guests & Responses</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loading ? 'Loading responses...' : `${guests.length} guests loaded`}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Guest</th>
                      <th className="px-4 py-3">Invite Sent</th>
                      <th className="px-4 py-3">RSVP</th>
                      <th className="px-4 py-3">Party</th>
                      <th className="px-4 py-3">Sunday</th>
                      <th className="px-4 py-3">Hotel</th>
                      <th className="px-4 py-3">Nights</th>
                      <th className="px-4 py-3">Dietary</th>
                      <th className="px-4 py-3">Message</th>
                      <th className="px-4 py-3">Updated</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {guests.map((guest) => {
                      const isEditing = editingGuestId === guest.id;
                      const isSaving = savingRsvpId === guest.id;
                      const isClearing = clearingRsvpId === guest.id;
                      const isDeleting = deletingGuestId === guest.id;

                      return (
                        <Fragment key={guest.id}>
                          <tr key={guest.id} className="align-top">
                            <td className="px-4 py-4">
                              <span className="block font-medium">{guest.name}</span>
                              <span className="block text-muted-foreground">
                                {guest.email ?? 'No email'}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={guest.invite_sent}
                                  disabled={updatingInviteSentIds.has(guest.id)}
                                  onChange={(event) =>
                                    handleInviteSentChange(guest, event.target.checked)
                                  }
                                />
                                <span>{guest.invite_sent ? 'Sent' : 'Not sent'}</span>
                              </label>
                            </td>
                            <td className="px-4 py-4">{formatBoolean(guest.attending)}</td>
                            <td className="px-4 py-4">
                              {guest.guest_count ?? 'Pending'} / {guest.max_guests}
                            </td>
                            <td className="px-4 py-4">{formatBoolean(guest.sunday_event)}</td>
                            <td className="px-4 py-4">
                              {formatBoolean(guest.hotel_reservation_requested)}
                            </td>
                            <td className="px-4 py-4">
                              {[
                                guest.friday_night && 'Fri',
                                guest.saturday_night && 'Sat',
                                guest.sunday_night && 'Sun',
                              ]
                                .filter(Boolean)
                                .join(', ') || 'None'}
                            </td>
                            <td className="max-w-xs px-4 py-4">
                              {guest.dietary_requirements || 'None'}
                            </td>
                            <td className="max-w-xs px-4 py-4">{guest.message || 'None'}</td>
                            <td className="px-4 py-4">{formatDate(guest.updated_at)}</td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCopyGuestEmail(guest)}
                                  className="btn btn-secondary whitespace-nowrap px-3 py-2"
                                >
                                  Copy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadGuestEmail(guest)}
                                  className="btn btn-outline whitespace-nowrap px-3 py-2"
                                >
                                  Export
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex min-w-40 flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditGuest(guest)}
                                  className="btn btn-secondary whitespace-nowrap px-3 py-2"
                                  disabled={isDeleting}
                                >
                                  {isEditing ? 'Close Editor' : 'Edit RSVP'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleClearRsvp(guest)}
                                  className="btn btn-outline whitespace-nowrap px-3 py-2"
                                  disabled={isSaving || isClearing || isDeleting}
                                >
                                  {isClearing ? 'Clearing...' : 'Clear RSVP'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGuest(guest)}
                                  className="btn whitespace-nowrap border border-red-200 bg-red-50 px-3 py-2 text-red-700 hover:bg-red-100"
                                  disabled={isSaving || isClearing || isDeleting}
                                >
                                  {isDeleting ? 'Deleting...' : 'Delete Guest'}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isEditing && editForm && (
                            <tr className="bg-muted/30">
                              <td className="px-4 py-5" colSpan={12}>
                                <div className="space-y-4">
                                  <div>
                                    <h3 className="text-base font-semibold">
                                      Edit RSVP for {guest.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      Update their RSVP manually or clear it if you need to start
                                      over.
                                    </p>
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="form-group">
                                      <label className="label">Attending</label>
                                      <select
                                        value={editForm.attending}
                                        onChange={(event) =>
                                          setEditForm((current) =>
                                            current
                                              ? {
                                                  ...current,
                                                  attending: event.target.value as 'yes' | 'no',
                                                }
                                              : current,
                                          )
                                        }
                                        className="input"
                                      >
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                      </select>
                                    </div>

                                    <div className="form-group">
                                      <label className="label">Party Size</label>
                                      <input
                                        type="number"
                                        min="1"
                                        max={guest.max_guests}
                                        value={editForm.guest_count}
                                        onChange={(event) =>
                                          setEditForm((current) =>
                                            current
                                              ? {
                                                  ...current,
                                                  guest_count: Math.max(
                                                    1,
                                                    Number(event.target.value) || 1,
                                                  ),
                                                }
                                              : current,
                                          )
                                        }
                                        className="input"
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        Max allowed: {guest.max_guests}
                                      </p>
                                    </div>

                                    <div className="form-group">
                                      <label className="label">Sunday Event</label>
                                      <select
                                        value={editForm.sunday_event}
                                        onChange={(event) =>
                                          setEditForm((current) =>
                                            current
                                              ? {
                                                  ...current,
                                                  sunday_event: event.target.value as 'yes' | 'no',
                                                }
                                              : current,
                                          )
                                        }
                                        className="input"
                                      >
                                        <option value="no">No</option>
                                        <option value="yes">Yes</option>
                                      </select>
                                    </div>

                                    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                                      <input
                                        type="checkbox"
                                        checked={editForm.hotel_reservation_requested}
                                        onChange={(event) =>
                                          setEditForm((current) =>
                                            current
                                              ? {
                                                  ...current,
                                                  hotel_reservation_requested: event.target.checked,
                                                }
                                              : current,
                                          )
                                        }
                                      />
                                      Hotel requested
                                    </label>

                                    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                                      <input
                                        type="checkbox"
                                        checked={editForm.friday_night}
                                        onChange={(event) =>
                                          setEditForm((current) =>
                                            current
                                              ? { ...current, friday_night: event.target.checked }
                                              : current,
                                          )
                                        }
                                      />
                                      Friday night
                                    </label>

                                    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                                      <input
                                        type="checkbox"
                                        checked={editForm.saturday_night}
                                        onChange={(event) =>
                                          setEditForm((current) =>
                                            current
                                              ? { ...current, saturday_night: event.target.checked }
                                              : current,
                                          )
                                        }
                                      />
                                      Saturday night
                                    </label>

                                    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                                      <input
                                        type="checkbox"
                                        checked={editForm.sunday_night}
                                        onChange={(event) =>
                                          setEditForm((current) =>
                                            current
                                              ? { ...current, sunday_night: event.target.checked }
                                              : current,
                                          )
                                        }
                                      />
                                      Sunday night
                                    </label>
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div className="form-group">
                                      <label className="label">Dietary Requirements</label>
                                      <textarea
                                        value={editForm.dietary_requirements}
                                        onChange={(event) =>
                                          setEditForm((current) =>
                                            current
                                              ? {
                                                  ...current,
                                                  dietary_requirements: event.target.value,
                                                }
                                              : current,
                                          )
                                        }
                                        className="input min-h-24"
                                      />
                                    </div>

                                    <div className="form-group">
                                      <label className="label">Message</label>
                                      <textarea
                                        value={editForm.message}
                                        onChange={(event) =>
                                          setEditForm((current) =>
                                            current
                                              ? { ...current, message: event.target.value }
                                              : current,
                                          )
                                        }
                                        className="input min-h-24"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-3">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveRsvp(guest)}
                                      className="btn btn-primary"
                                      disabled={isSaving || isClearing || isDeleting}
                                    >
                                      {isSaving ? 'Saving...' : 'Save RSVP'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingGuestId(null);
                                        setEditForm(null);
                                      }}
                                      className="btn btn-secondary"
                                      disabled={isSaving}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
      )}
    </>
  );
}
