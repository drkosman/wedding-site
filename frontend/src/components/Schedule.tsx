export default function Schedule() {
  const events = [
    ['3:00 PM', 'Ceremony'],
    ['4:00 PM', 'Drinks Reception'],
    ['6:00 PM', 'Dinner'],
    ['8:00 PM', 'Dancing'],
  ];
  return (
    <section className="section bg-white text-center">
      <div className="container-page max-w-2xl">
        <h2 className="text-3xl font-semibold mb-6">Schedule</h2>

        <div className="w-20 h-px mx-auto mb-14 bg-primary/40 rounded-full" />

        <div className="space-y-8">
          {events.map(([time, event]) => (
            <div key={time} className="relative flex justify-between items-center">
              <span className="w-1/2 text-right pr-8 font-semibold">{time}</span>

              <div className="w-3 h-3 rounded-full bg-primary absolute left-1/2 -translate-x-1/2" />

              <span className="w-1/2 text-left pl-8 text-muted-foreground">{event}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
