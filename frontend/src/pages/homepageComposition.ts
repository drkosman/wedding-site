import type { HomepageSection } from '../api/homepageSections';

export const FIXED_HOMEPAGE_SECTIONS = [
  'details',
  'rsvp',
  'map',
  'schedule',
  'accommodation',
  'travel',
] as const;

export type FixedHomepageSection = (typeof FIXED_HOMEPAGE_SECTIONS)[number];

export type HomepageCompositionItem =
  | { type: 'fixed'; key: FixedHomepageSection }
  | { type: 'custom'; section: HomepageSection };

export function composeHomepageSections(
  customSections: HomepageSection[],
): HomepageCompositionItem[] {
  const orderedCustomSections = [...customSections].sort(
    (left, right) => left.position - right.position
      || left.sort_order - right.sort_order
      || left.id - right.id,
  );
  const items: HomepageCompositionItem[] = [];

  for (let position = 0; position <= FIXED_HOMEPAGE_SECTIONS.length; position += 1) {
    items.push(
      ...orderedCustomSections
        .filter((section) => section.position === position)
        .map((section) => ({ type: 'custom' as const, section })),
    );

    const fixedSection = FIXED_HOMEPAGE_SECTIONS[position];
    if (fixedSection) {
      items.push({ type: 'fixed', key: fixedSection });
    }
  }

  return items;
}
