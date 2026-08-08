import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

import {
  adminApi,
  adminHeaders,
  clearAdminSecret,
  getStoredAdminSecret,
  storeAdminSecret,
} from '../api/adminClient';
import ContentManager from '../components/admin/ContentManager';
import HomepageSectionManager from '../components/admin/HomepageSectionManager';


type AdminSummary = {
  total_guests: number;
  total_rsvps: number;
  matched_rsvps: number;
  unmatched_rsvps: number;
  attending: number;
  not_attending: number;
  sunday_event: number;
  hotel_reservation_requests: number;
};

type GuestRow = {
  id: number;
  name: string;
  email?: string | null;
  max_guests: number;
  invite_sent: boolean;
  matched_rsvp_count: number;
};

type RSVPRow = {
  id: number;
  guest_id?: number | null;
  matched_guest_name?: string | null;
  invitation_max_guests?: number | null;
  submitted_name: string;
  email: string;
  attending: boolean;
  guest_count: number;
  additional_guest_names?: string | null;
  sunday_event: boolean;
  hotel_reservation_requested: boolean;
  friday_night: boolean;
  saturday_night: boolean;
  sunday_night: boolean;
  dietaries?: string | null;
  message?: string | null;
  created_at: string;
  updated_at: string;
  same_email_submission_count: number;
};

type NewGuestForm = { name: string; email: string; max_guests: number };

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

function formatBoolean(value: boolean) {
  return value ? 'Yes' : 'No';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function errorDetail(error: unknown, fallback: string) {
  if (axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string') {
    return error.response.data.detail;
  }
  return fallback;
}

export default function Admin() {
  const [secret, setSecret] = useState(() => getStoredAdminSecret());
  const [secretInput, setSecretInput] = useState('');
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [rsvps, setRsvps] = useState<RSVPRow[]>([]);
  const [loading, setLoading] = useState(Boolean(secret));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newGuest, setNewGuest] = useState<NewGuestForm>({ name: '', email: '', max_guests: 1 });

  const invitedPartiesWithResponses = useMemo(
    () => guests.filter((guest) => guest.matched_rsvp_count > 0).length,
    [guests],
  );

  const loadDashboard = async (adminSecret: string) => {
    const headers = adminHeaders(adminSecret);
    const [summaryResponse, guestsResponse, rsvpsResponse] = await Promise.all([
      adminApi.get<AdminSummary>('/summary', { headers }),
      adminApi.get<GuestRow[]>('/guests', { headers }),
      adminApi.get<RSVPRow[]>('/rsvps', { headers }),
    ]);
    setSummary(summaryResponse.data);
    setGuests(guestsResponse.data);
    setRsvps(rsvpsResponse.data);
  };

  useEffect(() => {
    if (!secret) return;
    setLoading(true);
    loadDashboard(secret)
      .catch(() => {
        clearAdminSecret();
        setSecret('');
        setSummary(null);
        setGuests([]);
        setRsvps([]);
        setError('Admin access failed. Check the secret and try again.');
      })
      .finally(() => setLoading(false));
  }, [secret]);

  const refreshDashboard = () => loadDashboard(secret);

  const handleUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedSecret = secretInput.trim();
    if (!trimmedSecret) return;
    setError(null);
    storeAdminSecret(trimmedSecret);
    setSecret(trimmedSecret);
    setSecretInput('');
  };

  const handleLogout = () => {
    clearAdminSecret();
    setSecret('');
    setSummary(null);
    setGuests([]);
    setRsvps([]);
    setNotice(null);
    setError(null);
  };

  const handleAddGuest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newGuest.name.trim();
    if (!name) {
      setError('Guest name is required.');
      return;
    }
    setBusyKey('add-guest');
    setError(null);
    setNotice(null);
    try {
      await adminApi.post(
        '/guest',
        { name, email: newGuest.email.trim() || null, max_guests: newGuest.max_guests },
        { headers: adminHeaders(secret) },
      );
      await refreshDashboard();
      setNewGuest({ name: '', email: '', max_guests: 1 });
      setNotice(`${name} was added to the paper invitation list.`);
    } catch (requestError) {
      setError(errorDetail(requestError, 'Guest could not be added.'));
    } finally {
      setBusyKey(null);
    }
  };

  const handleInviteSent = async (guest: GuestRow, inviteSent: boolean) => {
    setBusyKey(`invite-${guest.id}`);
    setError(null);
    try {
      await adminApi.patch(
        `/guest/${guest.id}/invite-sent`,
        { invite_sent: inviteSent },
        { headers: adminHeaders(secret) },
      );
      await refreshDashboard();
    } catch (requestError) {
      setError(errorDetail(requestError, `Invitation status could not be saved for ${guest.name}.`));
    } finally {
      setBusyKey(null);
    }
  };

  const handleReconcile = async (rsvp: RSVPRow, guestIdValue: string) => {
    setBusyKey(`match-${rsvp.id}`);
    setError(null);
    setNotice(null);
    try {
      await adminApi.patch(
        `/rsvp/${rsvp.id}/reconcile`,
        { guest_id: guestIdValue ? Number(guestIdValue) : null },
        { headers: adminHeaders(secret) },
      );
      await refreshDashboard();
      setNotice(
        guestIdValue
          ? `${rsvp.submitted_name}'s RSVP was matched to an invitation record.`
          : `${rsvp.submitted_name}'s RSVP is now unmatched.`,
      );
    } catch (requestError) {
      setError(errorDetail(requestError, 'The RSVP could not be reconciled.'));
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteRsvp = async (rsvp: RSVPRow) => {
    if (!window.confirm(`Delete the RSVP submitted by ${rsvp.submitted_name}?`)) return;
    setBusyKey(`rsvp-${rsvp.id}`);
    setError(null);
    try {
      await adminApi.delete(`/rsvp/${rsvp.id}`, { headers: adminHeaders(secret) });
      await refreshDashboard();
      setNotice(`Deleted ${rsvp.submitted_name}'s RSVP.`);
    } catch (requestError) {
      setError(errorDetail(requestError, 'The RSVP could not be deleted.'));
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteGuest = async (guest: GuestRow) => {
    if (!window.confirm(`Delete ${guest.name} from the invitation list? Matched RSVPs will be kept and marked unmatched.`)) return;
    setBusyKey(`guest-${guest.id}`);
    setError(null);
    try {
      await adminApi.delete(`/guest/${guest.id}`, { headers: adminHeaders(secret) });
      await refreshDashboard();
      setNotice(`Deleted ${guest.name} from the invitation list.`);
    } catch (requestError) {
      setError(errorDetail(requestError, 'The invitation record could not be deleted.'));
    } finally {
      setBusyKey(null);
    }
  };

  const downloadCsv = async (path: string, filename: string) => {
    setError(null);
    try {
      const response = await adminApi.get(path, {
        headers: adminHeaders(secret),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('CSV export failed. Please try again.');
    }
  };

  if (!secret) {
    return (
      <main className="min-h-screen bg-secondary px-6 py-16">
        <form onSubmit={handleUnlock} className="card mx-auto max-w-md space-y-6">
          <div>
            <h1 className="text-3xl font-semibold">Admin</h1>
            <p className="mt-2 text-sm text-muted-foreground">Enter the admin secret to view guest responses.</p>
          </div>
          <div className="form-group">
            <label className="label" htmlFor="admin-secret">Admin secret</label>
            <input id="admin-secret" type="password" value={secretInput} onChange={(event) => setSecretInput(event.target.value)} className="input" autoComplete="current-password" />
          </div>
          {error && <p className="field-error text-sm">{error}</p>}
          <button type="submit" className="btn btn-primary w-full">Unlock Dashboard</button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-secondary px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Wedding Admin</h1>
            <p className="mt-2 text-sm text-muted-foreground">Paper invitation list, public RSVP submissions, reconciliation, and site content.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => downloadCsv('/rsvps/export', 'wedding-rsvps.csv')} className="btn btn-primary">Download RSVPs</button>
            <button type="button" onClick={() => downloadCsv('/guests/export', 'invitation-list.csv')} className="btn btn-secondary">Download Invitations</button>
            <button type="button" onClick={handleLogout} className="btn btn-secondary">Lock</button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {[
            ['Invitation records', summary?.total_guests ?? 0],
            ['Invited with RSVP', invitedPartiesWithResponses],
            ['RSVP submissions', summary?.total_rsvps ?? 0],
            ['Unmatched', summary?.unmatched_rsvps ?? 0],
            ['Matched', summary?.matched_rsvps ?? 0],
            ['Attending', summary?.attending ?? 0],
            ['Sunday', summary?.sunday_event ?? 0],
            ['Hotel requests', summary?.hotel_reservation_requests ?? 0],
          ].map(([label, value]) => (
            <article key={label} className="card-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </article>
          ))}
        </section>

        {loading && <p className="card text-sm text-muted-foreground">Loading admin data…</p>}
        {error && <p className="alert-error">{error}</p>}
        {notice && <p className="alert-success">{notice}</p>}

        <HomepageSectionManager secret={secret} />

        <div className="grid gap-8 xl:grid-cols-2">
          <ContentManager secret={secret} kind="schedule" title="Schedule Content" fields={scheduleFields} />
          <ContentManager secret={secret} kind="accommodation" title="Accommodation Content" fields={accommodationFields} />
        </div>
        <ContentManager secret={secret} kind="travel" title="Travel Content" fields={travelFields} />

        <section className="card">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Add Paper Invitation</h2>
            <p className="mt-1 text-sm text-muted-foreground">This private list is for reconciliation only. Public submissions are never matched automatically.</p>
          </div>
          <form onSubmit={handleAddGuest} className="grid gap-4 md:grid-cols-12 md:items-end">
            <div className="form-group md:col-span-5">
              <label className="label" htmlFor="guest-name">Invitation / party name</label>
              <input id="guest-name" type="text" maxLength={160} required value={newGuest.name} onChange={(event) => setNewGuest((current) => ({ ...current, name: event.target.value }))} className="input" />
            </div>
            <div className="form-group md:col-span-4">
              <label className="label" htmlFor="guest-email">Email (optional)</label>
              <input id="guest-email" type="email" maxLength={254} value={newGuest.email} onChange={(event) => setNewGuest((current) => ({ ...current, email: event.target.value }))} className="input" />
            </div>
            <div className="form-group md:col-span-2">
              <label className="label" htmlFor="guest-max">Invited party size</label>
              <input id="guest-max" type="number" min={1} max={12} value={newGuest.max_guests} onChange={(event) => setNewGuest((current) => ({ ...current, max_guests: Number(event.target.value) || 1 }))} className="input" />
            </div>
            <button type="submit" className="btn btn-primary md:col-span-1" disabled={busyKey === 'add-guest'}>{busyKey === 'add-guest' ? 'Adding…' : 'Add'}</button>
          </form>
        </section>

        <section className="card overflow-hidden p-0">
          <div className="border-b border-[var(--color-border)] p-5">
            <h2 className="text-xl font-semibold">Paper Invitation List</h2>
            <p className="mt-1 text-sm text-muted-foreground">{guests.length} invitation records</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Invitation</th><th className="px-4 py-3">Party size</th><th className="px-4 py-3">Paper sent</th><th className="px-4 py-3">Matched RSVPs</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td className="px-4 py-4"><span className="block font-medium">{guest.name}</span><span className="text-muted-foreground">{guest.email || 'No email on invitation record'}</span></td>
                    <td className="px-4 py-4">{guest.max_guests}</td>
                    <td className="px-4 py-4"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={guest.invite_sent} disabled={busyKey === `invite-${guest.id}`} onChange={(event) => handleInviteSent(guest, event.target.checked)} />{guest.invite_sent ? 'Sent' : 'Not sent'}</label></td>
                    <td className="px-4 py-4">{guest.matched_rsvp_count}</td>
                    <td className="px-4 py-4"><button type="button" onClick={() => handleDeleteGuest(guest)} className="btn btn-danger" disabled={busyKey === `guest-${guest.id}`}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden p-0">
          <div className="border-b border-[var(--color-border)] p-5">
            <h2 className="text-xl font-semibold">Public RSVP Submissions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each submission is preserved separately. Same-email counts are review signals, not proof of identity.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1500px] text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Submitted by</th><th className="px-4 py-3">Attendance</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Sunday</th><th className="px-4 py-3">Hotel / nights</th><th className="px-4 py-3">Dietary</th><th className="px-4 py-3">Message</th><th className="px-4 py-3">Submitted / updated</th><th className="px-4 py-3">Reconciliation</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rsvps.map((rsvp) => (
                  <tr key={rsvp.id} className="align-top">
                    <td className="px-4 py-4"><span className="block font-medium">{rsvp.submitted_name}</span><span className="block text-muted-foreground">{rsvp.email}</span>{rsvp.same_email_submission_count > 1 && <span className="badge-warning mt-2 inline-block rounded px-2 py-1 text-xs">{rsvp.same_email_submission_count} submissions use this email</span>}</td>
                    <td className="px-4 py-4">{formatBoolean(rsvp.attending)}</td>
                    <td className="px-4 py-4"><span className="block">{rsvp.guest_count}</span><span className="whitespace-pre-line text-muted-foreground">{rsvp.additional_guest_names || 'No additional guests'}</span></td>
                    <td className="px-4 py-4">{formatBoolean(rsvp.sunday_event)}</td>
                    <td className="px-4 py-4"><span className="block">{formatBoolean(rsvp.hotel_reservation_requested)}</span><span className="text-muted-foreground">{[rsvp.friday_night && 'Fri', rsvp.saturday_night && 'Sat', rsvp.sunday_night && 'Sun'].filter(Boolean).join(', ') || 'No nights'}</span></td>
                    <td className="max-w-xs whitespace-pre-wrap px-4 py-4">{rsvp.dietaries || 'None'}</td>
                    <td className="max-w-xs whitespace-pre-wrap px-4 py-4">{rsvp.message || 'None'}</td>
                    <td className="px-4 py-4"><span className="block">{formatDate(rsvp.created_at)}</span>{rsvp.updated_at !== rsvp.created_at && <span className="text-muted-foreground">Updated {formatDate(rsvp.updated_at)}</span>}</td>
                    <td className="px-4 py-4"><select value={rsvp.guest_id ?? ''} onChange={(event) => handleReconcile(rsvp, event.target.value)} className="input min-w-56" disabled={busyKey === `match-${rsvp.id}`}><option value="">Unmatched</option>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name} (max {guest.max_guests})</option>)}</select>{rsvp.guest_id && <p className="mt-2 text-xs text-muted-foreground">Matched to {rsvp.matched_guest_name}; invitation max {rsvp.invitation_max_guests}</p>}</td>
                    <td className="px-4 py-4"><button type="button" onClick={() => handleDeleteRsvp(rsvp)} className="btn btn-danger" disabled={busyKey === `rsvp-${rsvp.id}`}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
