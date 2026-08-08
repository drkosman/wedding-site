import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import HomepageCustomSection from '../components/HomepageCustomSection';
import { HomepageSectionEmptyState } from '../components/admin/HomepageSectionManager';
import type { HomepageSection } from '../api/homepageSections';
import { composeHomepageSections } from './homepageComposition';

function customSection(overrides: Partial<HomepageSection> = {}): HomepageSection {
  return {
    id: 1,
    title: 'A note from us',
    subtitle: null,
    content: 'First paragraph\n\nSecond paragraph',
    position: 6,
    sort_order: 0,
    ...overrides,
  };
}

describe('homepage composition', () => {
  it('keeps the original fixed homepage order when there are no custom sections', () => {
    expect(composeHomepageSections([])).toEqual([
      { type: 'fixed', key: 'details' },
      { type: 'fixed', key: 'rsvp' },
      { type: 'fixed', key: 'map' },
      { type: 'fixed', key: 'schedule' },
      { type: 'fixed', key: 'accommodation' },
      { type: 'fixed', key: 'travel' },
    ]);
  });

  it('places custom sections between fixed sections in persisted order', () => {
    const result = composeHomepageSections([
      customSection({ id: 3, title: 'Third', position: 2, sort_order: 1 }),
      customSection({ id: 2, title: 'Second', position: 2, sort_order: 0 }),
      customSection({ id: 1, title: 'First', position: 0, sort_order: 0 }),
    ]);

    expect(result.map((item) => item.type === 'fixed' ? item.key : item.section.title)).toEqual([
      'First',
      'details',
      'rsvp',
      'Second',
      'Third',
      'map',
      'schedule',
      'accommodation',
      'travel',
    ]);
  });

  it('renders plain text safely with optional subtitle and newline handling', () => {
    const html = renderToStaticMarkup(
      <HomepageCustomSection
        section={customSection({
          subtitle: 'Travel update',
          content: '<script>alert("no")</script>\nNext line',
        })}
      />,
    );

    expect(html).toContain('Travel update');
    expect(html).toContain('whitespace-pre-line');
    expect(html).toContain('&lt;script&gt;alert(&quot;no&quot;)&lt;/script&gt;\nNext line');
    expect(html).not.toContain('<script>');
  });

  it('gives admins a clear empty state and creation direction', () => {
    const html = renderToStaticMarkup(<HomepageSectionEmptyState />);

    expect(html).toContain('No custom homepage sections yet.');
    expect(html).toContain('create the first one');
  });
});
