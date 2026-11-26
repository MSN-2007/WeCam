const ext = typeof browser !== 'undefined' ? browser : chrome;
const $ = (id) => document.getElementById(id);

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
  const code = dayCode === 'Tue' ? 'Tue' : 'Thu';
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
const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/MSN-2007/WeCam/main/manifest.json';
const REMOTE_RELEASE_API_URL = 'https://api.github.com/repos/MSN-2007/WeCam/releases/latest';
const UPDATE_CHECK_TTL_MS = 60 * 60 * 1000; // 1 hour

function compareVersions(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function createExternalLink(url, text) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = text;
  link.addEventListener('click', (e) => {
    if (ext.tabs?.create) {
      e.preventDefault();
      ext.tabs.create({ url });
    }
  });
  return link;
}

function renderUpdateBanner(latestVersion, releaseUrl) {
  const banner = $('updateBanner');
  if (!banner) return;
  const currentVersion = ext.runtime.getManifest?.()?.version || '0.0.0';
  if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
    banner.hidden = true;
    banner.replaceChildren();
    return;
  }
  banner.replaceChildren();
  banner.append(`New update available (v${latestVersion.replace(/^v/i, '')}) — please download the latest version: `);
  banner.append(createExternalLink(releaseUrl || REPO_RELEASES_URL, 'Download update'));
  banner.hidden = false;
}

async function fetchLatestVersion() {
  try {
    const res = await fetch(REMOTE_MANIFEST_URL, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.version) {
        return { latestVersion: String(data.version).trim(), releaseUrl: REPO_RELEASES_URL };
      }
    }
  } catch {
    // Fall back to GitHub Releases API
  }
  try {
    const res = await fetch(REMOTE_RELEASE_API_URL, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.tag_name) {
        return {
          latestVersion: String(data.tag_name).replace(/^v/i, '').trim(),
          releaseUrl: data.html_url || REPO_RELEASES_URL,
        };
      }
    }
  } catch {
    // Ignore offline / network errors silently
  }
  return null;
}

async function checkForUpdates() {
  const { updateCheck = null } = await ext.storage.local.get('updateCheck');
  if (updateCheck?.latestVersion) {
    renderUpdateBanner(updateCheck.latestVersion, updateCheck.releaseUrl);
    if (Date.now() - (updateCheck.checkedAt || 0) < UPDATE_CHECK_TTL_MS) {
      return;
    }
  }
  const fresh = await fetchLatestVersion();
  if (!fresh) return;
  await ext.storage.local.set({
    updateCheck: {
      checkedAt: Date.now(),
      latestVersion: fresh.latestVersion,
      releaseUrl: fresh.releaseUrl,
    },
  });
  renderUpdateBanner(fresh.latestVersion, fresh.releaseUrl);
}

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
      statusEl.append(createExternalLink(lastRunResult.repoUrl || REPO_RELEASES_URL, 'Check latest updates'));
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
  $('enabled').checked = settings.enabled !== undefined ? !!settings.enabled : true;
  updateScheduleDayUI(settings.runDay || 'Thu');
  $('runAt').value = settings.runAt || '09:05';
  if ($('pageVersion')) {
    $('pageVersion').value = settings.pageVersion || 'v2';
  }
  $('fromTime').value = settings.fromTime || '06:00';
  $('toTime').value = settings.toTime || '20:00';

  renderHistory(monthHistory, historyMonth);
  renderLastRunStatus(lastRunResult);
  checkForUpdates().catch(() => {});
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
  const runDay = $('runDay')?.value === 'Tue' ? 'Tue' : 'Thu';
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
