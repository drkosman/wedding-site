import { api } from './client';

export const HOMEPAGE_POSITIONS = [
  { value: 0, label: 'After the hero, before Wedding Details' },
  { value: 1, label: 'After Wedding Details' },
  { value: 2, label: 'After RSVP' },
  { value: 3, label: 'After the map' },
  { value: 4, label: 'After Schedule' },
  { value: 5, label: 'After Accommodation' },
  { value: 6, label: 'After Getting There & Away' },
] as const;

export type HomepageSection = {
  id: number;
  title: string;
  subtitle?: string | null;
  content: string;
  position: number;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export function getHomepageSections() {
  return api.get<HomepageSection[]>('/homepage-sections');
}

export function homepagePositionLabel(position: number) {
  return HOMEPAGE_POSITIONS.find((option) => option.value === position)?.label
    ?? 'Unknown position';
}
