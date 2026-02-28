export default function Schedule() {
  return (
    <section className="py-24 px-6 bg-white text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-serif mb-4">Schedule</h2>

        <div className="w-24 h-px bg-neutral-300 mx-auto mb-12" />

        <div className="space-y-6">
          {[
            ['3:00 PM', 'Ceremony'],
            ['4:00 PM', 'Drinks Reception'],
            ['6:00 PM', 'Dinner'],
            ['8:00 PM', 'Dancing'],
          ].map(([time, event]) => (
            <div key={time} className="flex items-center justify-center gap-6">
              <span className="font-semibold w-24 text-right">{time}</span>

              <div className="w-2 h-2 rounded-full bg-neutral-400" />

              <span className="w-40 text-left">{event}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
