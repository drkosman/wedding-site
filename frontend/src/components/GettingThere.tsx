import { ExternalLink } from 'lucide-react';

const routeSections = [
  {
    title: 'By car',
    description:
      'Oban is accessible by car via the A82 and A85, offering a scenic drive through the Scottish Highlands. Please allow extra time for narrow roads and slower traffic in rural areas. The ceremony will take place in Oban, and the reception is at Barnacarry Bay, approximately a 20-minute drive away. Shuttle transport will be provided and strongly encouraged, as parking at the reception is very limited.',
  },
  {
    title: 'By train',
    description:
      'Regular train services run from Glasgow to Oban, offering a direct (and stunning!) journey of around 3 hours. From Oban station, the ceremony location is nearby. Shuttle transport will be provided to take guests from the ceremony to the reception at Barnacarry Bay.',
  },
  {
    title: 'By air',
    description:
      'The nearest major airport is Glasgow Airport. From there, you can take a transfer into Glasgow city centre and board a direct train to Oban. The train journey is straightforward and highly recommended for its scenic views.',
  },
  {
    title: 'Getting away',
    description:
      'Return travel is via Oban. Guests can take the train from Oban back to Glasgow, with onward connections by rail or air. Shuttle transport will return guests from the reception to central Oban following the celebrations.',
  },
];

export default function GettingThere() {
  return (
    <section className="section bg-white text-center">
      <div className="container-page max-w-3xl">
        <h2 className="text-3xl font-semibold mb-6">Getting There & Away</h2>

        <div className="w-20 h-px mx-auto mb-14 bg-primary/40 rounded-full" />

        <div className="space-y-2 text-sm flex flex-col">
          <>
            <div className="space-x-2 text-sm flex flex-row">
              <div className="flex flex-col w-1/2">
                <a
                  href="https://maps.app.goo.gl/V42FP9toV2imMUzV7"
                  target="_blank"
                  className="text-muted-foreground font-bold inline-flex items-center gap-1 underline m-auto"
                >
                  Ceremony: St John's Scottish Episcopal Cathedral
                </a>
              </div>
              <div className="flex w-1/2">
                <a
                  href="https://maps.app.goo.gl/bg8bxSFaJbG3RMYt5"
                  target="_blank"
                  className="text-muted-foreground font-bold inline-flex items-center gap-1 underline m-auto"
                >
                  Reception: Barnacarry Bay
                </a>
              </div>
            </div>
          </>
          <>
            <div className="space-y-2 text-sm flex flex-row">
              <ExternalLink className="w-6 h-6 opacity-70 m-auto mb-2" />
              <ExternalLink className="w-6 h-6 opacity-70 m-auto mb-2" />
            </div>
          </>
        </div>

        <div className="w-20 h-px mx-auto my-14 bg-primary/40 rounded-full" />

        <div className="grid gap-4 text-left md:grid-cols-2">
          {routeSections.map((route) => (
            <article key={route.title} className="card-soft">
              <h3 className="card-title">{route.title}</h3>
              <p className="card-description">{route.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
