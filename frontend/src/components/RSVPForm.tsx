import { useForm } from 'react-hook-form';
import { api } from '../api/client';
import type { Guest } from '../hooks/useGuest';

interface RSVPFormProps {
  guest: Guest;
  token: string;
}

type FormData = {
  attending: boolean;
  guest_count: number;
  dietary_requirements?: string;
  message?: string;
};

export default function RSVPForm({ guest, token }: RSVPFormProps) {
  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: {
      attending: true,
      guest_count: 1,
    },
  });

  const onSubmit = async (data: FormData) => {
    await api.post(`/rsvp/${token}`, data);
    alert('RSVP submitted ❤️');
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
              {...register('attending', {
                setValueAs: (v) => v === 'yes',
              })}
              className="accent-[var(--color-primary)]"
            />
            Yes
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value="no"
              {...register('attending', {
                setValueAs: (v) => v === 'yes',
              })}
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
        className="btn btn-primary w-full"
      >
        Submit RSVP
      </button>
    </form>
  );
}