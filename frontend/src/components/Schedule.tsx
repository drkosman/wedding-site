import { useEffect, useState } from 'react';
import { getContentEntries, type ContentEntry } from '../api/content';

export default function Schedule() {
  const [events, setEvents] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getContentEntries('schedule')
      .then((response) => {
        setEvents(response.data);
        setError(null);
      })
      .catch(() => setError('Schedule details could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="section bg-surface text-center">
      <div className="container-page max-w-2xl">
        <h2 className="text-3xl font-semibold mb-6">Schedule</h2>
        <h3 className="font-semibold mb-6">Further details coming soon...</h3>
        <div className="w-20 h-px mx-auto mb-14 bg-primary/40 rounded-full" />

        {loading && <p className="text-muted-foreground">Loading schedule...</p>}
        {!loading && error && <p className="text-muted-foreground">{error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className="text-muted-foreground">Schedule details will be shared soon.</p>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="space-y-8">
            {events.map((event) => {
              const label = [event.date, event.time].filter(Boolean).join(' | ');

              return (
                <div key={event.id} className="relative flex justify-between items-center">
                  <span className="w-1/2 text-right pr-8 font-semibold">
                    {label || event.location || 'TBC'}
                  </span>

                  <div className="w-3 h-3 rounded-full bg-primary absolute left-1/2 -translate-x-1/2" />

                  <span className="w-1/2 text-left pl-8 text-muted-foreground">
                    <span className="block">{event.title}</span>
                    {event.description && <span className="block text-sm">{event.description}</span>}
                    {event.location && <span className="block text-sm">{event.location}</span>}
                    {event.notes && <span className="block text-sm">{event.notes}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
