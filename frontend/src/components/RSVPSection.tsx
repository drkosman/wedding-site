import RSVPForm from './RSVPForm';
import { useGuest } from '../hooks/useGuest';

export default function RSVPSection() {
  const { guest, token, loading, error } = useGuest();

  return (
    <section id="rsvp" className="section bg-white text-center">
      <div className="container-page max-w-4xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-hover)]">
          Next step
        </p>
        <h2 className="mb-4 text-3xl font-semibold">
          RSVP
        </h2>

        <p className="mx-auto mb-10 max-w-2xl text-base text-muted-foreground">
          Please complete your RSVP below so we can confirm numbers, accommodation interest,
          and any dietary details.
        </p>

        {loading && (
          <p className="text-muted-foreground">
            Loading your invitation…
          </p>
        )}

        {!loading && !guest && (
          <p className="text-muted-foreground">
            {error ?? 'Please use your personal RSVP link from the invitation.'}
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
