export const PUBLIC_MAX_GUESTS = 6;
export const HOTEL_RESERVATION_REQUESTS_ENABLED = false;
export const PARTY_SIZE_SELECTION_ENABLED = false;

export type RSVPFormData = {
  full_name: string;
  email: string;
  attending: 'yes' | 'no' | '';
  guest_count: number;
  additional_guest_names?: string;
  sunday_event: 'yes' | 'no';
  hotel_reservation_requested: boolean;
  friday_night: boolean;
  saturday_night: boolean;
  sunday_night: boolean;
  dietaries?: string;
  message?: string;
  website: string;
};

export type RSVPPayload = {
  full_name: string;
  email: string;
  attending: boolean;
  guest_count: number;
  additional_guest_names: string | null;
  sunday_event: boolean;
  hotel_reservation_requested: boolean;
  friday_night: boolean;
  saturday_night: boolean;
  sunday_night: boolean;
  dietaries: string | null;
  message: string | null;
  website: string;
  turnstile_token: string;
};

function optionalText(value?: string) {
  return value?.trim() || null;
}

export function buildRSVPPayload(
  data: RSVPFormData,
  turnstileToken: string,
): RSVPPayload {
  const attending = data.attending === 'yes';
  const hotelRequested =
    HOTEL_RESERVATION_REQUESTS_ENABLED && attending && data.hotel_reservation_requested;
  const guestCount =
    PARTY_SIZE_SELECTION_ENABLED && attending ? data.guest_count : 1;

  return {
    full_name: data.full_name.trim().replace(/\s+/g, ' '),
    email: data.email.trim().toLowerCase(),
    attending,
    guest_count: guestCount,
    additional_guest_names:
      attending && guestCount > 1 ? optionalText(data.additional_guest_names) : null,
    sunday_event: attending && data.sunday_event === 'yes',
    hotel_reservation_requested: hotelRequested,
    friday_night: hotelRequested && data.friday_night,
    saturday_night: hotelRequested && data.saturday_night,
    sunday_night: hotelRequested && data.sunday_night,
    dietaries: attending ? optionalText(data.dietaries) : null,
    message: optionalText(data.message),
    website: data.website,
    turnstile_token: turnstileToken,
  };
}
