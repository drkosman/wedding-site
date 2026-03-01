export default function Hero() {
  return (
    <section className="min-h-screen flex flex-col justify-center items-center text-center px-6 bg-secondary">
      <div className="container-page flex flex-col items-center">
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight mb-6">
          Lucy & Kosta
        </h1>

        <p className="text-xl font-medium">
          May 1st, 2026
        </p>

        <p className="mt-2 text-muted-foreground">
          Barnacarry Bay
        </p>

        <p className="mt-16 text-sm text-muted-foreground opacity-70 animate-pulse">
          Scroll for details ↓
        </p>
      </div>
    </section>
  );
}