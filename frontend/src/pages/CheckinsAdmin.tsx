import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCheckins } from '../api';
import type { Checkin } from '../api';

function formatScheduledAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function CheckinsAdmin() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCheckins = useCallback(async (filter?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCheckins(filter);
      setCheckins(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load check-ins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCheckins(appliedFilter);
  }, [appliedFilter, loadCheckins]);

  const handleRefresh = () => {
    const filter = employeeFilter.trim() || undefined;
    setAppliedFilter(filter);
    if (filter === appliedFilter) {
      loadCheckins(filter);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Admin</p>
            <h1 className="text-xl font-semibold text-slate-900">Scheduled Check-ins</h1>
            <p className="text-sm text-slate-500">
              Manager and HR check-ins created by the onboarding agent
            </p>
          </div>
          <Link
            to="/"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to chat
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="employee-filter" className="mb-1 block text-xs font-medium text-slate-500">
              Filter by employee ID
            </label>
            <input
              id="employee-filter"
              type="text"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              placeholder="e.g. alex-chen"
              className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <p className="text-sm text-slate-500">
            {checkins.length} check-in{checkins.length === 1 ? '' : 's'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Day</th>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">Scheduled at</th>
              </tr>
            </thead>
            <tbody>
              {!loading && checkins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400 italic">
                    No check-ins yet. Ask the agent to schedule one — e.g. &quot;Schedule a check-in
                    with my manager on day 7 to discuss goals.&quot;
                  </td>
                </tr>
              )}
              {checkins.map((checkin) => (
                <tr key={checkin.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-500">{checkin.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{checkin.employee_id}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      Day {checkin.day}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{checkin.topic}</td>
                  <td className="px-4 py-3 text-slate-500">{formatScheduledAt(checkin.scheduled_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
