import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { adminApi, adminHeaders } from '../../api/adminClient';
import {
  HOMEPAGE_POSITIONS,
  homepagePositionLabel,
  type HomepageSection,
} from '../../api/homepageSections';

type HomepageSectionForm = {
  title: string;
  subtitle: string;
  content: string;
  position: number;
};

const emptyForm: HomepageSectionForm = {
  title: '',
  subtitle: '',
  content: '',
  position: 6,
};

function createForm(section?: HomepageSection): HomepageSectionForm {
  return {
    title: section?.title ?? '',
    subtitle: section?.subtitle ?? '',
    content: section?.content ?? '',
    position: section?.position ?? 6,
  };
}

function createPayload(form: HomepageSectionForm) {
  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    content: form.content.trim(),
    position: form.position,
  };
}

function validateForm(form: HomepageSectionForm) {
  if (!form.title.trim()) return 'Title is required.';
  if (!form.content.trim()) return 'Content is required.';
  return null;
}

function requestErrorDetail(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg;
  return fallback;
}

type HomepageSectionManagerProps = {
  secret: string;
};

export function HomepageSectionEmptyState() {
  return (
    <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
      No custom homepage sections yet. Use the form above to create the first one.
    </p>
  );
}

export default function HomepageSectionManager({ secret }: HomepageSectionManagerProps) {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [newForm, setNewForm] = useState<HomepageSectionForm>(() => ({ ...emptyForm }));
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<HomepageSectionForm>(() => ({ ...emptyForm }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await adminApi.get<HomepageSection[]>('/homepage-sections', {
      headers: adminHeaders(secret),
    });
    setSections(response.data);
  }, [secret]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => setError('Homepage sections could not be loaded.'))
      .finally(() => setLoading(false));
  }, [refresh]);

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
      await adminApi.post('/homepage-sections', createPayload(newForm), {
        headers: adminHeaders(secret),
      });
      await refresh();
      setNewForm({ ...emptyForm });
      setNotice('Homepage section added.');
    } catch (requestError) {
      setError(requestErrorDetail(requestError, 'Homepage section could not be added.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (section: HomepageSection) => {
    const validationError = validateForm(editForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await adminApi.put(`/homepage-sections/${section.id}`, createPayload(editForm), {
        headers: adminHeaders(secret),
      });
      await refresh();
      setEditId(null);
      setEditForm({ ...emptyForm });
      setNotice('Homepage section saved.');
    } catch (requestError) {
      setError(requestErrorDetail(requestError, 'Homepage section could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (section: HomepageSection) => {
    if (!window.confirm(`Delete the homepage section "${section.title}"?`)) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await adminApi.delete(`/homepage-sections/${section.id}`, {
        headers: adminHeaders(secret),
      });
      await refresh();
      if (editId === section.id) setEditId(null);
      setNotice('Homepage section deleted.');
    } catch (requestError) {
      setError(requestErrorDetail(requestError, 'Homepage section could not be deleted.'));
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (section: HomepageSection, direction: -1 | 1) => {
    const atPosition = sections.filter((item) => item.position === section.position);
    const currentIndex = atPosition.findIndex((item) => item.id === section.id);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= atPosition.length) return;

    const reorderedAtPosition = [...atPosition];
    const [moved] = reorderedAtPosition.splice(currentIndex, 1);
    reorderedAtPosition.splice(nextIndex, 0, moved);
    const orderById = new Map(
      reorderedAtPosition.map((item, index) => [item.id, index]),
    );
    setSections((current) => [...current].sort((left, right) => {
      if (left.position !== right.position) return left.position - right.position;
      return (orderById.get(left.id) ?? left.sort_order)
        - (orderById.get(right.id) ?? right.sort_order);
    }));
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await adminApi.put<HomepageSection[]>('/homepage-sections/reorder', {
        position: section.position,
        ids: reorderedAtPosition.map((item) => item.id),
      }, { headers: adminHeaders(secret) });
      setSections(response.data);
      setNotice('Homepage section order saved.');
    } catch (requestError) {
      await refresh();
      setError(requestErrorDetail(requestError, 'Homepage section order could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const renderForm = (
    form: HomepageSectionForm,
    setForm: (update: (current: HomepageSectionForm) => HomepageSectionForm) => void,
    prefix: string,
  ) => (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="form-group">
        <label className="label" htmlFor={`${prefix}-title`}>Title</label>
        <input
          id={`${prefix}-title`}
          className="input"
          type="text"
          required
          maxLength={160}
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </div>
      <div className="form-group">
        <label className="label" htmlFor={`${prefix}-subtitle`}>Subtitle (optional)</label>
        <input
          id={`${prefix}-subtitle`}
          className="input"
          type="text"
          maxLength={300}
          value={form.subtitle}
          onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))}
        />
      </div>
      <div className="form-group md:col-span-2">
        <label className="label" htmlFor={`${prefix}-position`}>Homepage position</label>
        <select
          id={`${prefix}-position`}
          className="input"
          required
          value={form.position}
          onChange={(event) => setForm((current) => ({
            ...current,
            position: Number(event.target.value),
          }))}
        >
          {HOMEPAGE_POSITIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="form-group md:col-span-2">
        <label className="label" htmlFor={`${prefix}-content`}>Content</label>
        <textarea
          id={`${prefix}-content`}
          className="textarea min-h-40"
          required
          maxLength={10000}
          value={form.content}
          onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
          placeholder="Use blank lines to separate paragraphs."
        />
      </div>
    </div>
  );

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Custom Homepage Sections</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add plain-text sections between the fixed parts of the public homepage.
        </p>
      </div>

      {error && <p className="alert-error">{error}</p>}
      {notice && <p className="alert-success">{notice}</p>}

      <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
        <h3 className="text-base font-semibold">Add Homepage Section</h3>
        {renderForm(newForm, setNewForm, 'new-homepage-section')}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Add Section'}
        </button>
      </form>

      {loading && <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">Loading sections...</p>}
      {!loading && sections.length === 0 && (
        <HomepageSectionEmptyState />
      )}

      <div className="space-y-3">
        {sections.map((section) => {
          const isEditing = editId === section.id;
          const atPosition = sections.filter((item) => item.position === section.position);
          const indexAtPosition = atPosition.findIndex((item) => item.id === section.id);

          return (
            <article key={section.id} className="rounded-lg border border-[var(--color-border)] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-hover)]">
                    {homepagePositionLabel(section.position)}
                  </p>
                  <h3 className="mt-1 text-base font-semibold">{section.title}</h3>
                  {section.subtitle && <p className="mt-1 text-sm">{section.subtitle}</p>}
                  <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-muted-foreground">
                    {section.content}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline px-3 py-2" disabled={indexAtPosition === 0 || saving} onClick={() => handleMove(section, -1)}>Up</button>
                  <button type="button" className="btn btn-outline px-3 py-2" disabled={indexAtPosition === atPosition.length - 1 || saving} onClick={() => handleMove(section, 1)}>Down</button>
                  <button
                    type="button"
                    className="btn btn-secondary px-3 py-2"
                    disabled={saving}
                    onClick={() => {
                      setEditId(isEditing ? null : section.id);
                      setEditForm(isEditing ? { ...emptyForm } : createForm(section));
                      setError(null);
                      setNotice(null);
                    }}
                  >
                    {isEditing ? 'Close' : 'Edit'}
                  </button>
                  <button type="button" className="btn btn-danger" disabled={saving} onClick={() => handleDelete(section)}>Delete</button>
                </div>
              </div>

              {isEditing && (
                <div className="mt-5 space-y-4 border-t border-[var(--color-border)] pt-5">
                  {renderForm(editForm, setEditForm, `edit-homepage-section-${section.id}`)}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn btn-primary" disabled={saving} onClick={() => handleSave(section)}>{saving ? 'Saving...' : 'Save Section'}</button>
                    <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setEditId(null)}>Cancel</button>
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
