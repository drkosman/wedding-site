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
      className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 space-y-6"
    >
      <h2 className="text-2xl font-serif text-center">RSVP for {guest.name}</h2>

      {/* Attending */}
      <div>
        <p className="font-medium mb-2">Will you be attending?</p>

        <div className="flex gap-6 justify-center">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="yes"
              {...register('attending', {
                setValueAs: (v) => v === 'yes',
              })}
            />
            Yes
          </label>

          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="no"
              {...register('attending', {
                setValueAs: (v) => v === 'yes',
              })}
            />
            No
          </label>
        </div>
      </div>

      {/* Guests */}
      {guest.plus_one_allowed && (
        <div>
          <label className="block font-medium mb-2">Number of guests</label>

          <input
            type="number"
            min={1}
            max={guest.max_guests}
            {...register('guest_count', { valueAsNumber: true })}
            className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400"
          />
        </div>
      )}

      {/* Dietary */}
      <div>
        <label className="block font-medium mb-2">Dietary requirements</label>

        <textarea
          {...register('dietary_requirements')}
          rows={3}
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
      </div>

      {/* Message */}
      <div>
        <label className="block font-medium mb-2">Message</label>

        <textarea
          {...register('message')}
          rows={3}
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full bg-neutral-900 text-white py-3 rounded-lg hover:bg-neutral-800 transition"
      >
        Submit RSVP
      </button>
    </form>
  );
}
