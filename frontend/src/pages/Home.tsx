import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';

import { getHomepageSections, type HomepageSection } from '../api/homepageSections';
import Hero from '../components/Hero';
import Details from '../components/Details';
import Schedule from '../components/Schedule';
import Accomodation from '../components/Accomodation';
import GettingThere from '../components/GettingThere';
import RSVPSection from '../components/RSVPSection';
import Footer from '../components/Footer';
import AppMap from '../components/Map';
import HomepageCustomSection from '../components/HomepageCustomSection';
import {
  composeHomepageSections,
  type FixedHomepageSection,
} from './homepageComposition';

const fixedSectionComponents: Record<FixedHomepageSection, ComponentType> = {
  details: Details,
  rsvp: RSVPSection,
  map: AppMap,
  schedule: Schedule,
  accommodation: Accomodation,
  travel: GettingThere,
};

function customSectionUsesMutedBackground(position: number, indexAtPosition: number) {
  const firstCustomSectionIsMuted = position > 0 && position % 2 === 0;
  return indexAtPosition % 2 === 0
    ? firstCustomSectionIsMuted
    : !firstCustomSectionIsMuted;
}

export default function Home() {
  const [customSections, setCustomSections] = useState<HomepageSection[]>([]);

  useEffect(() => {
    getHomepageSections()
      .then((response) => setCustomSections(response.data))
      .catch(() => setCustomSections([]));
  }, []);

  const customIndexByPosition = new Map<number, number>();

  return (
    <div>
      <Hero />
      {composeHomepageSections(customSections).map((item) => {
        if (item.type === 'fixed') {
          const FixedSection = fixedSectionComponents[item.key];
          return <FixedSection key={`fixed-${item.key}`} />;
        }

        const indexAtPosition = customIndexByPosition.get(item.section.position) ?? 0;
        customIndexByPosition.set(item.section.position, indexAtPosition + 1);
        return (
          <HomepageCustomSection
            key={`custom-${item.section.id}`}
            section={item.section}
            muted={customSectionUsesMutedBackground(item.section.position, indexAtPosition)}
          />
        );
      })}
      <Footer />
    </div>
  );
}
