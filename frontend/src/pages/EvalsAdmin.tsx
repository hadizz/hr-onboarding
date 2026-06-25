import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchEvalResults } from '../api';
import type { EvalReportBundle, EvalScenarioResult } from '../api';

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function PassBadge({ passed }: { passed: boolean }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {passed ? 'PASS' : 'FAIL'}
    </span>
  );
}

function SummaryCard({
  title,
  subtitle,
  report,
  available,
}: {
  title: string;
  subtitle: string;
  report: EvalReportBundle['golden']['report'];
  available: boolean;
}) {
  if (!available || !report) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <p className="mt-3 text-sm italic text-slate-400">No report yet — run evals to generate one.</p>
      </div>
    );
  }

  const rate = report.pass_rate_percent ?? 0;
  const barColor = rate >= 85 ? 'bg-emerald-500' : rate >= 70 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">{title}</p>
      <p className="text-sm text-slate-500">{subtitle}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">
        {report.passed}/{report.total}
        <span className="ml-2 text-lg font-normal text-slate-500">({rate}%)</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-400">Updated {formatTimestamp(report.timestamp)}</p>
    </div>
  );
}

function ScenarioTable({
  rows,
  mode,
}: {
  rows: EvalScenarioResult[];
  mode: 'golden' | 'deepeval';
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm italic text-slate-400">
        No scenario rows in this report. Re-run evals to populate{' '}
        <code className="text-xs">evals/results/</code>.
      </p>
    );
  }

  return (
    <table className="min-w-full text-left text-sm">
      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3 font-medium">Scenario</th>
          <th className="px-4 py-3 font-medium">Status</th>
          <th className="px-4 py-3 font-medium">Details</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-slate-100 align-top last:border-0">
            <td className="px-4 py-3">
              <p className="font-medium text-slate-800">{row.id}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{row.input}</p>
            </td>
            <td className="px-4 py-3">
              <PassBadge passed={Boolean(row.passed)} />
            </td>
            <td className="px-4 py-3 text-slate-600">
              {row.error && <p className="text-red-600">{row.error}</p>}
              {mode === 'golden' && row.checks && (
                <ul className="space-y-1 text-xs">
                  {Object.entries(row.checks).map(([name, ok]) => (
                    <li key={name} className={ok ? 'text-emerald-700' : 'text-red-700'}>
                      {name}: {ok ? 'ok' : 'failed'}
                    </li>
                  ))}
                </ul>
              )}
              {mode === 'deepeval' && row.metrics && (
                <ul className="space-y-1 text-xs">
                  {row.metrics.map((metric) => (
                    <li key={metric.name} className={metric.passed ? 'text-emerald-700' : 'text-red-700'}>
                      {metric.name}: {metric.score ?? '—'} — {metric.reason?.slice(0, 120)}
                    </li>
                  ))}
                </ul>
              )}
              {row.tool_calls && row.tool_calls.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">Tools: {row.tool_calls.join(', ')}</p>
              )}
              {row.response_preview && (
                <p className="mt-2 text-xs text-slate-500 line-clamp-3">{row.response_preview}</p>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function EvalsAdmin() {
  const [data, setData] = useState<EvalReportBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'golden' | 'deepeval'>('golden');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchEvalResults());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load eval results');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const goldenRows = data.golden.report?.results ?? [];
    const deepevalRows = data.deepeval.report?.results ?? [];
    if (goldenRows.length === 0 && deepevalRows.length > 0) {
      setTab('deepeval');
    }
  }, [data]);

  const goldenRows = data?.golden.report?.results ?? [];
  const deepevalRows = data?.deepeval.report?.results ?? [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Admin</p>
            <h1 className="text-xl font-semibold text-slate-900">Eval Results</h1>
            <p className="text-sm text-slate-500">
              Golden harness and DeepEval reports from{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">evals/results/</code>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <Link
              to="/"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Back to chat
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {loading && !data && (
          <p className="text-sm text-slate-500">Loading eval reports…</p>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-medium">{error}</p>
            <p className="mt-1 text-red-600">
              After pulling new code, run:{' '}
              <code className="rounded bg-red-100 px-1">docker-compose up -d --build backend frontend</code>
            </p>
          </div>
        )}

        {data?.golden.available &&
          data.golden.report &&
          data.golden.report.total > 0 &&
          goldenRows.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Golden report has a summary but no scenario rows (stale placeholder). Run{' '}
              <code className="rounded bg-amber-100 px-1">./scripts/run-evals-docker.sh</code> to
              regenerate.
            </div>
          )}

        <div className="grid gap-4 md:grid-cols-2">
          <SummaryCard
            title="Golden harness"
            subtitle="Deterministic checks (tools, keywords, injection)"
            report={data?.golden.report ?? null}
            available={Boolean(data?.golden.available)}
          />
          <SummaryCard
            title="DeepEval"
            subtitle="LLM-as-judge (faithfulness, relevancy, injection rubric)"
            report={data?.deepeval.report ?? null}
            available={Boolean(data?.deepeval.available)}
          />
        </div>

        {data && (
          <p className="text-xs text-slate-400">
            Reading from: {data.results_dir}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200">
            {(['golden', 'deepeval'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-3 text-sm font-medium ${
                  tab === key
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {key === 'golden' ? 'Golden scenarios' : 'DeepEval scenarios'}
              </button>
            ))}
          </div>
          {tab === 'golden' ? (
            <ScenarioTable rows={goldenRows} mode="golden" />
          ) : (
            <ScenarioTable rows={deepevalRows} mode="deepeval" />
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <p className="font-medium text-slate-800">Regenerate reports</p>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
{`./scripts/run-evals-docker.sh
./scripts/run-evals-docker.sh deepeval
./scripts/run-evals-docker.sh --filter prompt_injection`}
          </pre>
        </div>
      </main>
    </div>
  );
}
