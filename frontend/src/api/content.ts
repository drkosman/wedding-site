import { api } from './client';

export type ContentKind = 'schedule' | 'accommodation' | 'travel';

export type ContentEntry = {
  id: number;
  kind: ContentKind;
  sort_order: number;
  title: string;
  description?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  notes?: string | null;
  address?: string | null;
  price_notes?: string | null;
  distance?: string | null;
  website_url?: string | null;
  updated_at?: string | null;
};

export function getContentEntries(kind: ContentKind) {
  return api.get<ContentEntry[]>(`/content/${kind}`);
}

export function isValidHttpUrl(value?: string | null) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
