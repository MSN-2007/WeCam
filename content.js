if (window.__CAMU_AUTOPASS_CONTENT_LOADED__) {
  /* already injected */
} else {
  window.__CAMU_AUTOPASS_CONTENT_LOADED__ = true;

  const ext = typeof browser !== 'undefined' ? browser : chrome;

  /* ─── CAMU DOM Adapter ──────────────────────────────────────────────
   * Selector / label matching is intentionally isolated here so it can be
   * updated if CAMU changes its UI without touching any other file.
   * Supports CAMU v2 (/v2/leaveManagement).
   * ─────────────────────────────────────────────────────────────────── */

  // ─── Utilities ──────────────────────────────────────────────────────

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  function visible(el) {
    return !!(el && el.getClientRects().length);
  }

  function textOf(el) {
    return norm(el?.innerText || el?.textContent || '');
  }

  function findButton(words) {
    return [...document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')].find(
      (e) => visible(e) && words.some((w) => textOf(e).includes(norm(w)) || norm(e.value).includes(norm(w)))
    );
  }

  function findApplyButton() {
    const candidates = [...document.querySelectorAll('button, a, [role="button"], input[type="button"]')].filter(
      (e) => visible(e) && /apply.*leave/i.test(textOf(e) || e.value || '')
    );
    // Exclude back buttons and title headers (e.g. "<-- Apply Leave and Gate Pass")
    const filtered = candidates.filter((e) => {
      const cls = (e.className || '') + ' ' + (e.parentElement?.className || '');
      const html = e.outerHTML || '';
      return !/back|arrow-left|chevron-left|fa-arrow/i.test(cls + ' ' + html);
    });
    return filtered[0] || candidates[0] || null;
  }

  function isFormAlreadyOpen() {
    const leaveLabel = labelElement('Leave Type');
    const saveBtn = findButton(['Save']);
    return !!(leaveLabel && saveBtn && visible(leaveLabel) && visible(saveBtn));
  }

  function findLabel(label) {
    const labels = [...document.querySelectorAll('label')].filter((e) => visible(e) && textOf(e).includes(norm(label)));
    for (const l of labels) {
      if (l.control) return l.control;
      const id = l.getAttribute('for');
      if (id) {
        const el = document.getElementById(id);
        if (el) return el;
      }
      const nested = l.querySelector('input, select, textarea');
      if (nested) return nested;
      const parent = l.parentElement?.querySelector('input, select, textarea');
      if (parent) return parent;
    }
    return null;
  }

  function findByPlaceholder(words) {
    return [...document.querySelectorAll('input, textarea')].find(
      (e) => visible(e) && words.some((w) => norm(e.placeholder).includes(norm(w)))
    );
  }

  function setValue(el, value) {
    if (!el) throw new Error('Could not find field: ' + value);
    const proto =
      el.tagName === 'TEXTAREA'
        ? HTMLTextAreaElement.prototype
        : el.tagName === 'SELECT'
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function labelElement(label) {
    return [...document.querySelectorAll('label, [data-label], .form-label')].find(
      (e) => visible(e) && norm(textOf(e)).replace(/[\uff0a*]/g, '').includes(norm(label))
    );
  }

  // ─── Robust React-Select & Custom Dropdown Handler ──────────────────

  /**
   * Checks whether a value string non-trivially matches any item in wantedList.
   */
  function matchesWanted(val, wantedList) {
    if (!val || typeof val !== 'string') return false;
    const n = norm(val);
    if (!n || n === 'select' || n === 'select...') return false;
    return wantedList.some((w) => {
      const nw = norm(w);
      return nw && (n === nw || n.includes(nw) || nw.includes(n));
    });
  }

  /**
   * Finds the exact dropdown control associated with a label by looking strictly AFTER it.
   * This prevents picking up preceding controls (e.g. Leave Type when locating Gate Pass Type).
   */
  function findDropdownAfterLabel(l) {
    if (!l) return null;

    // 1. If label has 'for' attribute, check that element
    const id = l.getAttribute('for');
    if (id) {
      const target = document.getElementById(id);
      if (target) {
        if (target.tagName === 'SELECT') return target;
        const ctrl = target.closest('.rs-option__control, [class*="control" i]');
        if (ctrl) return ctrl;
      }
    }

    // 2. Look for the next siblings of label
    let sib = l.nextElementSibling;
    while (sib) {
      if (sib.matches?.('select, .rs-option__control, [class*="control" i]')) return sib;
      const inside = sib.querySelector?.('select, .rs-option__control, [class*="control" i]');
      if (inside) return inside;
      sib = sib.nextElementSibling;
    }

    // 3. Look in parent, but only among elements appearing after l
    const parent = l.parentElement;
    if (parent) {
      let passedL = false;
      for (const child of parent.children) {
        if (child === l) {
          passedL = true;
          continue;
        }
        if (passedL) {
          if (child.matches?.('select, .rs-option__control, [class*="control" i]')) return child;
          const inside = child.querySelector?.('select, .rs-option__control, [class*="control" i]');
          if (inside) return inside;
        }
      }
    }

    // 4. In document order: find all controls on the page and pick the first one that is strictly AFTER l
    const allControls = [
      ...document.querySelectorAll('select, .rs-option__control, [class*="__control"], .select-wrapper'),
    ].filter(visible);
    const afterL = allControls.find((ctrl) => (l.compareDocumentPosition(ctrl) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
    if (afterL) return afterL;

    return null;
  }

  /**
   * Reads the current value directly from a specific control.
   */
  function readDropdownValue(l, control) {
    if (!control) return '';

    if (control.tagName === 'SELECT') {
      const opt = control.options[control.selectedIndex];
      const txt = norm(opt?.textContent || control.value || '');
      return txt === 'select' || txt === 'select...' ? '' : txt;
    }

    // 1. Single-value element inside THIS control
    const singleVal = control.querySelector(
      '.rs-option__single-value, [class*="singlevalue" i], [class*="single-value" i]'
    );
    if (singleVal && textOf(singleVal)) {
      const txt = textOf(singleVal);
      if (txt && txt !== 'select' && txt !== 'select...') return txt;
    }

    // 2. Value container inside THIS control
    const valContainer = control.querySelector(
      '.rs-option__value-container, [class*="valuecontainer" i], [class*="value-container" i]'
    );
    const placeholder = control.querySelector('.rs-option__placeholder, [class*="placeholder" i]');
    if (valContainer && !placeholder) {
      const txt = norm(valContainer.textContent || '');
      if (txt && txt !== 'select' && txt !== 'select...') return txt;
    }

    // 3. Input inside THIS control
    const input = control.querySelector('input');
    if (input && input.value && norm(input.value) !== 'select') {
      return norm(input.value);
    }

    // 4. Inspect control's own text content minus placeholder/indicators
    const clone = control.cloneNode(true);
    clone.querySelectorAll('svg, button, [class*="indicator" i], [class*="placeholder" i]').forEach((e) => e.remove());
    const remaining = norm(clone.textContent || '');
    if (remaining && remaining !== 'select' && remaining !== 'select...') {
      return remaining;
    }

    return '';
  }

  /**
   * Interacts with React-Select or custom dropdown to select a desired option.
   */
  async function chooseOptionByLabel(label, desired, aliases = []) {
    const wanted = [desired, ...aliases].map(norm).filter(Boolean);
    const l = labelElement(label);
    if (!l) throw new Error(`Could not locate label for "${label}".`);

    // Find the exact control that belongs to THIS label (strictly after l)
    const control = findDropdownAfterLabel(l);
    if (!control) {
      throw new Error(`Could not locate the dropdown control for "${label}".`);
    }

    // 1. Check if desired value is ALREADY displayed!
    const currentVal = readDropdownValue(l, control);
    if (matchesWanted(currentVal, wanted)) {
      return true;
    }

    // 2. If it's a native <select>
    if (control.tagName === 'SELECT') {
      const opt = [...control.options].find((o) => matchesWanted(o.textContent, wanted));
      if (!opt) {
        throw new Error(
          `Dropdown "${label}" has no "${desired}" option. Available: ${[...control.options].map((o) => o.textContent.trim()).join(', ')}`
        );
      }
      setValue(control, opt.value);
      return true;
    }

    // 3. React-Select control
    const input = control.querySelector('input');

    control.scrollIntoView({ block: 'center', behavior: 'instant' });
    await sleep(100);

    const mouseDown = (target) =>
      target.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 })
      );
    const mouseUp = (target) =>
      target.dispatchEvent(
        new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0 })
      );
    const click = (target) =>
      target.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, view: window, button: 0, buttons: 0 })
      );

    const readOptions = () =>
      [
        ...document.querySelectorAll(
          '.rs-option__option, [role="option"], [id*="-option-"]'
        ),
      ].filter(visible);

    // Sequence 1: Double mousedown & click on control
    mouseDown(control);
    await sleep(80);
    mouseUp(control);
    click(control);
    await sleep(100);

    if (input) {
      input.focus();
      mouseDown(input);
      await sleep(80);
      mouseUp(input);
      click(input);
    }

    mouseDown(control);
    await sleep(80);
    mouseUp(control);
    click(control);
    await sleep(300);

    let options = readOptions();

    // Sequence 2: Click indicator arrow if needed
    if (!options.length) {
      const indicator = control.querySelector('.rs-option__dropdown-indicator, [class*="indicator" i], svg');
      if (indicator) {
        mouseDown(indicator);
        await sleep(80);
        mouseUp(indicator);
        click(indicator);
        await sleep(350);
        options = readOptions();
      }
    }

    // Sequence 3: ArrowDown on input
    if (!options.length && input) {
      input.focus();
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, cancelable: true })
      );
      await sleep(400);
      options = readOptions();
    }

    // Sequence 4: Type text into input
    if (!options.length && input && input.tagName === 'INPUT') {
      setValue(input, 'Week');
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, cancelable: true })
      );
      await sleep(400);
      options = readOptions();
    }

    // Find matching option
    let matchedOption = options.find((opt) => matchesWanted(textOf(opt), wanted));
    if (!matchedOption && options.length > 0) {
      matchedOption = options.find((opt) => /week|gate/i.test(textOf(opt)));
    }
    if (!matchedOption && options.length === 1) {
      matchedOption = options[0];
    }

    if (matchedOption) {
      matchedOption.scrollIntoView({ block: 'nearest' });
      mouseDown(matchedOption);
      await sleep(80);
      mouseUp(matchedOption);
      click(matchedOption);
      matchedOption.click();
      await sleep(350);
    }

    // Verify
    await sleep(200);
    const afterVal = readDropdownValue(l, control);
    if (matchesWanted(afterVal, wanted)) {
      return true;
    }

    // If option was found and clicked, and menu closed, it's successful
    if (matchedOption && !readOptions().length) {
      return true;
    }

    if (norm(label) === 'leave type') {
      return true;
    }

    if (!matchedOption) {
      const visibleOpts = options.map((e) => norm(e.textContent)).filter(Boolean);
      throw new Error(
        `Could not open/match "${desired}" in "${label}". Visible options: ${visibleOpts.join(' | ') || '(none)'}.`
      );
    }

    return true;
  }

  function setDate(el, iso) {
    if (!el) throw new Error('Could not find date field');
    const type = el.type;
    let value = iso;
    if (type === 'text') {
      const [y, m, d] = iso.split('-');
      const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1];
      value = `${d}-${mon}-${y}`;
    }
    setValue(el, value);
  }

  function checkByLabel(label, checked) {
    let el = findLabel(label);
    if (!el) {
      el = [...document.querySelectorAll('input[type=checkbox]')].find(
        (e) => visible(e) && norm(e.parentElement?.innerText).includes(norm(label))
      );
    }
    if (!el) throw new Error('Could not find checkbox: ' + label);
    if (!!el.checked !== checked) el.click();
  }

  function findReason() {
    const l = labelElement('Reason for Gate Pass');
    if (l) {
      let p = l.parentElement;
      for (let i = 0; p && i < 3; i++, p = p.parentElement) {
        const field = p.querySelector('textarea, input:not([type=checkbox]):not([type=file])');
        if (field) return field;
      }
    }
    return (
      findByPlaceholder(['Reason for Gate Pass', 'Reason for Absence']) ||
      [...document.querySelectorAll('textarea, input')].find(
        (e) => visible(e) && /gate.*reason|reason.*gate/i.test(`${e.name} ${e.id} ${e.placeholder}`)
      )
    );
  }

  function findInputNearLabel(labelText) {
    const l = labelElement(labelText);
    if (!l) return null;
    if (l.control) return l.control;
    const id = l.getAttribute('for');
    if (id) {
      const e = document.getElementById(id);
      if (e) return e;
    }
    return (
      l.parentElement?.querySelector('input, textarea') ||
      l.parentElement?.nextElementSibling?.querySelector('input, textarea') ||
      null
    );
  }

  function findDateFields() {
    const labelled = [
      findInputNearLabel('Start Date'),
      findInputNearLabel('To Date'),
      findInputNearLabel('From Date & Time'),
      findInputNearLabel('To Date & Time'),
      findInputNearLabel('From Date'),
      findInputNearLabel('To Date'),
    ].filter(Boolean);
    const uniqueLabelled = [...new Set(labelled)];
    if (uniqueLabelled.length >= 4) return uniqueLabelled.slice(0, 4);

    const inputs = [...document.querySelectorAll('input')].filter(visible);
    const dates = inputs.filter((e) => e.type === 'date' || /date/i.test(`${e.placeholder} ${e.name} ${e.id}`));
    return dates.length >= 4 ? dates.slice(0, 4) : uniqueLabelled.length ? uniqueLabelled : dates;
  }

  function findTimeInputs() {
    return [...document.querySelectorAll('input')].filter(
      (e) => visible(e) && (e.type === 'time' || /hh:mm|am\/pm/i.test(e.placeholder))
    );
  }

  function findFieldsByLabel(labelTexts) {
    const fields = [];
    for (const label of labelTexts) {
      const el = findInputNearLabel(label);
      if (el && !fields.includes(el)) fields.push(el);
    }
    return fields;
  }

  async function waitForGatePassFields(timeout = 3000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const fields = findFieldsByLabel([
        'From Date & Time',
        'To Date & Time',
        'Gate Pass From Date',
        'Gate Pass To Date',
        'Gatepass From Date',
        'Gatepass To Date',
      ]);
      if (fields.length >= 2) return fields.slice(0, 2);
      await sleep(120);
    }
    return [];
  }

  // ─── Core automation ───────────────────────────────────────────────

  async function fillAndSubmit(dayIso, settings, dayName) {
    // Only click "Apply Leave and Gate Pass" if form is not already open
    if (!isFormAlreadyOpen()) {
      const apply = findApplyButton();
      if (apply) {
        apply.click();
        const startWait = Date.now();
        while (Date.now() - startWait < 3000) {
          if (isFormAlreadyOpen()) break;
          await sleep(150);
        }
      }
    }
    await sleep(300);

    // Stage 1: initial form contains leave date fields & leave type
    await chooseOptionByLabel('Leave Type', 'Leave', ['Leave Application', 'Casual Leave', 'Leave']);
    let leaveDates = findFieldsByLabel(['Start Date', 'To Date']);
    if (leaveDates.length < 2) {
      const fallbackDates = [...document.querySelectorAll('input')]
        .filter(visible)
        .filter((e) => e.type === 'date' || /date/i.test(`${e.placeholder} ${e.name} ${e.id}`));
      if (fallbackDates.length >= 2) {
        leaveDates = fallbackDates.slice(0, 2);
      } else {
        throw new Error(`Found ${leaveDates.length}/2 leave date fields. The Leave Type or form may not have loaded.`);
      }
    }
    setDate(leaveDates[0], dayIso);
    setDate(leaveDates[1], dayIso);

    // Stage 2: enabling gate pass reveals additional date & time fields
    checkByLabel('Apply gate pass', true);
    await sleep(500);
    let gateDates = await waitForGatePassFields(4000);

    // Wait until Gate Pass Type is rendered
    const startWaitGp = Date.now();
    while (Date.now() - startWaitGp < 4000) {
      const gpl = labelElement('Gate Pass Type');
      if (gpl && visible(gpl)) break;
      await sleep(150);
    }
    await sleep(400);

    await chooseOptionByLabel('Gate Pass Type', 'Week End Gate Pass', [
      'Weekend',
      'Week End Gatepass',
      'Weekend Gate Pass',
      'Week End Gate Pass',
      'Weekend Outing',
    ]);

    if (gateDates.length < 2) {
      const allDateInputs = [...document.querySelectorAll('input')]
        .filter(visible)
        .filter((e) => e.type === 'date' || /date/i.test(`${e.placeholder} ${e.name} ${e.id}`));
      const remainingDates = allDateInputs.filter((e) => !leaveDates.includes(e));
      if (remainingDates.length >= 2) {
        gateDates = remainingDates.slice(0, 2);
      } else {
        throw new Error(
          'Apply gate pass was enabled, but its two date fields did not appear. Check whether the checkbox opened the gate-pass section.'
        );
      }
    }
    setDate(gateDates[0], dayIso);
    setDate(gateDates[1], dayIso);

    // Gate-pass time fields
    const fmt = (t) => {
      const [h, m] = t.split(':').map(Number);
      return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
    };

    const fromTime =
      document.querySelector('input[name="Frtm"]') ||
      findByPlaceholder(['hh:mm am/pm']) ||
      findTimeInputs()[0];
    const toTime =
      document.querySelector('input[name="ToTm"]') ||
      [...document.querySelectorAll('input[placeholder*="hh:mm"]')].filter(visible)[1] ||
      findTimeInputs()[1];

    if (!fromTime || !toTime) {
      throw new Error(`Gate-pass time controls missing. Frtm=${!!fromTime}, ToTm=${!!toTime}.`);
    }

    const setPickerTime = async (el, clock, label) => {
      const [targetHour, targetMinute] = clock.split(':').map(Number);
      const targetPeriod = targetHour >= 12 ? 'PM' : 'AM';
      const targetHour12 = targetHour % 12 || 12;

      const root = el.closest('.rdt');
      if (!root) {
        // In standard input fields or if react-datetime wrapper (.rdt) is not present.
        const timeFormatted = fmt(clock);
        setValue(el, timeFormatted);
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        return el.value;
      }

      // CAMU v2 react-datetime (.rdtCounter / .rdtBtn) picker interaction
      el.click();
      el.focus();
      await sleep(150);

      const read = () => [...root.querySelectorAll('.rdtCounter')].map((c) => c.querySelector('.rdtCount')?.textContent?.trim() || '');

      const clickStep = async (counterIndex, direction) => {
        const counters = root.querySelectorAll('.rdtCounter');
        const counter = counters[counterIndex];
        const buttons = counter?.querySelectorAll('.rdtBtn');
        const button = buttons?.[direction === 'up' ? 0 : 1];
        if (!button) throw new Error(`${label}: picker counter ${counterIndex + 1} ${direction} control not found.`);

        const mouseOpts = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 };
        button.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
        await sleep(110);
        button.dispatchEvent(new MouseEvent('mouseup', { ...mouseOpts, buttons: 0 }));
        document.dispatchEvent(new MouseEvent('mouseup', { ...mouseOpts, buttons: 0 }));
        await sleep(120);
      };

      const setCyclic = async (index, target, parse, cycle) => {
        for (let i = 0; i < 70; i++) {
          const currentText = read()[index];
          const current = parse(currentText);
          if (current === target) return;
          const up = (target - current + cycle) % cycle;
          const down = (current - target + cycle) % cycle;
          const direction = up <= down ? 'up' : 'down';
          await clickStep(index, direction);
          const after = parse(read()[index]);
          if (after === current) {
            const counter = root.querySelectorAll('.rdtCounter')[index];
            const btns = counter?.querySelectorAll('.rdtBtn');
            const btn = btns?.[direction === 'up' ? 0 : 1];
            if (btn) {
              btn.dispatchEvent(
                new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', button: 0, buttons: 1 })
              );
              await sleep(100);
              btn.dispatchEvent(
                new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', button: 0, buttons: 0 })
              );
              await sleep(120);
            }
          }
        }
        throw new Error(
          `${label}: could not set picker counter ${index + 1} to ${target}; current values: ${read().join(':')}`
        );
      };

      await setCyclic(0, targetHour12, (v) => Number(v), 12);
      await setCyclic(1, targetMinute, (v) => Number(v), 60);

      const period = read()[2]?.toUpperCase();
      if (period !== targetPeriod) {
        await clickStep(2, 'up');
      }
      if (read()[2]?.toUpperCase() !== targetPeriod) {
        throw new Error(`${label}: could not set AM/PM to ${targetPeriod}.`);
      }

      document.body.click();
      await sleep(250);
      el.blur();
      await sleep(180);

      const actual = (el.value || '').trim();
      const toMinutes = (value) => {
        const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
        if (!match) return null;
        let h = Number(match[1]) % 12;
        if (match[3].toLowerCase() === 'pm') h += 12;
        return h * 60 + Number(match[2]);
      };
      const expectedMinutes = targetHour * 60 + targetMinute;
      if (toMinutes(actual) !== null && toMinutes(actual) !== expectedMinutes) {
        throw new Error(
          `CAMU did not commit ${label}. Picker shows ${read().join(':')}; expected ${String(targetHour12)}:${String(targetMinute).padStart(2, '0')} ${targetPeriod}, actual "${actual}".`
        );
      }
      return actual;
    };

    const expectedFrom = fmt(settings.fromTime || '06:00');
    const expectedTo = fmt(settings.toTime || '20:00');
    await setPickerTime(fromTime, settings.fromTime || '06:00', 'From time');
    await setPickerTime(toTime, settings.toTime || '20:00', 'To time');
    await sleep(300);

    const leaveReason = document.querySelector('input[name="Rson"]') || findByPlaceholder(['Reason for Leave']);
    if (leaveReason) setValue(leaveReason, settings.leaveReason || 'Weekend outing');

    const gateReason = findReason();
    if (!gateReason) throw new Error('Could not locate the Reason for Gate Pass input/textarea.');
    setValue(gateReason, settings.gateReason || 'Weekend outing');
    gateReason.dispatchEvent(new Event('blur', { bubbles: true }));

    const clockMinutes = (value) => {
      const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
      if (!m) return null;
      let h = Number(m[1]);
      const period = m[3] ? m[3].toLowerCase() : null;
      if (period === 'pm' && h < 12) h += 12;
      if (period === 'am' && h === 12) h = 0;
      return h * 60 + Number(m[2]);
    };
    const configuredMinutes = (value) => {
      const [h, m] = String(value || '').split(':').map(Number);
      return h * 60 + m;
    };

    const parsedFrom = clockMinutes(fromTime.value);
    const parsedTo = clockMinutes(toTime.value);
    const targetFrom = configuredMinutes(settings.fromTime || '06:00');
    const targetTo = configuredMinutes(settings.toTime || '20:00');

    if (parsedFrom !== null && parsedFrom !== targetFrom) {
      throw new Error(`CAMU did not retain gate-pass from-time. Expected "${expectedFrom}", actual "${fromTime.value}".`);
    }
    if (parsedTo !== null && parsedTo !== targetTo) {
      throw new Error(`CAMU did not retain gate-pass to-time. Expected "${expectedTo}", actual "${toTime.value}".`);
    }
    if (norm(gateReason.value) !== norm(settings.gateReason || 'Weekend outing')) {
      throw new Error('CAMU did not retain the Gate Pass reason.');
    }

    const save = findButton(['Save']);
    if (!save) throw new Error('Could not find Save button.');
    save.click();
    await sleep(2500);

    const body = norm(document.body.innerText);
    if (/successfully|submitted successfully|saved successfully|request submitted/i.test(body)) {
      return { day: dayName, date: dayIso, status: 'submitted' };
    }
    if (/duplicate|already applied|duplicate request/i.test(body)) {
      return { day: dayName, date: dayIso, status: 'duplicate' };
    }
    return { day: dayName, date: dayIso, status: 'unverified' };
  }

  function upcomingWeekend() {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date());
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const today = dayMap[weekday];
    const delta = (5 - today + 7) % 7 || 7; // next Friday strictly after today
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date())
      .split('-')
      .map(Number);
    const base = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    base.setUTCDate(base.getUTCDate() + delta);
    return [0, 1, 2].map((n) => {
      const x = new Date(base);
      x.setUTCDate(x.getUTCDate() + n);
      return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
    });
  }

  let autoPassRunning = false;

  async function startAutoPass(manual = false) {
    if (autoPassRunning) throw new Error('An AutoPass run is already in progress in this tab.');
    autoPassRunning = true;
    try {
      const { settings = {} } = await ext.storage.local.get('settings');
      if (!manual) {
        const p = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })
          .formatToParts(new Date())
          .reduce((o, x) => {
            o[x.type] = x.value;
            return o;
          }, {});
        const minute = Number(p.hour) * 60 + Number(p.minute);
        if (p.weekday !== 'Tue' || minute < 540 || minute > 1380) {
          throw new Error('Outside the permitted Tuesday 09:00–23:00 window.');
        }
      }
      const dates = upcomingWeekend();
      const names = ['Friday', 'Saturday', 'Sunday'];
      const results = [];

      results.push(await fillAndSubmit(dates[0], settings, names[0]));
      await ext.storage.local.set({ currentExecution: results });
      await sleep(1500);

      results.push(await fillAndSubmit(dates[1], settings, names[1]));
      await ext.storage.local.set({ currentExecution: results });
      await sleep(1500);

      results.push(await fillAndSubmit(dates[2], settings, names[2]));
      await ext.storage.local.set({ currentExecution: results });

      await ext.runtime.sendMessage({
        type: 'RUN_FINISHED',
        result: {
          status: results.every((x) => ['submitted', 'duplicate'].includes(x.status)) ? 'complete' : 'needs_attention',
          results,
          mode: manual ? 'manual' : 'scheduled',
        },
      });
      return results;
    } finally {
      autoPassRunning = false;
    }
  }

  async function detectOnly() {
    return {
      url: location.href,
      applyButton: !!findApplyButton(),
      formOpen: isFormAlreadyOpen(),
      leaveTypeField: !!labelElement('Leave Type'),
      dateInputs: findDateFields().length,
      gatePassCheckbox: !!findLabel('Apply gate pass'),
      gatePassTypeField: !!labelElement('Gate Pass Type'),
      timeInputs: findTimeInputs().length,
      saveButton: !!findButton(['Save']),
    };
  }

  ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'PING') {
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === 'DETECT_ONLY') {
      detectOnly().then((r) => {
        const onTarget = location.pathname.startsWith('/v2/leaveManagement');
        sendResponse({
          message: onTarget
            ? 'Detection: ' + JSON.stringify(r)
            : 'Wrong CAMU page. Open https://student.camu.in/v2/leaveManagement and run detection again. Current page: ' +
              location.href,
        });
      });
      return true;
    }
    if (msg?.type === 'START_AUTOPASS' || msg?.type === 'RUN_MANUAL') {
      const manual = msg.type === 'RUN_MANUAL';
      startAutoPass(manual)
        .then((results) =>
          sendResponse({
            ok: true,
            message: `Run completed. ${results.length} daily applications processed; check the CAMU page and monthly activity.`,
          })
        )
        .catch(async (e) => {
          await ext.runtime.sendMessage({
            type: 'RUN_FINISHED',
            result: { status: 'error', message: e.message, mode: manual ? 'manual' : 'scheduled' },
          });
          sendResponse({ ok: false, message: e.message });
        });
      return true;
    }
  });
}
