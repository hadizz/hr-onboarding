import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  completeTask,
  fetchDemoEmployee,
  fetchOnboardingStatus,
  resetOnboarding,
  streamChat,
} from '../api';
import type { AgentEvent, ChatMessage, DemoEmployee, OnboardingStatus } from '../api';
import ChatMarkdown from '../components/ChatMarkdown';
import { useTheme } from '../ThemeContext';

// ─── Icons ────────────────────────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13M22 2 15 22 11 13 2 9l20-7z" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ToolIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-1 px-4 py-3"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </motion.div>
  );
}

function ToolCallBadge({ name }: { name: string }) {
  const label = name.replace(/_tool$/, '').replace(/_/g, ' ');
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium
        bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50"
    >
      <ToolIcon />
      {label}
    </motion.span>
  );
}

function CitationChip({ text }: { text: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium
        bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/50"
    >
      {text}
    </motion.span>
  );
}

function StreamingText({ text, active }: { text: string; active: boolean }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!active) {
      setDisplayed(text);
      return;
    }
    if (displayed.length >= text.length) return;
    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 3));
    }, 12);
    return () => clearTimeout(timer);
  }, [text, displayed, active]);

  return (
    <span className={active && displayed.length < text.length ? 'streaming-cursor' : ''}>
      <ChatMarkdown content={displayed} />
    </span>
  );
}

// ─── Agent Flow Panel ──────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  started: 'bg-zinc-400 dark:bg-zinc-500',
  completed: 'bg-emerald-500',
  tool: 'bg-amber-500',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  started: <ArrowRightIcon />,
  completed: <CheckIcon size={10} />,
  tool: <ToolIcon />,
};

function AgentFlowPanel({ entries }: { entries: AgentEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="px-4 pt-4 pb-3 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-3">
          Agent flow
        </p>
        <div className="space-y-0 max-h-44 overflow-y-auto">
          {entries.map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2.5 relative"
            >
              {/* Timeline line */}
              {i < entries.length - 1 && (
                <div className="absolute left-[7px] top-[18px] w-px h-full bg-zinc-200 dark:bg-zinc-800" />
              )}
              {/* Dot */}
              <div className={`relative z-10 mt-1 shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white ${STATUS_DOT[entry.status] ?? 'bg-zinc-300'}`}>
                {entry.status === 'started' && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-zinc-400 dark:bg-zinc-500"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                )}
                <span className="relative z-10 text-white">
                  {STATUS_ICON[entry.status]}
                </span>
              </div>
              {/* Content */}
              <div className="pb-3 min-w-0">
                <p className="text-xs leading-tight font-mono">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {entry.agent.charAt(0).toUpperCase() + entry.agent.slice(1)}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-600"> · </span>
                  <span className="text-zinc-500 dark:text-zinc-400 wrap-break-word">
                    {entry.detail}
                  </span>
                </p>
              </div>
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Onboarding Progress ───────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, string> = {
  HR:   'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  IT:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  Team: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
};

function CircularProgress({ percent }: { percent: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;

  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5"
          className="stroke-zinc-100 dark:stroke-zinc-800" />
        <motion.circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="5"
          strokeLinecap="round"
          className="stroke-violet-500 dark:stroke-violet-400"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{percent}%</span>
      </div>
    </div>
  );
}

function OnboardingProgress({
  status,
  onComplete,
  onReset,
}: {
  status: OnboardingStatus | null;
  onComplete: (id: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Progress</h2>
        <button
          onClick={onReset}
          className="text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
        >
          reset
        </button>
      </div>

      {status && (
        <>
          <div className="flex items-center gap-4">
            <CircularProgress percent={status.completion_percent} />
            <div>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {status.completed_tasks} / {status.total_tasks}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">tasks done</p>
            </div>
          </div>

          <div className="space-y-1.5 max-h-[calc(100vh-420px)] overflow-y-auto -mx-1 px-1">
            {status.tasks.length === 0 && (
              <p className="text-xs text-zinc-400 dark:text-zinc-600 italic py-2">
                No tasks yet — ask what to do this week!
              </p>
            )}
            <AnimatePresence>
              {status.tasks.map((task) => (
                <motion.button
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onComplete(task.id)}
                  className="w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left
                    border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800
                    hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all group"
                >
                  <div className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-colors
                    ${task.status === 'completed'
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-zinc-300 dark:border-zinc-700 group-hover:border-violet-400 dark:group-hover:border-violet-600'
                    }`}
                  >
                    {task.status === 'completed' && <CheckIcon size={9} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${
                      task.status === 'completed'
                        ? 'line-through text-zinc-400 dark:text-zinc-600'
                        : 'text-zinc-700 dark:text-zinc-300'
                    }`}>
                      {task.title}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-px text-[10px] font-medium ${
                        CATEGORY_STYLES[task.category] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {task.category}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                        Day {task.due_day}
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Chat Message ──────────────────────────────────────────────────────────────

function ChatMessageBubble({
  msg,
  isStreaming,
}: {
  msg: ChatMessage;
  isStreaming: boolean;
}) {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? 'bg-violet-600 text-white rounded-br-sm'
          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-sm'
      }`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <StreamingText text={msg.content} active={isStreaming} />
        )}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {msg.toolCalls.map((t) => <ToolCallBadge key={t} name={t} />)}
          </div>
        )}
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {msg.citations.map((c) => <CitationChip key={c} text={c} />)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What's the remote work policy?",
  'I just started today — what should I do this week?',
  'When do I need to enroll in health insurance?',
];

function EmptyState({ onSuggest }: { onSuggest: (s: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full gap-6 pb-8"
    >
      <div className="text-center">
        <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center mx-auto mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600 dark:text-violet-400">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
          Ask about policies, benefits, or IT setup — or tell me you just started.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => onSuggest(s)}
            className="text-left px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800
              bg-white dark:bg-zinc-900 text-sm text-zinc-700 dark:text-zinc-300
              hover:border-violet-300 dark:hover:border-violet-700
              hover:bg-violet-50 dark:hover:bg-violet-900/20
              transition-all"
          >
            {s}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { theme, toggle } = useTheme();
  const [employee, setEmployee] = useState<DemoEmployee | null>(null);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentLog, setAgentLog] = useState<AgentEvent[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    setAgentLog([]);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.focus();
    }

    const userMsg: ChatMessage = { role: 'user', content: message };
    setMessages((prev) => [...prev, userMsg]);

    let assistantContent = '';
    let citations: string[] = [];
    let toolCalls: string[] = [];
    let agentEvents: AgentEvent[] = [];

    try {
      await streamChat(message, employee.id, messages, (event, data) => {
        if (event === 'token') {
          assistantContent += data as string;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === 'assistant') {
              next[next.length - 1] = { ...last, content: assistantContent, citations, toolCalls, agentEvents };
            } else {
              next.push({ role: 'assistant', content: assistantContent, citations, toolCalls, agentEvents });
            }
            return next;
          });
        }
        if (event === 'citations') citations = data as string[];
        if (event === 'tool_calls') {
          toolCalls = (data as { name: string }[]).map((t) => t.name);
        }
        if (event === 'agent_log') {
          const entry = data as AgentEvent;
          setAgentLog((prev) => [...prev, entry]);
          agentEvents = [...agentEvents, entry];
        }
        if (event === 'agent_events') {
          agentEvents = data as AgentEvent[];
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
        const assistantMsg: ChatMessage = { role: 'assistant', content: assistantContent, citations, toolCalls, agentEvents };
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
    setAgentLog([]);
    await refreshStatus(employee.id);
  };

  const showThinking =
    loading &&
    (messages.length === 0 ||
      messages[messages.length - 1]?.role === 'user' ||
      (messages[messages.length - 1]?.role === 'assistant' &&
        !messages[messages.length - 1]?.content));

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 h-14 flex items-center justify-between px-5 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">OnboardAI</span>
            {employee && (
              <span className="hidden sm:inline text-xs text-zinc-400 dark:text-zinc-600 ml-2">
                {employee.name} · {employee.role}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/admin/checkins" className="hidden sm:block text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
            Check-ins
          </Link>
          <Link to="/admin/evals" className="hidden sm:block text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
            Evals
          </Link>
          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800" />
          <motion.button
            onClick={toggle}
            whileTap={{ scale: 0.88 }}
            className="w-8 h-8 rounded-lg flex items-center justify-center
              text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={theme}
                initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
                transition={{ duration: 0.18 }}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Chat column */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <AnimatePresence initial={false}>
              {messages.length === 0 && !loading && (
                <EmptyState key="empty" onSuggest={handleSend} />
              )}

              {messages.map((msg, i) => {
                if (msg.role === 'assistant' && !msg.content && loading) return null;
                const isStreaming = loading && i === messages.length - 1 && msg.role === 'assistant';
                return (
                  <ChatMessageBubble
                    key={i}
                    msg={msg}
                    isStreaming={isStreaming}
                  />
                );
              })}

              {showThinking && (
                <motion.div key="thinking" className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-zinc-100 dark:bg-zinc-800">
                    <ThinkingDots />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={chatEndRef} />
          </div>

          {/* Agent flow (inline, above input) */}
          <AnimatePresence>
            {agentLog.length > 0 && (
              <AgentFlowPanel key="agentflow" entries={agentLog} />
            )}
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="mx-4 mb-2 px-3 py-2 rounded-lg text-xs
                  bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400
                  border border-red-200 dark:border-red-900/60"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="shrink-0 p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2 items-end max-w-3xl mx-auto"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask about onboarding or company policies…"
                disabled={loading}
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-2.5 text-sm
                  placeholder:text-zinc-400 dark:placeholder:text-zinc-600
                  text-zinc-900 dark:text-zinc-100
                  border border-transparent focus:border-violet-400 dark:focus:border-violet-600
                  focus:outline-none transition-colors resize-none overflow-y-auto leading-relaxed"
                style={{ minHeight: '42px', maxHeight: '200px' }}
              />
              <motion.button
                type="submit"
                disabled={loading || !input.trim()}
                whileTap={{ scale: 0.9 }}
                className="shrink-0 w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-700
                  disabled:opacity-40 disabled:cursor-not-allowed
                  flex items-center justify-center text-white transition-colors"
              >
                {loading ? (
                  <motion.div
                    className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  />
                ) : (
                  <SendIcon />
                )}
              </motion.button>
            </form>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto p-4">
          <OnboardingProgress
            status={status}
            onComplete={handleComplete}
            onReset={handleReset}
          />
        </aside>
      </div>
    </div>
  );
}
