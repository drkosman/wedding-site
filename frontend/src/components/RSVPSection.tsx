import RSVPForm from './RSVPForm';

export default function RSVPSection() {
  return (
    <section id="rsvp" className="section bg-surface text-center">
      <div className="container-page max-w-4xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-hover)]">
          Next step
        </p>
        <h2 className="mb-4 text-3xl font-semibold">RSVP</h2>
        <p className="mx-auto mb-10 max-w-2xl text-base text-muted-foreground">
          Please complete your RSVP by the 1st of November.
        </p>
        <div className="mt-8">
          <RSVPForm />
        </div>
      </div>
    </section>
  );
}
