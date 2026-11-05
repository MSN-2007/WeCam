const ext = typeof browser !== 'undefined' ? browser : chrome;
const ALARM = 'camu-autopass-check';
const CAMU_V2_URL = 'https://student.camu.in/v2/leaveManagement';
const pageUrl = () => CAMU_V2_URL;
const TZ = 'Asia/Kolkata';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function scheduleDateKey(p) {
  return `${p.year}-${p.month}-${p.day}`;
}

async function ensureAlarm() {
  await ext.alarms.clear(ALARM);
  ext.alarms.create(ALARM, { periodInMinutes: 1 });
}

ext.runtime.onInstalled.addListener(ensureAlarm);
ext.runtime.onStartup.addListener(ensureAlarm);

async function closeAutomationTab() {
  const { automationTabId } = await ext.storage.local.get('automationTabId');
  if (automationTabId) {
    try {
      await ext.tabs.remove(automationTabId);
    } catch {
      // Tab might have already been closed by user
    }
    await ext.storage.local.remove('automationTabId');
  }
}

async function recordRunFinished(result) {
  await closeAutomationTab();
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

async function sendAutomationCommand(tabId, message, retriesLeft = 5) {
  try {
    const pong = await ext.tabs.sendMessage(tabId, { type: 'PING' });
    if (pong?.ok) {
      await ext.tabs.sendMessage(tabId, message);
      return;
    }
  } catch {
    // Content script not ready yet
  }

  if (retriesLeft > 0) {
    await sleep(800);
    await sendAutomationCommand(tabId, message, retriesLeft - 1);
    return;
  }

  try {
    if (ext.scripting?.executeScript) {
      await ext.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await ext.tabs.sendMessage(tabId, message);
    }
  } catch (err) {
    console.error('Failed to dispatch automation command:', err);
  }
}

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'RESCHEDULE') {
    ensureAlarm().catch((err) => {
      console.error('Failed to reschedule alarm:', err);
    });
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'TRIGGER_BACKGROUND_RUN') {
    (async () => {
      const { running = false } = await ext.storage.local.get('running');
      if (running) {
        throw new Error('An automation run is already in progress.');
      }
      await ext.storage.local.set({ running: true, runManualTrigger: !!msg.manual });
      const tab = await ext.tabs.create({ url: pageUrl(), active: false });
      await ext.storage.local.set({ automationTabId: tab.id });
    })()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, message: err.message }));
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
  const { settings = {}, running = false } = await ext.storage.local.get([
    'settings',
    'running',
  ]);
  if (!settings.enabled || running) return;
  const p = localParts();
  const month = `${p.year}-${p.month}`;
  const stored = await ext.storage.local.get(['historyMonth']);
  if (stored.historyMonth && stored.historyMonth !== month) {
    await ext.storage.local.set({ monthHistory: [], historyMonth: month });
  }
  if (p.weekday !== 'Tue') return;
  const [hh, mm] = (settings.runAt || '09:05').split(':').map(Number);
  const nowMin = Number(p.hour) * 60 + Number(p.minute);
  const target = hh * 60 + mm;
  if (nowMin < 9 * 60 || nowMin > 23 * 60 || nowMin < target) return;

  const key = scheduleDateKey(p);
  const { lastAttemptTuesday } = await ext.storage.local.get('lastAttemptTuesday');
  if (lastAttemptTuesday === key) return;

  // Mark before executing so repeated alarm ticks cannot launch duplicate runs.
  await ext.storage.local.set({ lastAttemptTuesday: key, running: true, runManualTrigger: false });
  const tab = await ext.tabs.create({ url: pageUrl(), active: false });
  await ext.storage.local.set({ automationTabId: tab.id });
});

ext.tabs.onUpdated.addListener(async (tabId, change) => {
  if (change.status !== 'complete') return;
  const { automationTabId, runManualTrigger = false } = await ext.storage.local.get([
    'automationTabId',
    'runManualTrigger',
  ]);
  if (tabId !== automationTabId) return;
  await sendAutomationCommand(tabId, {
    type: runManualTrigger ? 'RUN_MANUAL' : 'START_AUTOPASS',
  });
});
