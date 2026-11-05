const ext = typeof browser !== 'undefined' ? browser : chrome;
const $ = (id) => document.getElementById(id);

function isCamuLeavePage(url) {
  return (
    typeof url === 'string' &&
    (url.startsWith('https://student.camu.in/v1/leaveManagement') ||
      url.startsWith('https://student.camu.in/v2/leaveManagement'))
  );
}

function applyTheme(theme) {
  const selected = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = selected;
  $('theme').value = selected;
}

$('theme').addEventListener('change', async () => {
  const theme = $('theme').value;
  applyTheme(theme);
  const { settings = {} } = await ext.storage.local.get('settings');
  await ext.storage.local.set({ settings: { ...settings, theme } });
});

async function load() {
  const { settings = {}, monthHistory = [], historyMonth = '', apiTemplate = null } = await ext.storage.local.get([
    'settings',
    'monthHistory',
    'historyMonth',
    'apiTemplate',
  ]);
  applyTheme(settings.theme || 'dark');
  $('enabled').checked = !!settings.enabled;
  $('runAt').value = settings.runAt || '09:05';
  $('pageVersion').value = settings.pageVersion || 'v2';
  $('fromTime').value = settings.fromTime || '06:00';
  $('toTime').value = settings.toTime || '20:00';

  const badge = $('modeBadge');
  const desc = $('modeDesc');
  if (apiTemplate?.url) {
    badge.textContent = 'Native Backend (Direct)';
    badge.className = 'mode-badge native';
    desc.textContent = 'Active: Executes natively in the background without opening browser tabs.';
  } else {
    badge.textContent = 'UI Automation';
    badge.className = 'mode-badge ui';
    desc.textContent = 'Direct backend API will automatically activate as soon as you submit or view a leave form on CAMU.';
  }

  const month = new Date().toISOString().slice(0, 7);
  const rows = historyMonth === month ? monthHistory : [];
  const historyEl = $('history');
  historyEl.replaceChildren();
  if (rows.length) {
    for (const x of rows.slice().reverse()) {
      const row = document.createElement('div');
      const label = document.createElement('span');
      label.textContent = x.label;
      const status = document.createElement('b');
      status.textContent = x.status;
      row.append(label, status);
      historyEl.append(row);
    }
  } else {
    historyEl.textContent = 'No activity this month.';
  }
}

$('save').addEventListener('click', async () => {
  const runAt = $('runAt').value;
  const [h, m] = runAt.split(':').map(Number);
  if (!runAt || h < 9 || h > 23 || (h === 23 && m > 0)) {
    $('status').textContent = 'Choose a Thursday start time from 09:00 through 23:00.';
    return;
  }
  if ($('fromTime').value >= $('toTime').value) {
    $('status').textContent = 'End time must be later than start time.';
    return;
  }
  const settings = {
    enabled: $('enabled').checked,
    runAt,
    pageVersion: $('pageVersion').value || 'v2',
    fromTime: $('fromTime').value,
    toTime: $('toTime').value,
    timezone: 'Asia/Kolkata',
    theme: $('theme').value,
  };
  await ext.storage.local.set({ settings });
  ext.runtime.sendMessage({ type: 'RESCHEDULE' });
  $('status').textContent = 'Settings saved.';
});

async function ensureContentScript(tabId) {
  try {
    const pong = await ext.tabs.sendMessage(tabId, { type: 'PING' });
    if (pong?.ok) return;
  } catch (e) {
    // If PING fails, content script needs injection
  }
  await ext.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

$('test').addEventListener('click', async () => {
  $('status').textContent = 'Checking CAMU page…';
  try {
    const [tab] = await ext.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !isCamuLeavePage(tab.url)) {
      $('status').textContent = 'Open the CAMU Leave Management page (v1 or v2) first.';
      return;
    }
    await ensureContentScript(tab.id);
    const r = await ext.tabs.sendMessage(tab.id, { type: 'DETECT_ONLY' });
    $('status').textContent = r?.message || 'Detection finished.';
  } catch (e) {
    $('status').textContent = 'Could not inspect CAMU page: ' + e.message;
  }
});

$('runNow').addEventListener('click', async () => {
  const button = $('runNow');
  button.disabled = true;
  $('status').textContent = 'Checking execution mode…';
  try {
    const { settings = {}, apiTemplate = null } = await ext.storage.local.get(['settings', 'apiTemplate']);
    if (apiTemplate?.url) {
      $('status').textContent = 'Submitting weekend leave requests directly via native API…';
      const res = await ext.runtime.sendMessage({ type: 'EXECUTE_BACKEND_NOW' });
      if (res?.ok) {
        $('status').textContent = 'Direct backend submission completed: ' + res.message;
        await load();
      } else {
        $('status').textContent = 'Backend submission error: ' + (res?.message || 'unknown error');
      }
      return;
    }

    $('status').textContent = 'Connecting to CAMU tab…';
    const [tab] = await ext.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !isCamuLeavePage(tab.url)) {
      $('status').textContent =
        'Open the CAMU Leave Management page (v1 or v2) in the active tab, then click Run now.';
      return;
    }
    await ext.storage.local.set({
      settings: {
        ...settings,
        pageVersion: $('pageVersion').value || settings.pageVersion || 'v2',
        fromTime: $('fromTime').value || '06:00',
        toTime: $('toTime').value || '20:00',
      },
    });
    await ensureContentScript(tab.id);
    const response = await ext.tabs.sendMessage(tab.id, { type: 'RUN_MANUAL' });
    $('status').textContent = response?.message || 'Run request sent. Keep the CAMU tab open.';
  } catch (e) {
    $('status').textContent = 'Could not connect to CAMU: ' + e.message + '. Refresh CAMU and try again.';
  } finally {
    button.disabled = false;
  }
});

load().catch((err) => {
  console.error('Failed to initialize popup:', err);
});
