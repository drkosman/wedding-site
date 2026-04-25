import { ExternalLink } from 'lucide-react';
export default function Details() {
  return (
    <section className="section bg-secondary text-center">
      <div className="container-page max-w-2xl">
        <h2 className="text-3xl font-semibold mb-8">Wedding Details</h2>
        <div className="space-y-2 text-lg">
          <p>Friday, May 1st, 2026</p>
          <a
            href="https://maps.app.goo.gl/bg8bxSFaJbG3RMYt5"
            target="_blank"
            className="text-muted-foreground font-bold inline-flex items-center gap-1 underline"
          >
            Barnacarry Bay, Scotland
            <ExternalLink className="w-4 h-4 opacity-70" />
          </a>
          <p>More details soon</p>
        </div>
        <p className="mt-10 text-muted-foreground">We can’t wait to celebrate with you.</p>
      </div>
    </section>
  );
}
