import { useForm } from 'react-hook-form';
import { api } from '../api/client';
import type { Guest } from '../hooks/useGuest';
import { buildRSVPPayload, type RSVPFormData } from './rsvpPayload';
import { useEffect, useRef, useState } from 'react';

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

  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === 'saved') {
      cardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [status]);

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
    <div
      ref={cardRef}
      className="scroll-mt-24 mx-auto w-full max-w-2xl rounded-lg border border-[var(--color-border)] bg-white p-5 text-left shadow-[0_18px_50px_rgba(43,47,56,0.12)] transition-all duration-300 sm:p-8"
    >
      <div
        className={`transition-all duration-300 ${
          status === 'saved' ? 'opacity-100 translate-y-0' : 'opacity-100 translate-y-0'
        }`}
      >
        {status === 'saved' ? (
          <div className="py-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-hover)]">
              RSVP received
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground md:text-3xl">
              Response received, thank you.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Thanks {guest.name}. We have saved your RSVP.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="text-left"
          >
            <div className="mb-8 border-b border-[var(--color-border)] pb-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-hover)]">
                Personal RSVP
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground md:text-3xl">
                RSVP for {guest.name}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                Let us know your plans, guests, and anything we should pass along to the venue.
              </p>
            </div>

            <div className="space-y-8">
              <fieldset className="space-y-3">
                <legend className="text-base font-semibold text-foreground">
                  Will you be attending?
                </legend>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="group cursor-pointer">
                    <input
                      type="radio"
                      value="yes"
                      {...register('attending')}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-16 items-center justify-between rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-foreground transition peer-checked:border-[var(--color-primary-hover)] peer-checked:bg-[var(--color-secondary)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary-hover)]">
                      Yes, I will be there
                      <span className="choice-indicator flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-xs text-transparent transition">
                        ✓
                      </span>
                    </span>
                  </label>

                  <label className="group cursor-pointer">
                    <input
                      type="radio"
                      value="no"
                      {...register('attending')}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-16 items-center justify-between rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-foreground transition peer-checked:border-[var(--color-primary-hover)] peer-checked:bg-[var(--color-secondary)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary-hover)]">
                      Sorry, I cannot make it
                      <span className="choice-indicator flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-xs text-transparent transition">
                        ✓
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>

              {guest.plus_one_allowed && (
                <div className="form-group">
                  <label className="label text-base" htmlFor="guest-count">
                    Number of guests
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Your invitation allows up to {guest.max_guests} guests.
                  </p>
                  <input
                    id="guest-count"
                    type="number"
                    min={1}
                    max={guest.max_guests}
                    {...register('guest_count', { valueAsNumber: true })}
                    className="input h-12 max-w-40 text-base"
                  />
                </div>
              )}

              <fieldset className="space-y-3">
                <legend className="text-base font-semibold text-foreground">
                  Will you join us on Sunday?
                </legend>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      value="yes"
                      {...register('sunday_event')}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-16 items-center justify-between rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-foreground transition peer-checked:border-[var(--color-primary-hover)] peer-checked:bg-[var(--color-secondary)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary-hover)]">
                      Yes, count me in
                      <span className="choice-indicator flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-xs text-transparent transition">
                        ✓
                      </span>
                    </span>
                  </label>

                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      value="no"
                      {...register('sunday_event')}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-16 items-center justify-between rounded-lg border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-foreground transition peer-checked:border-[var(--color-primary-hover)] peer-checked:bg-[var(--color-secondary)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary-hover)]">
                      No Sunday plans
                      <span className="choice-indicator flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] text-xs text-transparent transition">
                        ✓
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>

              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    {...register('hotel_reservation_requested')}
                    className="mt-1 h-5 w-5 accent-[var(--color-primary-hover)]"
                  />
                  <span>
                    <span className="block font-semibold text-foreground">
                      Request help with a hotel reservation
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      Rooms may be needed for the full weekend or just part of it.
                    </span>
                  </span>
                </label>
              </div>

              <fieldset className="form-group">
                <legend className="label text-base">
                  Which room nights are you interested in?
                </legend>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['friday_night', 'Friday', '1 May 2026'],
                    ['saturday_night', 'Saturday', '2 May 2026'],
                    ['sunday_night', 'Sunday', '3 May 2026'],
                  ].map(([fieldName, day, date]) => (
                    <label key={fieldName} className="cursor-pointer">
                      <input
                        type="checkbox"
                        {...register(
                          fieldName as 'friday_night' | 'saturday_night' | 'sunday_night',
                        )}
                        className="peer sr-only"
                      />
                      <span className="block rounded-lg border border-[var(--color-border)] bg-white p-4 transition peer-checked:border-[var(--color-primary-hover)] peer-checked:bg-[var(--color-secondary)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary-hover)]">
                        <span className="block font-semibold text-foreground">{day}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">{date}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <p className="text-sm text-muted-foreground">
                  Monday 4 May 2026 is the checkout date for Sunday-night stays.
                </p>
              </fieldset>

              <div className="form-group">
                <label className="label text-base" htmlFor="dietary-requirements">
                  Dietary requirements
                </label>
                <textarea
                  id="dietary-requirements"
                  {...register('dietary_requirements')}
                  rows={4}
                  className="textarea text-base"
                  placeholder="Allergies, dietary needs, or anything the caterers should know."
                />
              </div>

              <div className="form-group">
                <label className="label text-base" htmlFor="guest-message">
                  Message
                </label>
                <textarea
                  id="guest-message"
                  {...register('message')}
                  rows={4}
                  className="textarea text-base"
                  placeholder="Send us a note, song request, or travel question."
                />
              </div>

              <button
                type="submit"
                disabled={status === 'saving'}
                className="btn btn-primary h-12 w-full text-base"
              >
                {status === 'saving' ? 'Submitting...' : 'Submit RSVP'}
              </button>

              {status === 'error' && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
                  Something went wrong. Please try again.
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
