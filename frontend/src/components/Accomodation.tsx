import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { getContentEntries, isValidHttpUrl, type ContentEntry } from '../api/content';

export default function Accommodation() {
  const [accommodations, setAccommodations] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getContentEntries('accommodation')
      .then((response) => {
        setAccommodations(response.data);
        setError(null);
      })
      .catch(() => setError('Accommodation details could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="section bg-secondary text-center">
      <div className="container-page max-w-2xl">
        <h2 className="text-3xl font-semibold mb-6">
          Accommodation
        </h2>

        <div className="w-20 h-px mx-auto mb-14 bg-primary/40 rounded-full" />

        {loading && <p className="card text-muted-foreground">Loading accommodation...</p>}
        {!loading && error && <p className="card text-muted-foreground">{error}</p>}
        {!loading && !error && accommodations.length === 0 && (
          <p className="card text-muted-foreground">Recommended hotels will be listed soon.</p>
        )}

        {!loading && !error && accommodations.length > 0 && (
          <div className="space-y-4">
            {accommodations.map((accommodation) => {
              const websiteUrl = isValidHttpUrl(accommodation.website_url)
                ? accommodation.website_url
                : null;

              return (
                <article key={accommodation.id} className="card text-lg space-y-3">
                  <h3 className="text-xl font-semibold">
                    {accommodation.notes && (
                      <span className="font-semibold">{accommodation.notes}: </span>
                    )}
                    {websiteUrl ? (
                      <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary-strong underline hover:text-primary-hover"
                      >
                        {accommodation.title}
                        <ExternalLink className="h-4 w-4 opacity-70" />
                      </a>
                    ) : (
                      accommodation.title
                    )}
                  </h3>

                  {accommodation.description && (
                    <p className="text-muted-foreground">{accommodation.description}</p>
                  )}
                  {accommodation.address && (
                    <p className="text-sm text-muted-foreground">{accommodation.address}</p>
                  )}
                  {[accommodation.price_notes, accommodation.distance].filter(Boolean).length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {[accommodation.price_notes, accommodation.distance].filter(Boolean).join(' | ')}
                    </p>
                  )}
                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary-strong underline hover:text-primary-hover"
                    >
                      Website
                      <ExternalLink className="h-4 w-4 opacity-70" />
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
