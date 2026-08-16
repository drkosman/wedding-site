import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import HomepageCustomSection from '../components/HomepageCustomSection';
import MarkdownContent from '../components/MarkdownContent';
import HomepageSectionManager, {
  HomepageSectionEmptyState,
} from '../components/admin/HomepageSectionManager';
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
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert(&quot;no&quot;)');
    expect(html).toContain('Next line');
  });

  it('renders supported Markdown with wedding-site content markup', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent content={`Plain text
on a new line.

Second paragraph with **bold**, *italic*, and [travel details](#travel).

### Getting there

- Coach
- Parking

1. Arrive
2. Celebrate

> A quiet note

---`} />,
    );

    expect(html).toContain('class="markdown-content"');
    expect(html).toContain('Plain text<br/>\non a new line.');
    expect(html).toContain('</p>\n<p>Second paragraph');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<a href="#travel">travel details</a>');
    expect(html).toContain('<h3>Getting there</h3>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<hr/>');
  });

  it('keeps Markdown HTML, scripts, unsafe links, and images inert', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent content={`Before <span onclick="alert('no')">inside</span> after.

<script>alert('no')</script>

[unsafe](javascript:alert('no'))

![remote image](https://example.com/tracker.png)`} />,
    );

    expect(html).not.toContain('<span onclick');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<img');
    expect(html).toContain('<a href="">unsafe</a>');
    expect(html).toContain('remote image');
  });

  it('demotes top-level Markdown headings beneath the section title', () => {
    const html = renderToStaticMarkup(<MarkdownContent content={'# Heading\n\n## Subheading'} />);

    expect(html).not.toContain('<h1>');
    expect(html).not.toContain('<h2>');
    expect(html.match(/<h3>/g)).toHaveLength(2);
  });

  it('gives admins a clear empty state and creation direction', () => {
    const html = renderToStaticMarkup(<HomepageSectionEmptyState />);

    expect(html).toContain('No custom homepage sections yet.');
    expect(html).toContain('create the first one');
  });

  it('offers administrators Markdown editing help and a preview toggle', () => {
    const html = renderToStaticMarkup(<HomepageSectionManager secret="test-secret" />);

    expect(html).toContain('Content (Markdown)');
    expect(html).toContain('font-mono');
    expect(html).toContain('min-h-64');
    expect(html).toContain('Preview');
    expect(html).toContain('### Heading');
    expect(html).toContain('[link text](https://...)');
  });
});
