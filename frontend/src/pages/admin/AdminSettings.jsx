import { useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView } from '../../components/ui/states.jsx';
import { SectionHead, Button, Pill } from '../../components/ui/primitives.jsx';

/*
 * Tournament settings. Event metadata and the match rules that drive scoring,
 * plus the publish gate that makes the tournament visible to spectators. Dates
 * bind to date inputs and convert to ISO on save; empty fields save as null
 * rather than an invalid date.
 */

const inputCls = 'w-full border border-rule bg-paper px-2.5 py-2 text-sm text-ink outline-none transition focus:border-ink';
const inputStyle = { borderRadius: 'var(--radius-xs)' };

export default function AdminSettings() {
  const query = useApi(() => adminService.getTournament(), []);

  return (
    <div className="space-y-8">
      <SectionHead kicker="Configuration" title="Settings" />
      <AsyncView query={query} label="Loading settings">
        {(data) => <SettingsForm tournament={data.tournament} refetch={() => query.refetch({ quiet: true })} />}
      </AsyncView>
    </div>
  );
}

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function SettingsForm({ tournament, refetch }) {
  const t = tournament || {};
  const rules = t.rules || {};
  const [form, setForm] = useState({
    name: t.name || '',
    subtitle: t.subtitle || '',
    venue: t.venue || '',
    startDate: toDateInput(t.startDate),
    endDate: toDateInput(t.endDate),
    startTimeNote: t.startTimeNote || '',
    timezone: t.timezone || 'Asia/Kolkata',
    bestOf: rules.bestOf ?? 3,
    pointsPerSet: rules.pointsPerSet ?? 25,
    pointsFinalSet: rules.pointsFinalSet ?? 15,
    winBy: rules.winBy ?? 2,
  });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [openScoring, setOpenScoring] = useState(Boolean(t.openScoring));
  const [scoringBusy, setScoringBusy] = useState(false);

  async function onToggleOpenScoring() {
    const next = !openScoring;
    setScoringBusy(true);
    setError(null);
    try {
      const res = await adminService.setOpenScoring(next);
      setOpenScoring(Boolean(res.openScoring));
      await refetch();
    } catch (err) {
      setError(err?.message || 'Could not change scoring access.');
    } finally {
      setScoringBusy(false);
    }
  }

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function onSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await adminService.saveTournament({
        name: form.name.trim(),
        subtitle: form.subtitle.trim() || null,
        venue: form.venue.trim() || null,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        startTimeNote: form.startTimeNote.trim() || null,
        timezone: form.timezone.trim() || 'Asia/Kolkata',
        rules: {
          bestOf: Number(form.bestOf),
          pointsPerSet: Number(form.pointsPerSet),
          pointsFinalSet: Number(form.pointsFinalSet),
          winBy: Number(form.winBy),
        },
      });
      setSaved(true);
      await refetch();
    } catch (err) {
      setError(err?.message || 'Could not save the tournament.');
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    if (!window.confirm('Publish the tournament? Public pages will surface it to spectators.')) return;
    setPublishing(true);
    setError(null);
    try {
      await adminService.publish();
      await refetch();
    } catch (err) {
      setError(err?.message || 'Could not publish the tournament.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Status + publish */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-rule bg-surface px-4 py-3" style={{ borderRadius: 'var(--radius-sm)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Status</span>
          <Pill tone={t.status === 'PUBLISHED' ? 'green' : 'muted'}>{t.status || 'DRAFT'}</Pill>
        </div>
        <Button variant="ink" onClick={onPublish} disabled={publishing}>
          {publishing ? 'Publishing…' : 'Publish tournament'}
        </Button>
      </div>

      {/* Scoring access */}
      <div className="border border-rule bg-surface p-4" style={{ borderRadius: 'var(--radius-sm)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-green">Scoring access</span>
              <Pill tone={openScoring ? 'green' : 'muted'}>{openScoring ? 'Open' : 'Assigned only'}</Pill>
            </div>
            <p className="text-sm text-muted">
              {openScoring
                ? 'Any scorer can open and score any match. Per-match assignment is ignored while this is on — best when a single scorer covers the whole event.'
                : 'Scorers can only open matches assigned to them. Turn on open scoring to let any scorer score any match.'}
            </p>
          </div>
          <Button variant={openScoring ? 'quiet' : 'ink'} onClick={onToggleOpenScoring} disabled={scoringBusy}>
            {scoringBusy ? 'Saving…' : openScoring ? 'Switch to assigned only' : 'Enable open scoring'}
          </Button>
        </div>
      </div>

      <form onSubmit={onSave} className="space-y-8">
        {/* Event details */}
        <fieldset className="border border-rule bg-surface p-4" style={{ borderRadius: 'var(--radius-sm)' }}>
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-green">Event</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="s-name">
              <input id="s-name" required value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Subtitle" htmlFor="s-sub">
              <input id="s-sub" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Venue" htmlFor="s-venue">
              <input id="s-venue" value={form.venue} onChange={(e) => set('venue', e.target.value)} className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Start time note" htmlFor="s-note">
              <input id="s-note" value={form.startTimeNote} onChange={(e) => set('startTimeNote', e.target.value)} className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Start date" htmlFor="s-start">
              <input id="s-start" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className={`tnum ${inputCls}`} style={inputStyle} />
            </Field>
            <Field label="End date" htmlFor="s-end">
              <input id="s-end" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className={`tnum ${inputCls}`} style={inputStyle} />
            </Field>
            <Field label="Timezone" htmlFor="s-tz">
              <input id="s-tz" value={form.timezone} onChange={(e) => set('timezone', e.target.value)} className={inputCls} style={inputStyle} />
            </Field>
          </div>
        </fieldset>

        {/* Rules */}
        <fieldset className="border border-rule bg-surface p-4" style={{ borderRadius: 'var(--radius-sm)' }}>
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-green">Match rules</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Best of" htmlFor="s-bestof">
              <input id="s-bestof" type="number" min={1} value={form.bestOf} onChange={(e) => set('bestOf', e.target.value)} className={`tnum ${inputCls}`} style={inputStyle} />
            </Field>
            <Field label="Points / set" htmlFor="s-pps">
              <input id="s-pps" type="number" min={1} value={form.pointsPerSet} onChange={(e) => set('pointsPerSet', e.target.value)} className={`tnum ${inputCls}`} style={inputStyle} />
            </Field>
            <Field label="Points final set" htmlFor="s-pfs">
              <input id="s-pfs" type="number" min={1} value={form.pointsFinalSet} onChange={(e) => set('pointsFinalSet', e.target.value)} className={`tnum ${inputCls}`} style={inputStyle} />
            </Field>
            <Field label="Win by" htmlFor="s-winby">
              <input id="s-winby" type="number" min={1} value={form.winBy} onChange={(e) => set('winBy', e.target.value)} className={`tnum ${inputCls}`} style={inputStyle} />
            </Field>
          </div>
        </fieldset>

        {error && <p className="text-sm text-scoreRed">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button>
          {saved && <span className="text-sm text-green">Saved.</span>}
        </div>
      </form>
    </div>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wider text-muted">{label}</label>
      {children}
    </div>
  );
}
