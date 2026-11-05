# CAMU AutoPass – Version 1

A cross-browser Manifest V3 extension (Chrome, Firefox, and Chromium/Gecko-based browsers) for Thursday-only automation of **three separate daily applications** (Friday, Saturday, Sunday). Each daily form includes the Weekend leave and the integrated Weekend gate pass, so the expected total is **three form submissions**, not six.

## Defaults
- Time zone: Asia/Kolkata
- Allowed execution day/window: Thursday, 09:00–23:00
- Scheduler default: Thursday 09:05
- Daily leave and gate-pass timing: 06:00–20:00 (same day for each application)
- Leave type: Leave (fixed; CAMU dropdown option)
- Gate pass type: Weekend (fixed)
- Gate pass reason: Weekend outing
- No documents uploaded

## Install

### Chrome & Chromium-based Browsers (Chrome, Brave, Edge, Opera, Vivaldi)
1. Extract the ZIP or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Select **Load unpacked** and choose this folder.
5. Sign in to CAMU in the same Chrome profile.
6. Open the extension and save your settings.

### Firefox & Firefox-based Browsers (Firefox, LibreWolf, Zen, Waterfox, Floorp)
1. Extract the ZIP or clone this repository.
2. Open `about:debugging` in Firefox.
3. Click on **This Firefox** (in the left sidebar).
4. Under **Temporary Extensions**, click **Load Temporary Add-on…**.
5. Select the `manifest.json` file inside this folder.
6. Sign in to CAMU in the same Firefox profile.
7. Open the extension and save your settings.

The browser must be running and the computer awake during the Thursday execution window for scheduled runs. The extension also includes a **Run now** button: open the CAMU Leave Management page, then click Run now to start the same three-day workflow immediately. Manual runs calculate the next full Friday–Sunday weekend.

## Important: CAMU selector calibration required
The supplied screenshot confirms the Leave Type dropdown options are Leave, On Duty, and Medical Leave. V1 selects Leave (fixed). The Gate Pass Type remains Weekend. Therefore this package is a V1 implementation scaffold, **not yet verified against your live CAMU account**. Before enabling automatic Save, navigate to the actual Leave Management page at https://student.camu.in/v2/leaveManagement (not Messages or another CAMU page), then use the extension's **Test page detection** button, and inspect `content.js` if any field is not detected. The current adapter uses visible labels/placeholders and common native/custom dropdown patterns; CAMU may use custom widgets that need selector-specific adjustments.

Important: CAMU is understood to accept applications only Thursday 09:00–23:00. Run now bypasses the extension scheduler restriction, but it cannot bypass CAMU server-side restrictions; if clicked outside CAMU’s permitted window, CAMU may reject the application. Use it during the Thursday window for actual submissions. The extension does not store your CAMU password, bypass authentication, or bypass CAPTCHA/MFA. It relies on your existing logged-in session. It clicks Save automatically after filling the form. Test with automation disabled first.

## Scheduling notes
Alarms are not exact-to-the-minute guarantees. The worker checks every minute and starts at/after the configured time, but only on Thursday and only before 23:00 Asia/Kolkata. If the browser is closed or the laptop is asleep, automation cannot run. A missed Thursday is not replayed on Friday.

## Monthly activity
Stores the latest run result and current execution state in extension storage. Monthly history is displayed in the popup.

V1.5 note: If CAMU is reached through in-app/SPA navigation, the content script may not be injected by the initial URL matching. The popup checks for the content script and injects it into the active Leave Management tab when needed (requires the scripting permission).

V1.6 fixes a malformed regular expression in content.js that prevented the entire content script from parsing. It also waits for the injected script's PING response before sending detection or run messages, and reports injection errors more clearly.

## V2.7 time-picker diagnostics
Open the CAMU Leave Management page and click the extension's `Diagnose CAMU time picker (no submission)` button. It focuses and opens the From/To time controls, inspects their visible DOM structure, and displays a JSON report in the extension popup. This diagnostic does not enter values or save an application. Copy the report from the popup and share it for troubleshooting. Close any open DevTools and refresh CAMU first if the portal is displaying its anti-debugging warning.

V3.2 specifically fixes CAMU React-Select opening: it targets the visible control wrapper for Gate Pass Type (the input is opacity:0), dispatches the mousedown event React-Select expects, and verifies the selected value before continuing. If the option cannot be confirmed, it stops before Save.

## V3.3 React-Select interaction correction
The CAMU custom dropdown's first control mousedown focuses the hidden input; a subsequent control mousedown opens the menu. V3.3 performs this two-step interaction, then uses ArrowDown as a fallback and selects only an exact visible option match. If the menu/options or selected value cannot be confirmed, it stops before Save. This is code-level calibrated from the supplied DOM report; live portal execution still needs user verification.

## V3.4 preselected Leave Type fix
The user's screenshot confirms that CAMU already displays `Leave` as the selected Leave Type. React-Select excludes the currently selected item from its open options list, which is why the diagnostic showed only `On Duty` and `Medical Leave`. V3.4 first reads the selected-value node and accepts an exact existing selection before attempting to open the menu. The same protection applies to Gate Pass Type. If a different value is selected, the extension still opens the menu and requires an exact visible option match.

## Firefox and Gecko Compatibility
- **Unified Extension API (`browser` / `chrome`):** Handles Promise resolution transparently across Firefox's native Promise-based `browser.*` namespace and Chrome's Manifest V3 `chrome.*` namespace.
- **Dual Background Dispatch:** Configures `background.scripts` for Firefox event pages while retaining `background.service_worker` for Chromium service workers.
- **Gecko Manifest Settings:** Added `browser_specific_settings.gecko` with unique extension ID and declared `data_collection_permissions`.
- **Safe DOM Injection:** Replaced dynamic `innerHTML` rendering in the history view with sanitized DOM creation methods (`replaceChildren` and `textContent`), adhering to Mozilla add-on security policies.
