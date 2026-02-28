import RSVPForm from './RSVPForm';
import { useGuest } from '../hooks/useGuest';

export default function RSVPSection() {
  const { guest, token, loading } = useGuest();

  return (
    <section className="py-24 px-6 bg-neutral-50 text-center">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-serif mb-4">RSVP</h2>

        <div className="w-24 h-px bg-neutral-300 mx-auto mb-10" />

        {loading && <p className="text-neutral-500">Loading your invitation…</p>}

        {!loading && !guest && (
          <p className="text-neutral-600">
            Please use your personal RSVP link from the invitation.
          </p>
        )}

        {guest && token && (
          <div className="mt-6">
            <RSVPForm guest={guest} token={token} />
          </div>
        )}
      </div>
    </section>
  );
}
