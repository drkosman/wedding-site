import { describe, expect, it } from 'vitest';
import { buildRSVPPayload, type RSVPFormData } from './rsvpPayload';

describe('buildRSVPPayload', () => {
  it('converts radio values and preserves hotel night choices', () => {
    const formData: RSVPFormData = {
      attending: 'yes',
      guest_count: 2,
      sunday_event: 'no',
      hotel_reservation_requested: true,
      friday_night: true,
      saturday_night: true,
      sunday_night: false,
      dietary_requirements: 'Vegetarian',
      message: 'Looking forward to it',
    };

    expect(buildRSVPPayload(formData)).toEqual({
      attending: true,
      guest_count: 2,
      sunday_event: false,
      hotel_reservation_requested: true,
      friday_night: true,
      saturday_night: true,
      sunday_night: false,
      dietary_requirements: 'Vegetarian',
      message: 'Looking forward to it',
    });
  });
});
