import { useForm } from 'react-hook-form';
import { api } from '../api/client';
import type { Guest } from '../hooks/useGuest';
import { useState } from 'react';
import { buildRSVPPayload, type RSVPFormData } from './rsvpPayload';

interface RSVPFormProps {
  guest: Guest;
  token: string;
}

export default function RSVPForm({ guest, token }: RSVPFormProps) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const { register, handleSubmit } = useForm<RSVPFormData>({
    defaultValues: {
      attending: guest.rsvp?.attending === false ? 'no' : 'yes',
      guest_count: guest.rsvp?.guest_count ?? 1,
      sunday_event: guest.rsvp?.sunday_event ? 'yes' : 'no',
      hotel_reservation_requested: guest.rsvp?.hotel_reservation_requested ?? false,
      friday_night: guest.rsvp?.friday_night ?? false,
      saturday_night: guest.rsvp?.saturday_night ?? false,
      sunday_night: guest.rsvp?.sunday_night ?? false,
      dietary_requirements: guest.rsvp?.dietary_requirements ?? '',
      message: guest.rsvp?.message ?? '',
    },
  });

  const onSubmit = async (data: RSVPFormData) => {
    setStatus('saving');

    try {
      await api.post(`/rsvp/${token}`, buildRSVPPayload(data));
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="card max-w-md mx-auto space-y-8"
    >
      <h2 className="text-2xl font-semibold text-center">
        RSVP for {guest.name}
      </h2>

      {/* Attending */}
      <div className="space-y-3 text-center">
        <p className="font-medium">Will you be attending?</p>

        <div className="flex justify-center gap-10">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="yes"
              {...register('attending')}
              className="accent-[var(--color-primary)]"
            />
            Yes
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="no"
              {...register('attending')}
              className="accent-[var(--color-primary)]"
            />
            No
          </label>
        </div>
      </div>

      {/* Guests */}
      {guest.plus_one_allowed && (
        <div className="form-group">
          <label className="label">Number of guests</label>

          <input
            type="number"
            min={1}
            max={guest.max_guests}
            {...register('guest_count', { valueAsNumber: true })}
            className="input"
          />
        </div>
      )}

      <div className="space-y-3 text-center">
        <p className="font-medium">Will you join us on Sunday?</p>

        <div className="flex justify-center gap-10">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="yes"
              {...register('sunday_event')}
              className="accent-[var(--color-primary)]"
            />
            Yes
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="no"
              {...register('sunday_event')}
              className="accent-[var(--color-primary)]"
            />
            No
          </label>
        </div>
      </div>

      <div className="form-group text-left">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            {...register('hotel_reservation_requested')}
            className="mt-1 accent-[var(--color-primary)]"
          />
          <span>
            <span className="block font-medium">Request help with a hotel reservation</span>
            <span className="block text-sm text-muted-foreground">
              Rooms may be needed for the full weekend or just part of it.
            </span>
          </span>
        </label>
      </div>

      <fieldset className="form-group text-left">
        <legend className="label">Which room nights are you interested in?</legend>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('friday_night')}
              className="accent-[var(--color-primary)]"
            />
            Friday 30 April 2027
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('saturday_night')}
              className="accent-[var(--color-primary)]"
            />
            Saturday 1 May 2027
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('sunday_night')}
              className="accent-[var(--color-primary)]"
            />
            Sunday 2 May 2027
          </label>
        </div>

        <p className="text-sm text-muted-foreground">
          Monday 3 May 2027 is the checkout date for Sunday-night stays.
        </p>
      </fieldset>

      {/* Dietary */}
      <div className="form-group">
        <label className="label">Dietary requirements</label>

        <textarea
          {...register('dietary_requirements')}
          rows={3}
          className="textarea"
        />
      </div>

      {/* Message */}
      <div className="form-group">
        <label className="label">Message</label>

        <textarea
          {...register('message')}
          rows={3}
          className="textarea"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'saving'}
        className="btn btn-primary w-full"
      >
        {status === 'saving' ? 'Submitting...' : 'Submit RSVP'}
      </button>

      {status === 'saved' && (
        <p className="text-sm text-center text-muted-foreground">
          RSVP submitted. Thank you!
        </p>
      )}

      {status === 'error' && (
        <p className="text-sm text-center text-red-700">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
