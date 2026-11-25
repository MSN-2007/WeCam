const ext = typeof browser !== 'undefined' ? browser : chrome;
const $ = (id) => document.getElementById(id);

function isCamuLeavePage(url) {
  return typeof url === 'string' && /^https:\/\/student\.camu\.in\/v[12]\/leaveManagement/.test(url);
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

const DAY_LABELS = {
  Tue: 'Tuesday',
  Thu: 'Thursday',
};

function updateScheduleDayUI(dayCode) {
  const code = dayCode === 'Thu' ? 'Thu' : 'Tue';
  const label = DAY_LABELS[code];
  if ($('runDay')) $('runDay').value = code;
  if ($('scheduleHeading')) $('scheduleHeading').textContent = `${label} schedule`;
  if ($('scheduleHint')) {
    $('scheduleHint').textContent = `Scheduled run on ${label}; manual run available anytime`;
  }
}

$('runDay')?.addEventListener('change', () => {
  updateScheduleDayUI($('runDay').value);
});

const REPO_RELEASES_URL = 'https://github.com/MSN-2007/WeCam/releases';

function renderLastRunStatus(lastRunResult) {
  const statusEl = $('status');
  if (!statusEl || !lastRunResult) return;

  statusEl.classList.remove('error');
  statusEl.replaceChildren();

  if (lastRunResult.reason === 'dropdown_failed') {
    statusEl.classList.add('error');
    const count = Number(lastRunResult.dropdownFailureCount) || 1;
    if (count > 3) {
      statusEl.append(
        `Dropdown failed to open (${count} failed attempts). CAMU may have updated its UI — please check for the latest updates: `
      );
      const link = document.createElement('a');
      link.href = lastRunResult.repoUrl || REPO_RELEASES_URL;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Check latest updates';
      statusEl.append(link);
    } else {
      statusEl.textContent = `Dropdown failed to open (attempt ${count}/3). Please reload the extension and try again.`;
    }
    return;
  }

  if (lastRunResult.status === 'error' && lastRunResult.message) {
    statusEl.classList.add('error');
    statusEl.textContent = `Failed: ${lastRunResult.message}`;
  }
}

function renderHistory(monthHistory = [], historyMonth = '') {
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

async function load() {
  const { settings = {}, monthHistory = [], historyMonth = '', lastRunResult = null } =
    await ext.storage.local.get(['settings', 'monthHistory', 'historyMonth', 'lastRunResult']);
  applyTheme(settings.theme || 'dark');
  $('enabled').checked = !!settings.enabled;
  updateScheduleDayUI(settings.runDay || 'Tue');
  $('runAt').value = settings.runAt || '09:05';
  if ($('pageVersion')) {
    $('pageVersion').value = settings.pageVersion || 'v2';
  }
  $('fromTime').value = settings.fromTime || '06:00';
  $('toTime').value = settings.toTime || '20:00';

  renderHistory(monthHistory, historyMonth);
  renderLastRunStatus(lastRunResult);
}

ext.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.monthHistory || changes.historyMonth) {
    ext.storage.local.get(['monthHistory', 'historyMonth']).then(({ monthHistory, historyMonth }) => {
      renderHistory(monthHistory, historyMonth);
    });
  }
  if (changes.lastRunResult) {
    renderLastRunStatus(changes.lastRunResult.newValue);
  }
});

$('save').addEventListener('click', async () => {
  $('status').classList.remove('error');
  const runDay = $('runDay')?.value === 'Thu' ? 'Thu' : 'Tue';
  const dayLabel = DAY_LABELS[runDay];
  const runAt = $('runAt').value;
  const [h, m] = runAt.split(':').map(Number);
  if (!runAt || h < 9 || h > 23 || (h === 23 && m > 0)) {
    $('status').textContent = `Choose a ${dayLabel} start time from 09:00 through 23:00.`;
    return;
  }
  if ($('fromTime').value >= $('toTime').value) {
    $('status').textContent = 'End time must be later than start time.';
    return;
  }
  const settings = {
    enabled: $('enabled').checked,
    runDay,
    runAt,
    pageVersion: $('pageVersion')?.value || 'v2',
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
  $('status').classList.remove('error');
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
  $('status').classList.remove('error');
  $('status').textContent = 'Starting background automation…';
  try {
    const { settings = {} } = await ext.storage.local.get('settings');
    const pageVersion = $('pageVersion')?.value || settings.pageVersion || 'v2';
    await ext.storage.local.set({
      settings: {
        ...settings,
        pageVersion,
        fromTime: $('fromTime').value || '06:00',
        toTime: $('toTime').value || '20:00',
      },
    });

    const res = await ext.runtime.sendMessage({ type: 'TRIGGER_BACKGROUND_RUN', manual: true });
    if (res?.ok) {
      $('status').textContent = 'Running in background tab. It will fill, save, and auto-close.';
    } else {
      $('status').textContent = 'Could not start: ' + (res?.message || 'error');
    }
  } catch (e) {
    $('status').textContent = 'Error: ' + e.message;
  } finally {
    button.disabled = false;
  }
});

try {
  await load();
} catch (err) {
  console.error('Failed to initialize popup:', err);
}
