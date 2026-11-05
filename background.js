const ext = typeof browser !== 'undefined' ? browser : chrome;
const ALARM = 'camu-autopass-check';
const PAGES = {
  v1: 'https://student.camu.in/v1/leaveManagement',
  v2: 'https://student.camu.in/v2/leaveManagement',
};
const pageUrl = (settings) => PAGES[settings?.pageVersion] || PAGES.v2;
const TZ = 'Asia/Kolkata';

const localParts = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .reduce((o, p) => {
      o[p.type] = p.value;
      return o;
    }, {});

function thursdayDateKey(p) {
  return `${p.year}-${p.month}-${p.day}`;
}

async function ensureAlarm() {
  await ext.alarms.clear(ALARM);
  ext.alarms.create(ALARM, { periodInMinutes: 1 });
}

ext.runtime.onInstalled.addListener(ensureAlarm);
ext.runtime.onStartup.addListener(ensureAlarm);

function upcomingWeekendDates() {
  const now = new Date();
  const kolkataNow = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  const daysUntilFriday = (5 - kolkataNow.getDay() + 7) % 7 || 7;
  kolkataNow.setDate(kolkataNow.getDate() + daysUntilFriday);

  const dates = [];
  for (let offset = 0; offset < 3; offset++) {
    const d = new Date(kolkataNow);
    d.setDate(kolkataNow.getDate() + offset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}

function substitutePayloadDates(rawBody, dayIso) {
  if (!rawBody) return rawBody;
  const [y, m, d] = dayIso.split('-');
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1];
  const dMonY = `${d}-${mon}-${y}`;
  const dMY = `${d}/${m}/${y}`;

  try {
    const parsed = JSON.parse(rawBody);
    const replaceInObj = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') {
          if (/^\d{4}-\d{2}-\d{2}/.test(v)) obj[k] = v.replace(/^\d{4}-\d{2}-\d{2}/, dayIso);
          else if (/^\d{2}-[A-Za-z]{3}-\d{4}/.test(v)) obj[k] = v.replace(/^\d{2}-[A-Za-z]{3}-\d{4}/, dMonY);
          else if (/^\d{2}\/\d{2}\/\d{4}/.test(v)) obj[k] = v.replace(/^\d{2}\/\d{2}\/\d{4}/, dMY);
        } else if (typeof v === 'object') {
          replaceInObj(v);
        }
      }
      return obj;
    };
    return JSON.stringify(replaceInObj(parsed));
  } catch {
    // Fall back to regex replacement if rawBody is not valid JSON
    return rawBody
      .replace(/\d{4}-\d{2}-\d{2}/g, dayIso)
      .replace(/\d{2}-[A-Za-z]{3}-\d{4}/g, dMonY)
      .replace(/\d{2}\/\d{2}\/\d{4}/g, dMY);
  }
}

async function submitSingleDay(apiTemplate, dayIso, dayName) {
  const body = substitutePayloadDates(apiTemplate.body, dayIso);
  const headers = { ...apiTemplate.headers };
  delete headers['content-length'];
  delete headers['host'];

  const response = await fetch(apiTemplate.url, {
    method: apiTemplate.method || 'POST',
    headers,
    body: body || undefined,
    credentials: 'include',
  });

  const text = await response.text();
  const lower = text.toLowerCase();
  let status;
  if (response.ok) {
    if (/duplicate|already applied|duplicate request/i.test(lower)) {
      status = 'duplicate';
    } else {
      status = 'submitted';
    }
  } else if (/duplicate/i.test(lower)) {
    status = 'duplicate';
  } else {
    status = 'failed';
  }

  return { day: dayName, date: dayIso, status };
}

async function recordRunFinished(result) {
  const now = new Date();
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
  })
    .format(now)
    .slice(0, 7);
  const { monthHistory = [], historyMonth = '' } = await ext.storage.local.get([
    'monthHistory',
    'historyMonth',
  ]);
  const history = historyMonth === month ? monthHistory : [];
  const entries = (result.results || []).map((x) => ({
    label: `${x.day || 'Application'} – ${x.date || ''}`,
    status: x.status || result.status || 'unknown',
  }));
  if (!entries.length) entries.push({ label: 'Automation run', status: result.status || 'error' });
  await ext.storage.local.set({
    lastRunResult: result,
    running: false,
    monthHistory: [...history, ...entries],
    historyMonth: month,
  });
}

async function executeDirectBackendRun(manual = false) {
  const { apiTemplate = null } = await ext.storage.local.get('apiTemplate');
  if (!apiTemplate?.url) {
    throw new Error('No captured CAMU API template found. Open CAMU once to capture.');
  }

  const dates = upcomingWeekendDates();
  const names = ['Friday', 'Saturday', 'Sunday'];

  const r1 = await submitSingleDay(apiTemplate, dates[0], names[0]);
  const r2 = await submitSingleDay(apiTemplate, dates[1], names[1]);
  const r3 = await submitSingleDay(apiTemplate, dates[2], names[2]);
  const results = [r1, r2, r3];

  const allSuccess = results.every((x) => ['submitted', 'duplicate'].includes(x.status));
  const runResult = {
    status: allSuccess ? 'complete' : 'needs_attention',
    results,
    mode: manual ? 'manual_direct' : 'scheduled_direct',
  };

  await recordRunFinished(runResult);
  return runResult;
}

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'RESCHEDULE') {
    ensureAlarm().catch((err) => {
      console.error('Failed to reschedule alarm:', err);
    });
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'API_TEMPLATE_CAPTURED') {
    ext.storage.local.set({ apiTemplate: msg.template }).catch((err) => {
      console.error('Failed to save API template:', err);
    });
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'EXECUTE_BACKEND_NOW') {
    executeDirectBackendRun(true)
      .then((res) => {
        sendResponse({ ok: true, message: `${res.results.length} submissions processed directly.` });
      })
      .catch((err) => {
        sendResponse({ ok: false, message: err.message });
      });
    return true;
  }
  if (msg?.type === 'RUN_FINISHED') {
    recordRunFinished(msg.result || {}).catch((err) => {
      console.error('Failed to update run history:', err);
    });
    sendResponse({ ok: true });
    return true;
  }
});

ext.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  const { settings = {}, running = false, apiTemplate = null } = await ext.storage.local.get([
    'settings',
    'running',
    'apiTemplate',
  ]);
  if (!settings.enabled || running) return;
  const p = localParts();
  const month = `${p.year}-${p.month}`;
  const stored = await ext.storage.local.get(['historyMonth']);
  if (stored.historyMonth && stored.historyMonth !== month) {
    await ext.storage.local.set({ monthHistory: [], historyMonth: month });
  }
  if (p.weekday !== 'Thu') return;
  const [hh, mm] = (settings.runAt || '09:05').split(':').map(Number);
  const nowMin = Number(p.hour) * 60 + Number(p.minute);
  const target = hh * 60 + mm;
  if (nowMin < 9 * 60 || nowMin > 23 * 60 || nowMin < target) return;

  const key = thursdayDateKey(p);
  const { lastAttemptThursday } = await ext.storage.local.get('lastAttemptThursday');
  if (lastAttemptThursday === key) return;

  // Mark before executing so repeated alarm ticks cannot launch duplicate runs.
  await ext.storage.local.set({ lastAttemptThursday: key, running: true });

  if (apiTemplate?.url) {
    try {
      await executeDirectBackendRun(false);
    } catch (e) {
      await recordRunFinished({
        status: 'error',
        message: e.message,
        mode: 'scheduled_direct',
      });
    }
  } else {
    const tab = await ext.tabs.create({ url: pageUrl(settings), active: false });
    await ext.storage.local.set({ automationTabId: tab.id });
  }
});

ext.tabs.onUpdated.addListener(async (tabId, change) => {
  if (change.status !== 'complete') return;
  const { automationTabId } = await ext.storage.local.get('automationTabId');
  if (tabId !== automationTabId) return;
  try {
    await ext.tabs.sendMessage(tabId, { type: 'START_AUTOPASS' });
  } catch {
    await ext.storage.local.set({
      running: false,
      lastRunResult: {
        status: 'error',
        message: 'Could not connect to CAMU page. Open CAMU and check the extension.',
      },
    });
  }
});
