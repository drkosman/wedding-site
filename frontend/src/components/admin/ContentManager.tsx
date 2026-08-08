import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { adminApi, adminHeaders } from '../../api/adminClient';
import { isValidHttpUrl, type ContentEntry, type ContentKind } from '../../api/content';

type FieldKey =
  | 'date'
  | 'time'
  | 'title'
  | 'description'
  | 'location'
  | 'notes'
  | 'address'
  | 'price_notes'
  | 'distance'
  | 'website_url';

type FieldConfig = {
  key: FieldKey;
  label: string;
  type?: 'text' | 'textarea' | 'url';
  placeholder?: string;
};

type ContentManagerProps = {
  secret: string;
  kind: ContentKind;
  title: string;
  fields: FieldConfig[];
};

type ContentEntryForm = Record<FieldKey, string>;

const emptyForm: ContentEntryForm = {
  date: '',
  time: '',
  title: '',
  description: '',
  location: '',
  notes: '',
  address: '',
  price_notes: '',
  distance: '',
  website_url: '',
};

function createForm(entry?: ContentEntry): ContentEntryForm {
  return {
    date: entry?.date ?? '',
    time: entry?.time ?? '',
    title: entry?.title ?? '',
    description: entry?.description ?? '',
    location: entry?.location ?? '',
    notes: entry?.notes ?? '',
    address: entry?.address ?? '',
    price_notes: entry?.price_notes ?? '',
    distance: entry?.distance ?? '',
    website_url: entry?.website_url ?? '',
  };
}

function createPayload(form: ContentEntryForm, sortOrder?: number) {
  return {
    sort_order: sortOrder,
    title: form.title.trim(),
    description: form.description.trim() || null,
    date: form.date.trim() || null,
    time: form.time.trim() || null,
    location: form.location.trim() || null,
    notes: form.notes.trim() || null,
    address: form.address.trim() || null,
    price_notes: form.price_notes.trim() || null,
    distance: form.distance.trim() || null,
    website_url: form.website_url.trim() || null,
  };
}

function validateForm(form: ContentEntryForm) {
  if (!form.title.trim()) {
    return 'Title is required.';
  }

  if (form.website_url.trim() && !isValidHttpUrl(form.website_url.trim())) {
    return 'Website URL must start with http:// or https://.';
  }

  return null;
}

export default function ContentManager({ secret, kind, title, fields }: ContentManagerProps) {
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [newForm, setNewForm] = useState<ContentEntryForm>(() => ({ ...emptyForm }));
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ContentEntryForm>(() => ({ ...emptyForm }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await adminApi.get<ContentEntry[]>(`/content/${kind}`, {
      headers: adminHeaders(secret),
    });
    setEntries(response.data);
  }, [kind, secret]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => setError(`${title} could not be loaded.`))
      .finally(() => setLoading(false));
  }, [refresh, title]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateForm(newForm);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await adminApi.post(`/content/${kind}`, createPayload(newForm), {
        headers: adminHeaders(secret),
      });
      await refresh();
      setNewForm({ ...emptyForm });
      setNotice(`${title} entry added.`);
    } catch {
      setError(`${title} entry could not be added.`);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (entry: ContentEntry) => {
    const validationError = validateForm(editForm);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await adminApi.put(`/content/${kind}/${entry.id}`, createPayload(editForm, entry.sort_order), {
        headers: adminHeaders(secret),
      });
      await refresh();
      setEditId(null);
      setEditForm({ ...emptyForm });
      setNotice(`${title} entry saved.`);
    } catch {
      setError(`${title} entry could not be saved.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: ContentEntry) => {
    if (!window.confirm(`Delete "${entry.title}" from ${title}?`)) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      await adminApi.delete(`/content/${kind}/${entry.id}`, {
        headers: adminHeaders(secret),
      });
      await refresh();
      setNotice(`${title} entry deleted.`);
    } catch {
      setError(`${title} entry could not be deleted.`);
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (entryIndex: number, direction: -1 | 1) => {
    const nextIndex = entryIndex + direction;
    if (nextIndex < 0 || nextIndex >= entries.length) return;

    const reordered = [...entries];
    const [entry] = reordered.splice(entryIndex, 1);
    reordered.splice(nextIndex, 0, entry);
    setEntries(reordered);
    setError(null);
    setNotice(null);

    try {
      const response = await adminApi.put<ContentEntry[]>(
        `/content/${kind}/reorder`,
        { ids: reordered.map((currentEntry) => currentEntry.id) },
        { headers: adminHeaders(secret) },
      );
      setEntries(response.data);
    } catch {
      await refresh();
      setError(`${title} order could not be saved.`);
    }
  };

  const renderFields = (
    form: ContentEntryForm,
    onChange: (key: FieldKey, value: string) => void,
  ) => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        <div
          key={field.key}
          className={`form-group ${field.type === 'textarea' ? 'md:col-span-2 xl:col-span-3' : ''}`}
        >
          <label className="label">{field.label}</label>
          {field.type === 'textarea' ? (
            <textarea
              value={form[field.key]}
              onChange={(event) => onChange(field.key, event.target.value)}
              className="input min-h-24"
              placeholder={field.placeholder}
            />
          ) : (
            <input
              type={field.type === 'url' ? 'url' : 'text'}
              value={form[field.key]}
              onChange={(event) => onChange(field.key, event.target.value)}
              className="input"
              placeholder={field.placeholder}
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? 'Loading entries...' : `${entries.length} entries`}
        </p>
      </div>

      {error && <p className="alert-error">{error}</p>}
      {notice && (
        <p className="alert-success">
          {notice}
        </p>
      )}

      <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
        <h3 className="text-base font-semibold">Add Entry</h3>
        {renderFields(newForm, (key, value) =>
          setNewForm((current) => ({ ...current, [key]: value })),
        )}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Add Entry'}
        </button>
      </form>

      <div className="space-y-3">
        {!loading && entries.length === 0 && (
          <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">No entries yet.</p>
        )}

        {entries.map((entry, index) => {
          const isEditing = editId === entry.id;

          return (
            <article key={entry.id} className="rounded-lg border border-[var(--color-border)] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold">{entry.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[entry.date, entry.time, entry.location, entry.address, entry.distance]
                      .filter(Boolean)
                      .join(' | ') || 'No extra details'}
                  </p>
                  {entry.description && (
                    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{entry.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    className="btn btn-outline px-3 py-2"
                    disabled={index === 0 || saving}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    className="btn btn-outline px-3 py-2"
                    disabled={index === entries.length - 1 || saving}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(isEditing ? null : entry.id);
                      setEditForm(isEditing ? { ...emptyForm } : createForm(entry));
                      setError(null);
                      setNotice(null);
                    }}
                    className="btn btn-secondary px-3 py-2"
                    disabled={saving}
                  >
                    {isEditing ? 'Close' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry)}
                    className="btn btn-danger"
                    disabled={saving}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="mt-5 space-y-4 border-t border-[var(--color-border)] pt-5">
                  {renderFields(editForm, (key, value) =>
                    setEditForm((current) => ({ ...current, [key]: value })),
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleSave(entry)}
                      className="btn btn-primary"
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Entry'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditId(null);
                        setEditForm({ ...emptyForm });
                      }}
                      className="btn btn-secondary"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
