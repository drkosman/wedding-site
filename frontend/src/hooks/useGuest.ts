import { useEffect, useState } from 'react';
import { api } from '../api/client';

export interface Guest {
  name: string;
  email?: string;
  plus_one_allowed: boolean;
  max_guests: number;
  rsvp?: RSVP;
}

export interface RSVP {
  attending: boolean;
  guest_count: number;
  sunday_event: boolean;
  hotel_reservation_requested: boolean;
  friday_night: boolean;
  saturday_night: boolean;
  sunday_night: boolean;
  dietary_requirements?: string;
  message?: string;
}

function getInitialToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') ?? localStorage.getItem('rsvp_token');
}

export function useGuest() {
  const [token, setToken] = useState<string | null>(() => getInitialToken());
  const [guest, setGuest] = useState<Guest | null>(null);
  const [loading, setLoading] = useState(() => Boolean(token));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    localStorage.setItem('rsvp_token', token);

    api
      .get(`/guest/${token}`)
      .then((res) => setGuest(res.data))
      .catch(() => {
        setGuest(null);
        setToken(null);
        localStorage.removeItem('rsvp_token');
        setError('We could not find that RSVP invitation.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  return { guest, token, loading, error };
}
