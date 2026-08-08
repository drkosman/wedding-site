import { describe, expect, it } from 'vitest';
import { buildRSVPPayload, type RSVPFormData } from './rsvpPayload';


function formData(overrides: Partial<RSVPFormData> = {}): RSVPFormData {
  return {
    full_name: '  Test   Guest ',
    email: ' GUEST@Example.com ',
    attending: 'yes',
    guest_count: 2,
    additional_guest_names: ' Second Guest ',
    sunday_event: 'no',
    hotel_reservation_requested: true,
    friday_night: true,
    saturday_night: true,
    sunday_night: false,
    dietary_requirements: ' Vegetarian ',
    message: ' Looking forward to it ',
    website: '',
    ...overrides,
  };
}

describe('buildRSVPPayload', () => {
  it('normalizes identifying data and preserves valid attending choices', () => {
    expect(buildRSVPPayload(formData(), 'challenge')).toEqual({
      full_name: 'Test Guest',
      email: 'guest@example.com',
      attending: true,
      guest_count: 2,
      additional_guest_names: 'Second Guest',
      sunday_event: false,
      hotel_reservation_requested: true,
      friday_night: true,
      saturday_night: true,
      sunday_night: false,
      dietary_requirements: 'Vegetarian',
      message: 'Looking forward to it',
      website: '',
      turnstile_token: 'challenge',
    });
  });

  it('clears every attendance-dependent field when declining', () => {
    expect(
      buildRSVPPayload(
        formData({ attending: 'no', guest_count: 4, sunday_event: 'yes' }),
        'challenge',
      ),
    ).toMatchObject({
      attending: false,
      guest_count: 1,
      additional_guest_names: null,
      sunday_event: false,
      hotel_reservation_requested: false,
      friday_night: false,
      saturday_night: false,
      sunday_night: false,
      dietary_requirements: null,
    });
  });

  it('clears room nights when hotel help is not requested', () => {
    expect(
      buildRSVPPayload(formData({ hotel_reservation_requested: false }), 'challenge'),
    ).toMatchObject({
      hotel_reservation_requested: false,
      friday_night: false,
      saturday_night: false,
      sunday_night: false,
    });
  });
});
