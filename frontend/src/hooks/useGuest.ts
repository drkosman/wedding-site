import { useEffect, useState } from 'react';
import { api } from '../api/client';

export interface Guest {
  name: string;
  email?: string;
  plus_one_allowed: boolean;
  max_guests: number;
}

export function useGuest() {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let t = params.get('token');

    if (!t) {
      t = localStorage.getItem('rsvp_token');
    }

    if (!t) {
      setLoading(false);
      return;
    }

    localStorage.setItem('rsvp_token', t);
    setToken(t);

    api
      .get(`/guest/${t}`)
      .then((res) => setGuest(res.data))
      .catch(() => setGuest(null))
      .finally(() => setLoading(false));
  }, []);

  return { guest, token, loading };
}
