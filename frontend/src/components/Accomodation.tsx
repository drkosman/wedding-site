export default function Accommodation() {
  return (
    <section className="section bg-secondary text-center">
      <div className="container-page max-w-2xl">
        <h2 className="text-3xl font-semibold mb-6">
          Accommodation
        </h2>

        <div className="w-20 h-px mx-auto mb-14 bg-primary/40 rounded-full" />

        <div className="card text-lg space-y-4">
          <p>
            <span className="font-semibold">Nearest town:</span> Oban
          </p>

          <p className="text-muted-foreground">
            Recommended hotels will be listed soon.
          </p>
        </div>
      </div>
    </section>
  );
}