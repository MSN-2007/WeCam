# CAMU AutoPass – Version 1 (V3.5)

A cross-browser Manifest V3 extension (Chrome, Firefox, Safari, and Chromium/Gecko/WebKit-based browsers) for Thursday-only automation of **three separate daily applications** (Friday, Saturday, Sunday). Each daily form includes the Weekend leave and the integrated Weekend gate pass, so the expected total is **three form submissions**, not six.

---

## 📦 Direct ZIP Downloads (Releases)

You can download the pre-packaged extension ZIP directly from the GitHub Releases page without needing git or Node.js:

| Release | Compatibility | Direct Download |
| :--- | :--- | :--- |
| **v3.5.0 (Latest)** | **Chrome, Firefox & Safari** (Cross-Browser MV3) | [Download camu-autopass-v3.5.0.zip](https://github.com/Rish3666/WeCam/releases/download/v3.5.0/camu-autopass-v3.5.0.zip) |
| **v3.4.0 (Pre-Firefox)** | **Chrome only** (Original MV3) | [Download camu-autopass-v3.4.0.zip](https://github.com/Rish3666/WeCam/releases/download/v3.4.0/camu-autopass-v3.4.0.zip) |

All releases with changelogs and assets are available on the [GitHub Releases page](https://github.com/Rish3666/WeCam/releases) (and upstream [MSN-2007/WeCam Releases](https://github.com/MSN-2007/WeCam/releases)).

---

## Defaults
- Time zone: Asia/Kolkata
- Allowed execution day/window: Thursday, 09:00–23:00
- Scheduler default: Thursday 09:05
- Daily leave and gate-pass timing: 06:00–20:00 (same day for each application)
- Leave type: Leave (fixed; CAMU dropdown option)
- Gate pass type: Weekend (fixed)
- Gate pass reason: Weekend outing
- No documents uploaded

---

## Installation Guide

### Chrome & Chromium-based Browsers (Chrome, Brave, Edge, Opera, Vivaldi)
1. **Download the ZIP**: Download `camu-autopass-v3.5.0.zip` (or `v3.4.0.zip`) from the table above and extract it into a folder.
2. Open `chrome://extensions` in your browser.
3. Enable **Developer mode** (toggle located in the upper-right corner).
4. Click **Load unpacked** and select the unzipped extension folder.
5. Sign in to CAMU in the same Chrome profile.
6. Click the extension icon in your toolbar and save your desired settings.

### Firefox & Firefox-based Browsers (Firefox, LibreWolf, Zen, Waterfox, Floorp)
1. **Download the ZIP**: Download `camu-autopass-v3.5.0.zip` from the table above and extract it into a folder.
2. Open `about:debugging` in Firefox.
3. Click on **This Firefox** in the left sidebar.
4. Under the **Temporary Extensions** section, click **Load Temporary Add-on…**.
5. Select the `manifest.json` file inside the unzipped folder.
6. Sign in to CAMU in the same Firefox profile.
7. Click the extension icon in your toolbar and save your desired settings.

### Safari (macOS & iOS)
Safari uses Apple's native App Extension wrapper. A pre-configured Xcode project is included in `safari/CAMU AutoPass/`:

1. Open Safari -> **Settings** (or **Preferences**) -> **Advanced** tab -> Check **Show features for web developers**.
2. In Safari's menu bar, open **Develop** -> Check **Allow Unsigned Extensions** (enter your macOS password when prompted).
3. Open and run the project:
   ```bash
   open "safari/CAMU AutoPass/CAMU AutoPass.xcodeproj"
   ```
   Or build from the terminal using the included helper script:
   ```bash
   ./scripts/build-safari.sh
   ```
4. In Xcode, select the **CAMU AutoPass (macOS)** scheme and press **Run** (`Cmd + R`).
5. In Safari, open **Settings** -> **Extensions** and check the box next to **CAMU AutoPass**.
6. When prompted, select **Always Allow on Every Website** (or grant permissions for `student.camu.in`).
7. Sign in to CAMU and open the popup from your Safari toolbar!

---

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

V3.3 React-Select interaction correction
The CAMU custom dropdown's first control mousedown focuses the hidden input; a subsequent control mousedown opens the menu. V3.3 performs this two-step interaction, then uses ArrowDown as a fallback and selects only an exact visible option match. If the menu/options or selected value cannot be confirmed, it stops before Save. This is code-level calibrated from the supplied DOM report; live portal execution still needs user verification.

V3.4 preselected Leave Type fix
The user's screenshot confirms that CAMU already displays `Leave` as the selected Leave Type. React-Select excludes the currently selected item from its open options list, which is why the diagnostic showed only `On Duty` and `Medical Leave`. V3.4 first reads the selected-value node and accepts an exact existing selection before attempting to open the menu. The same protection applies to Gate Pass Type. If a different value is selected, the extension still opens the menu and requires an exact visible option match.

## V3.5 Cross-Browser Compatibility (Chrome, Firefox & Safari)
- **Unified Extension API (`browser` / `chrome`):** Handles Promise resolution transparently across Firefox's native Promise-based `browser.*` namespace, Chrome's Manifest V3 `chrome.*` namespace, and Apple Safari's WebExtension APIs.
- **Safari Web Extension App Wrapper:** Includes a native macOS/iOS Xcode project (`safari/CAMU AutoPass/`) and build script (`scripts/build-safari.sh`) using Apple's official WebExtension specifications.
- **Dual Background Dispatch:** Configures `background.scripts` for Firefox/Safari event pages alongside `background.service_worker` for Chromium service workers.
- **Browser-Specific Manifest Settings:** Configured `browser_specific_settings.gecko` (ID `camu-autopass@wecam.addon`, `strict_min_version: 142.0`) and `browser_specific_settings.safari` (`strict_min_version: 15.4`).
- **Standardized Extension Icons:** High-resolution icons (16px to 1024px) for browser toolbars, Safari extension tabs, and App Store metadata.
- **Safe DOM Injection:** Replaced dynamic `innerHTML` rendering in the history view with sanitized DOM creation methods (`replaceChildren` and `textContent`), adhering to Mozilla and Apple add-on security policies.
- **Automated Release Workflow:** GitHub Actions release workflow packages and attaches extension ZIP binaries to GitHub Releases automatically.
