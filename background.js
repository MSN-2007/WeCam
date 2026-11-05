const ext = typeof browser !== 'undefined' ? browser : chrome;
const ALARM = 'camu-autopass-check';
const URL = 'https://student.camu.in/v2/leaveManagement';
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
    .reduce((o, p) => ((o[p.type] = p.value), o), {});

function thursdayDateKey(p) {
  return `${p.year}-${p.month}-${p.day}`;
}

async function ensureAlarm() {
  await ext.alarms.clear(ALARM);
  ext.alarms.create(ALARM, { periodInMinutes: 1 });
}

ext.runtime.onInstalled.addListener(ensureAlarm);
ext.runtime.onStartup.addListener(ensureAlarm);

ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'RESCHEDULE') {
    ensureAlarm();
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'RUN_FINISHED') {
    (async () => {
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
      const result = msg.result || {};
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
    })();
    sendResponse({ ok: true });
    return true;
  }
});

ext.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  const { settings = {}, running = false } = await ext.storage.local.get(['settings', 'running']);
  if (!settings.enabled || running) return;
  const p = localParts();
  const month = `${p.year}-${p.month}`;
  const stored = await ext.storage.local.get(['historyMonth']);
  if (stored.historyMonth && stored.historyMonth !== month) {
    await ext.storage.local.set({ monthHistory: [], historyMonth: month });
  }
  if (p.weekday !== 'Thu') return;
  const [hh, mm] = (settings.runAt || '09:05').split(':').map(Number);
  const nowMin = Number(p.hour) * 60 + Number(p.minute),
    target = hh * 60 + mm;
  if (nowMin < 9 * 60 || nowMin > 23 * 60 || nowMin < target) return;

  const key = thursdayDateKey(p);
  const { lastAttemptThursday } = await ext.storage.local.get('lastAttemptThursday');
  if (lastAttemptThursday === key) return;

  // Mark before opening so repeated alarm ticks cannot launch duplicate runs.
  await ext.storage.local.set({ lastAttemptThursday: key, running: true });
  const tab = await ext.tabs.create({ url: URL, active: false });
  await ext.storage.local.set({ automationTabId: tab.id });
});

ext.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.status !== 'complete') return;
  const { automationTabId } = await ext.storage.local.get('automationTabId');
  if (tabId !== automationTabId) return;
  try {
    await ext.tabs.sendMessage(tabId, { type: 'START_AUTOPASS' });
  } catch (e) {
    await ext.storage.local.set({
      running: false,
      lastRunResult: {
        status: 'error',
        message: 'Could not connect to CAMU page. Open CAMU and check the extension.',
      },
    });
  }
});
