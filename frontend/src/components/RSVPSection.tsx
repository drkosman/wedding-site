import RSVPForm from './RSVPForm';
import { useGuest } from '../hooks/useGuest';

export default function RSVPSection() {
  const { guest, token, loading } = useGuest();

  return (
    <section className="section bg-white text-center">
      <div className="container-page max-w-3xl">
        <h2 className="text-3xl font-semibold mb-6">
          RSVP
        </h2>

        <div className="w-20 h-px mx-auto mb-12 bg-primary/40 rounded-full" />

        {loading && (
          <p className="text-muted-foreground">
            Loading your invitation…
          </p>
        )}

        {!loading && !guest && (
          <p className="text-muted-foreground">
            Please use your personal RSVP link from the invitation.
          </p>
        )}

        {guest && token && (
          <div className="mt-8">
            <RSVPForm guest={guest} token={token} />
          </div>
        )}
      </div>
    </section>
  );
}