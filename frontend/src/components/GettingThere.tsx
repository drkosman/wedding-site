import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { getContentEntries, type ContentEntry } from '../api/content';

export default function GettingThere() {
  const [routeSections, setRouteSections] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getContentEntries('travel')
      .then((response) => {
        setRouteSections(response.data);
        setError(null);
      })
      .catch(() => setError('Travel details could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

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

        {loading && <p className="text-muted-foreground">Loading travel details...</p>}
        {!loading && error && <p className="text-muted-foreground">{error}</p>}
        {!loading && !error && routeSections.length === 0 && (
          <p className="text-muted-foreground">Travel details will be shared soon.</p>
        )}

        {!loading && !error && routeSections.length > 0 && (
          <div className="grid gap-4 text-left md:grid-cols-2">
            {routeSections.map((route) => (
              <article key={route.id} className="card-soft">
                <h3 className="card-title">{route.title}</h3>
                {route.description && <p className="card-description">{route.description}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
