import { ExternalLink } from 'lucide-react';
export default function Details() {
  return (
    <section className="section bg-secondary text-center">
      <div className="container-page max-w-2xl">
        <h2 className="text-3xl font-semibold mb-8">Wedding Details</h2>
        <div className="space-y-2 text-lg">
          <p>Saturday, May 1st, 2027</p>
          <a
            href="https://maps.app.goo.gl/UhaxTc5Df63ZYWqTA"
            target="_blank"
            className="text-primary-strong hover:text-primary-hover font-bold inline-flex items-center gap-1 underline"
          >
            St John’s Scottish Episcopal Cathedral, Oban
            </a>
            <ExternalLink className="w-4 h-4 opacity-70" />
          <p>More details below.</p>
        </div>
        <p className="mt-10 text-muted-foreground">We can’t wait to celebrate with you.</p>
      </div>
    </section>
  );
}
