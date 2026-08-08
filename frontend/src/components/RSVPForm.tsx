import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { api } from '../api/client';
import {
  buildRSVPPayload,
  HOTEL_RESERVATION_REQUESTS_ENABLED,
  PUBLIC_MAX_GUESTS,
  type RSVPFormData,
} from './rsvpPayload';
import TurnstileWidget from './TurnstileWidget';


export default function RSVPForm() {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [challengeResetKey, setChallengeResetKey] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<RSVPFormData>({
    defaultValues: {
      full_name: '',
      email: '',
      attending: '',
      guest_count: 1,
      additional_guest_names: '',
      sunday_event: 'no',
      hotel_reservation_requested: false,
      friday_night: false,
      saturday_night: false,
      sunday_night: false,
      dietaries: '',
      message: '',
      website: '',
    },
  });

  const attending = useWatch({ control, name: 'attending' });
  const guestCount = useWatch({ control, name: 'guest_count' });
  const hotelReservationRequested = useWatch({
    control,
    name: 'hotel_reservation_requested',
  });
  const hotelRequested =
    HOTEL_RESERVATION_REQUESTS_ENABLED && hotelReservationRequested;

  useEffect(() => {
    if (status === 'saved') {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [status]);

  const onSubmit = async (data: RSVPFormData) => {
    if (
      HOTEL_RESERVATION_REQUESTS_ENABLED &&
      data.attending === 'yes' &&
      data.hotel_reservation_requested
    ) {
      if (!data.friday_night && !data.saturday_night && !data.sunday_night) {
        setError('root.form', { message: 'Please select at least one requested room night.' });
        return;
      }
    }
    if (!turnstileToken) {
      setError('root.form', { message: 'Please complete the verification challenge.' });
      return;
    }

    setStatus('saving');
    setErrorMessage('');

    try {
      await api.post('/rsvps', buildRSVPPayload(data, turnstileToken));
      setStatus('saved');
    } catch (error) {
      setStatus('error');
      setChallengeResetKey((current) => current + 1);

      if (axios.isAxiosError(error) && error.response?.status === 429) {
        setErrorMessage('Too many attempts were received. Please wait a little and try again.');
      } else if (axios.isAxiosError(error) && error.response?.status === 400) {
        setErrorMessage('Verification failed. Please complete the refreshed challenge and try again.');
      } else if (axios.isAxiosError(error) && error.response?.status === 422) {
        setErrorMessage('Some details were not accepted. Please review the form and try again.');
      } else {
        setErrorMessage('We could not submit your RSVP. Please check your connection and try again.');
      }
    }
  };

  const fieldError = (message?: string) =>
    message ? <p className="field-error mt-1 text-sm">{message}</p> : null;

  return (
    <div
      ref={cardRef}
      className="scroll-mt-24 mx-auto w-full max-w-2xl rounded-lg border border-[var(--color-border)] bg-surface-raised p-5 text-left shadow-[0_18px_50px_rgba(24,61,58,0.13)] sm:p-8"
    >
      {status === 'saved' ? (
        <div className="py-8 text-center" role="status">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-hover)]">
            RSVP received
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-primary-strong md:text-3xl">
            Thank you. Your response has been saved.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            We have everything we need for now. If you need to correct your response, please
            contact Lucy or Kosta; submitting this form again creates a separate response for us
            to reconcile.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-8 border-b border-[var(--color-border)] pb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-hover)]">
              Wedding RSVP
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-primary-strong md:text-3xl">
              Tell us your plans
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Enter your own details exactly as you would like us to recognise them.
            </p>
          </div>

          <div className="space-y-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="form-group">
                <label className="label text-base" htmlFor="full-name">Full name</label>
                <input
                  id="full-name"
                  type="text"
                  autoComplete="name"
                  maxLength={160}
                  className="input h-12 text-base"
                  aria-invalid={Boolean(errors.full_name)}
                  {...register('full_name', {
                    required: 'Please enter your full name.',
                    validate: (value) => value.trim().replace(/\s+/g, ' ').length >= 2 || 'Please enter your full name.',
                  })}
                />
                {fieldError(errors.full_name?.message)}
              </div>

              <div className="form-group">
                <label className="label text-base" htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  className="input h-12 text-base"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email', {
                    required: 'Please enter your email address.',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Please enter a valid email address.',
                    },
                  })}
                />
                {fieldError(errors.email?.message)}
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-base font-semibold text-foreground">
                Will you be attending?
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['yes', 'Yes, I will be there'],
                  ['no', 'Sorry, I cannot make it'],
                ].map(([value, label]) => (
                  <label key={value} className="group cursor-pointer">
                    <input
                      type="radio"
                      value={value}
                      {...register('attending', { required: 'Please select an attendance response.' })}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-16 items-center justify-between rounded-lg border border-[var(--color-border)] bg-surface-raised px-4 py-3 text-sm font-semibold transition peer-checked:border-[var(--color-primary-hover)] peer-checked:bg-[var(--color-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary-strong)]">
                      {label}
                      <span className="choice-indicator flex h-5 w-5 items-center justify-center rounded-full border text-xs text-transparent">✓</span>
                    </span>
                  </label>
                ))}
              </div>
              {fieldError(errors.attending?.message)}
            </fieldset>

            {attending === 'yes' && (
              <>
                <div className="form-group">
                  <label className="label text-base" htmlFor="guest-count">Total number attending</label>
                  <p className="text-sm text-muted-foreground">
                    Include yourself. We will confirm this against the paper invitation list.
                  </p>
                  <input
                    id="guest-count"
                    type="number"
                    min={1}
                    max={PUBLIC_MAX_GUESTS}
                    className="input h-12 max-w-40 text-base"
                    {...register('guest_count', {
                      valueAsNumber: true,
                      min: { value: 1, message: 'At least one guest is required.' },
                      max: { value: PUBLIC_MAX_GUESTS, message: `Please enter no more than ${PUBLIC_MAX_GUESTS} guests.` },
                    })}
                  />
                  {fieldError(errors.guest_count?.message)}
                </div>

                {guestCount > 1 && (
                  <div className="form-group">
                    <label className="label text-base" htmlFor="additional-guests">
                      Names of additional guests
                    </label>
                    <textarea
                      id="additional-guests"
                      rows={3}
                      maxLength={600}
                      className="textarea text-base"
                      placeholder="One name per line"
                      {...register('additional_guest_names', {
                        validate: (value) => value?.trim() ? true : 'Please enter the names of the additional guests.',
                      })}
                    />
                    {fieldError(errors.additional_guest_names?.message)}
                  </div>
                )}

                <fieldset className="space-y-3">
                  <legend className="text-base font-semibold text-foreground">
                    Will you join us on Sunday?
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ['yes', 'Yes, count me in'],
                      ['no', 'No Sunday plans'],
                    ].map(([value, label]) => (
                      <label key={value} className="cursor-pointer">
                        <input type="radio" value={value} {...register('sunday_event')} className="peer sr-only" />
                        <span className="flex min-h-16 items-center justify-between rounded-lg border border-[var(--color-border)] bg-surface-raised px-4 py-3 text-sm font-semibold transition peer-checked:border-[var(--color-primary-hover)] peer-checked:bg-[var(--color-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary-strong)]">
                          {label}
                          <span className="choice-indicator flex h-5 w-5 items-center justify-center rounded-full border text-xs text-transparent">✓</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {HOTEL_RESERVATION_REQUESTS_ENABLED && (
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" {...register('hotel_reservation_requested')} className="mt-1 h-5 w-5 accent-[var(--color-primary-hover)]" />
                      <span>
                        <span className="block font-semibold">Request help with a hotel reservation</span>
                        <span className="mt-1 block text-sm text-muted-foreground">Tell us which nights you need below.</span>
                      </span>
                    </label>
                  </div>
                )}

                {hotelRequested && (
                  <fieldset className="form-group">
                    <legend className="label text-base">Which room nights are you interested in?</legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        ['friday_night', 'Friday', '30 April 2027'],
                        ['saturday_night', 'Saturday', '1 May 2027'],
                        ['sunday_night', 'Sunday', '2 May 2027'],
                      ].map(([fieldName, day, date]) => (
                        <label key={fieldName} className="cursor-pointer">
                          <input
                            type="checkbox"
                            {...register(fieldName as 'friday_night' | 'saturday_night' | 'sunday_night')}
                            className="peer sr-only"
                          />
                          <span className="block rounded-lg border border-[var(--color-border)] bg-surface-raised p-4 transition peer-checked:border-[var(--color-primary-hover)] peer-checked:bg-[var(--color-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary-strong)]">
                            <span className="block font-semibold">{day}</span>
                            <span className="mt-1 block text-sm text-muted-foreground">{date}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">Monday 3 May 2027 is the checkout date for Sunday-night stays.</p>
                  </fieldset>
                )}

                <div className="form-group">
                  <label className="label text-base" htmlFor="dietaries">Dietary requirements</label>
                  <textarea
                    id="dietaries"
                    {...register('dietaries')}
                    rows={4}
                    maxLength={1000}
                    className="textarea text-base"
                    placeholder="Allergies, dietary needs, or anything the caterers should know."
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="label text-base" htmlFor="guest-message">Optional message</label>
              <textarea
                id="guest-message"
                {...register('message')}
                rows={4}
                maxLength={2000}
                className="textarea text-base"
                placeholder="Send us a note, song request, or travel question."
              />
            </div>

            <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
            </div>

            <TurnstileWidget onToken={setTurnstileToken} resetKey={challengeResetKey} />

            {errors.root?.form?.message && (
              <p className="alert-error">
                {errors.root.form.message}
              </p>
            )}
            {status === 'error' && (
              <p className="alert-error text-center" role="alert">
                {errorMessage}
              </p>
            )}

            <button type="submit" disabled={status === 'saving'} className="btn btn-primary btn-cta h-13 w-full text-base tracking-[0.01em]">
              {status === 'saving' ? 'Submitting…' : 'Submit RSVP'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
