import type { HomepageSection } from '../api/homepageSections';

type HomepageCustomSectionProps = {
  section: HomepageSection;
  muted?: boolean;
};

export default function HomepageCustomSection({
  section,
  muted = false,
}: HomepageCustomSectionProps) {
  return (
    <section className={`section text-center ${muted ? 'bg-secondary' : 'bg-surface'}`}>
      <div className="container-page max-w-3xl">
        {section.subtitle && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-primary-hover)]">
            {section.subtitle}
          </p>
        )}
        <h2 className="mb-6 text-3xl font-semibold">{section.title}</h2>
        <div className="mx-auto mb-8 h-px w-20 rounded-full bg-primary/40" />
        <p className="mx-auto max-w-2xl whitespace-pre-line text-left text-base text-muted-foreground">
          {section.content}
        </p>
      </div>
    </section>
  );
}
