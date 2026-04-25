import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  adminApi,
  adminHeaders,
  clearAdminSecret,
  getStoredAdminSecret,
  storeAdminSecret,
} from '../api/adminClient';

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
  plus_one_allowed: boolean;
  max_guests: number;
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

export default function Admin() {
  const [secret, setSecret] = useState(() => getStoredAdminSecret());
  const [secretInput, setSecretInput] = useState('');
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(Boolean(secret));
  const [error, setError] = useState<string | null>(null);

  const responseRate = useMemo(() => {
    if (!summary?.total_guests) return '0%';
    return `${Math.round((summary.total_rsvps / summary.total_guests) * 100)}%`;
  }, [summary]);

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

  const handleUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedSecret = secretInput.trim();
    if (!trimmedSecret) return;

    setError(null);
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
                <button type="button" onClick={handleLogout} className="btn btn-secondary">
                  Lock
                </button>
              </div>
            </header>

            {error && <p className="card border-red-200 text-sm text-red-700">{error}</p>}

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {[
                ['Guests', summary?.total_guests ?? 0],
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
                      <th className="px-4 py-3">RSVP</th>
                      <th className="px-4 py-3">Party</th>
                      <th className="px-4 py-3">Sunday</th>
                      <th className="px-4 py-3">Hotel</th>
                      <th className="px-4 py-3">Nights</th>
                      <th className="px-4 py-3">Dietary</th>
                      <th className="px-4 py-3">Message</th>
                      <th className="px-4 py-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {guests.map((guest) => (
                      <tr key={guest.id} className="align-top">
                        <td className="px-4 py-4">
                          <span className="block font-medium">{guest.name}</span>
                          <span className="block text-muted-foreground">
                            {guest.email ?? 'No email'}
                          </span>
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
                      </tr>
                    ))}
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
