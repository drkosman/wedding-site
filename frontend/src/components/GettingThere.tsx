const routeSections = [
  {
    title: 'By car',
    description: 'Route notes will be added here.',
  },
  {
    title: 'By train',
    description: 'Rail and onward travel notes will be added here.',
  },
  {
    title: 'By ferry or air',
    description: 'Ferry, flight, and transfer notes will be added here.',
  },
  {
    title: 'Getting away',
    description: 'Return travel notes will be added here.',
  },
];

export default function GettingThere() {
  return (
    <section className="section bg-white text-center">
      <div className="container-page max-w-3xl">
        <h2 className="text-3xl font-semibold mb-6">
          Getting There & Away
        </h2>

        <div className="w-20 h-px mx-auto mb-14 bg-primary/40 rounded-full" />

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
