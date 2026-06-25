(function () {
  if (window.__onboardaiSidebarInit) return;
  window.__onboardaiSidebarInit = true;

  const API_BASE = window.ONBOARDAI_API_BASE || 'https://hr-api.xpotify.cc';
  const EMPLOYEE_ID = window.ONBOARDAI_EMPLOYEE_ID || 'alex-chen';
  const POLL_MS = 15000;

  const CATEGORY_CLASS = {
    HR: 'hr',
    IT: 'it',
    Team: 'team',
  };

  function badgeClass(category) {
    return CATEGORY_CLASS[category] || 'team';
  }

  async function fetchStatus() {
    const res = await fetch(`${API_BASE}/api/onboarding/${EMPLOYEE_ID}/status`);
    if (!res.ok) throw new Error('Failed to load tasks');
    return res.json();
  }

  async function completeTask(taskId) {
    await fetch(`${API_BASE}/api/onboarding/${EMPLOYEE_ID}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: EMPLOYEE_ID }),
    });
  }

  function renderTasks(listEl, status) {
    listEl.innerHTML = '';

    if (!status.tasks.length) {
      const empty = document.createElement('li');
      empty.className = 'oa-empty';
      empty.textContent = 'No tasks yet — ask what to do this week!';
      listEl.appendChild(empty);
      return;
    }

    for (const task of status.tasks) {
      const li = document.createElement('li');
      li.className = `oa-task${task.status === 'completed' ? ' done' : ''}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.status === 'completed';
      checkbox.addEventListener('change', async () => {
        if (!checkbox.checked) return;
        try {
          await completeTask(task.id);
          await refresh();
        } catch (err) {
          console.error(err);
          checkbox.checked = false;
        }
      });

      const body = document.createElement('div');
      const title = document.createElement('p');
      title.className = 'oa-task-title';
      title.textContent = task.title;

      const meta = document.createElement('div');
      meta.className = 'oa-task-meta';

      const badge = document.createElement('span');
      badge.className = `oa-badge ${badgeClass(task.category)}`;
      badge.textContent = task.category;

      const due = document.createElement('span');
      due.className = 'oa-due';
      due.textContent = `Day ${task.due_day}`;

      meta.appendChild(badge);
      meta.appendChild(due);
      body.appendChild(title);
      body.appendChild(meta);

      li.appendChild(checkbox);
      li.appendChild(body);
      listEl.appendChild(li);
    }
  }

  function mountSidebar() {
    if (document.getElementById('onboardai-sidebar')) return;

    document.documentElement.classList.add('onboardai-tasks-enabled');

    const sidebar = document.createElement('aside');
    sidebar.id = 'onboardai-sidebar';
    sidebar.innerHTML = `
      <div class="oa-header">
        <h2 class="oa-title">Onboarding Progress</h2>
        <p class="oa-subtitle">Alex Chen · Software Engineer · Day 1</p>
      </div>
      <div class="oa-progress-wrap">
        <div class="oa-progress-row">
          <span>Completion</span>
          <strong id="oa-percent">0%</strong>
        </div>
        <div class="oa-progress-bar">
          <div class="oa-progress-fill" id="oa-progress-fill" style="width:0%"></div>
        </div>
        <p class="oa-subtitle" id="oa-count" style="margin-top:0.5rem">0 of 0 tasks done</p>
      </div>
      <ul class="oa-task-list" id="oa-task-list"></ul>
      <div class="oa-footer">Tasks update when the agent creates or completes items.</div>
    `;

    document.body.appendChild(sidebar);
  }

  async function refresh() {
    mountSidebar();
    const percentEl = document.getElementById('oa-percent');
    const fillEl = document.getElementById('oa-progress-fill');
    const countEl = document.getElementById('oa-count');
    const listEl = document.getElementById('oa-task-list');
    if (!listEl) return;

    try {
      const status = await fetchStatus();
      const pct = status.completion_percent ?? 0;
      if (percentEl) percentEl.textContent = `${pct}%`;
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (countEl) {
        countEl.textContent = `${status.completed_tasks} of ${status.total_tasks} tasks done`;
      }
      renderTasks(listEl, status);
    } catch (err) {
      console.error('OnboardAI sidebar:', err);
      listEl.innerHTML = '<li class="oa-empty">Could not load tasks.</li>';
    }
  }

  function boot() {
    mountSidebar();
    refresh();
    setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
