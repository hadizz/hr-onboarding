import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  completeTask,
  fetchDemoEmployee,
  fetchOnboardingStatus,
  resetOnboarding,
  streamChat,
} from '../api';
import type { ChatMessage, DemoEmployee, OnboardingStatus } from '../api';

const CATEGORY_COLORS: Record<string, string> = {
  HR: 'bg-purple-100 text-purple-800',
  IT: 'bg-blue-100 text-blue-800',
  Team: 'bg-green-100 text-green-800',
};

const SUGGESTIONS = [
  "What's the remote work policy?",
  'I just started today — what should I do this week?',
  'When do I need to enroll in health insurance?',
];

function ToolCallBadge({ name }: { name: string }) {
  const label = name.replace(/_tool$/, '').replace(/_/g, ' ');
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800 border border-amber-200">
      {label}
    </span>
  );
}

export default function ChatPage() {
  const [employee, setEmployee] = useState<DemoEmployee | null>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const refreshStatus = useCallback(async (employeeId: string) => {
    const data = await fetchOnboardingStatus(employeeId);
    setStatus(data);
  }, []);

  useEffect(() => {
    fetchDemoEmployee().then(setEmployee).catch(console.error);
  }, []);

  useEffect(() => {
    if (employee) refreshStatus(employee.id);
  }, [employee, refreshStatus]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || !employee || loading) return;

    setInput('');
    setError(null);
    setLoading(true);

    const userMsg: ChatMessage = { role: 'user', content: message };
    setMessages((prev) => [...prev, userMsg]);

    let assistantContent = '';
    let citations: string[] = [];
    let toolCalls: string[] = [];

    try {
      await streamChat(message, employee.id, messages, (event, data) => {
        if (event === 'token') {
          assistantContent += data as string;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') {
              next[next.length - 1] = { ...last, content: assistantContent, citations, toolCalls };
            } else {
              next.push({ role: 'assistant', content: assistantContent, citations, toolCalls });
            }
            return next;
          });
        }
        if (event === 'citations') citations = data as string[];
        if (event === 'tool_calls') {
          toolCalls = (data as { name: string }[]).map((t) => t.name);
        }
        if (event === 'done') {
          assistantContent = data as string;
        }
        if (event === 'error') {
          throw new Error((data as { message: string }).message);
        }
      });

      setMessages((prev) => {
        const next = [...prev];
        const idx = next.findIndex((m, i) => m.role === 'assistant' && i === next.length - 1);
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: assistantContent,
          citations,
          toolCalls,
        };
        if (idx >= 0) next[idx] = assistantMsg;
        else next.push(assistantMsg);
        return next;
      });

      await refreshStatus(employee.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (taskId: number) => {
    if (!employee) return;
    await completeTask(employee.id, taskId);
    await refreshStatus(employee.id);
  };

  const handleReset = async () => {
    if (!employee) return;
    await resetOnboarding(employee.id);
    setMessages([]);
    await refreshStatus(employee.id);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">OnboardAI</h1>
            <p className="text-sm text-slate-500">Autonomous HR Onboarding Agent</p>
          </div>
          <div className="flex items-center gap-6">
            <Link
              to="/admin/checkins"
              className="text-sm text-slate-500 hover:text-indigo-600"
            >
              Admin · Check-ins
            </Link>
            {employee && (
              <div className="text-right text-sm">
                <p className="font-medium">{employee.name}</p>
                <p className="text-slate-500">
                  {employee.role} · Day {employee.start_day} · {employee.company}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-3">
        <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2 min-h-[70vh] max-h-[70vh]">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="rounded-lg bg-slate-50 p-6 text-center">
                <p className="text-slate-600 mb-4">
                  Ask about policies, benefits, or IT setup — or tell me you just started and I&apos;ll
                  create your onboarding plan.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.toolCalls.map((t) => (
                        <ToolCallBadge key={t} name={t} />
                      ))}
                    </div>
                  )}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.citations.map((c) => (
                        <span
                          key={c}
                          className="rounded bg-white/80 px-2 py-0.5 text-xs text-indigo-700 border border-indigo-200"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {error && (
            <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            className="border-t border-slate-200 p-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about onboarding or company policies..."
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Onboarding Progress</h2>
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Reset
            </button>
          </div>

          {status && (
            <>
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-600">Completion</span>
                  <span className="font-medium">{status.completion_percent}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-indigo-600 transition-all"
                    style={{ width: `${status.completion_percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {status.completed_tasks} of {status.total_tasks} tasks done
                </p>
              </div>

              <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
                {status.tasks.length === 0 && (
                  <li className="text-sm text-slate-400 italic">
                    No tasks yet — ask what to do this week!
                  </li>
                )}
                {status.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-100 p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={() => handleComplete(task.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={
                          task.status === 'completed'
                            ? 'line-through text-slate-400'
                            : 'text-slate-800'
                        }
                      >
                        {task.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            CATEGORY_COLORS[task.category] || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {task.category}
                        </span>
                        <span className="text-xs text-slate-400">Day {task.due_day}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
