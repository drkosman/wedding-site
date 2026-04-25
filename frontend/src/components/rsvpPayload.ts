export type RSVPFormData = {
  attending: 'yes' | 'no';
  guest_count: number;
  sunday_event: 'yes' | 'no';
  hotel_reservation_requested: boolean;
  friday_night: boolean;
  saturday_night: boolean;
  sunday_night: boolean;
  dietary_requirements?: string;
  message?: string;
};

export type RSVPPayload = Omit<RSVPFormData, 'attending' | 'sunday_event'> & {
  attending: boolean;
  sunday_event: boolean;
};

export function buildRSVPPayload(data: RSVPFormData): RSVPPayload {
  return {
    ...data,
    attending: data.attending === 'yes',
    sunday_event: data.sunday_event === 'yes',
  };
}
