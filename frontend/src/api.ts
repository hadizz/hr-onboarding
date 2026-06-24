const API_BASE = import.meta.env.VITE_API_URL || '';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  toolCalls?: string[];
}

export interface OnboardingTask {
  id: number;
  title: string;
  due_day: number;
  category: string;
  status: string;
}

export interface OnboardingStatus {
  employee_id: string;
  total_tasks: number;
  completed_tasks: number;
  completion_percent: number;
  tasks: OnboardingTask[];
}

export interface DemoEmployee {
  id: string;
  name: string;
  role: string;
  start_day: number;
  company: string;
}

export async function fetchDemoEmployee(): Promise<DemoEmployee> {
  const res = await fetch(`${API_BASE}/api/employee/demo`);
  return res.json();
}

export async function fetchOnboardingStatus(employeeId: string): Promise<OnboardingStatus> {
  const res = await fetch(`${API_BASE}/api/onboarding/${employeeId}/status`);
  return res.json();
}

export async function completeTask(employeeId: string, taskId: number): Promise<void> {
  await fetch(`${API_BASE}/api/onboarding/${employeeId}/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee_id: employeeId }),
  });
}

export async function resetOnboarding(employeeId: string): Promise<void> {
  await fetch(`${API_BASE}/api/onboarding/${employeeId}/reset`, { method: 'POST' });
}

export async function sendChat(
  message: string,
  employeeId: string,
  history: ChatMessage[],
): Promise<{ response: string; tool_calls: { name: string }[]; citations: string[] }> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      employee_id: employeeId,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function streamChat(
  message: string,
  employeeId: string,
  history: ChatMessage[],
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      employee_id: employeeId,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok || !res.body) throw new Error('Stream failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const lines = part.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) event = line.slice(7);
        if (line.startsWith('data: ')) data = line.slice(6);
      }
      if (data) onEvent(event, JSON.parse(data));
    }
  }
}
