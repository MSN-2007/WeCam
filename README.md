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
- Supported CAMU page versions: **v1** (`https://student.camu.in/v1/leaveManagement`) and **v2** (`https://student.camu.in/v2/leaveManagement`) (selectable in settings; default v2)
- Daily leave and gate-pass timing: 06:00–20:00 (same day for each application)
- Leave type: Leave (fixed; CAMU dropdown option)
- Gate pass type: Weekend (`Week End Gate Pass` / `Weekend`)
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
6. Click the extension icon in your toolbar, select your CAMU page version (`v1` or `v2`), and save your desired settings.

### Firefox & Firefox-based Browsers (Firefox, LibreWolf, Zen, Waterfox, Floorp)
1. **Download the ZIP**: Download `camu-autopass-v3.5.0.zip` from the table above and extract it into a folder.
2. Open `about:debugging` in Firefox.
3. Click on **This Firefox** in the left sidebar.
4. Under the **Temporary Extensions** section, click **Load Temporary Add-on…**.
5. Select the `manifest.json` file inside the unzipped folder.
6. Sign in to CAMU in the same Firefox profile.
7. Click the extension icon in your toolbar, select your CAMU page version (`v1` or `v2`), and save your desired settings.

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

The browser must be running and the computer awake during the Thursday execution window for scheduled runs. The extension also includes a **Run now** button: open either CAMU Leave Management page (v1 or v2), then click Run now to start the same three-day workflow immediately. Manual runs calculate the next full Friday–Sunday weekend.

## Important: CAMU selector calibration & multi-version support
The extension supports both CAMU portal versions:
- **v1**: `https://student.camu.in/v1/leaveManagement`
- **v2**: `https://student.camu.in/v2/leaveManagement`

Before enabling automatic Save, navigate to your institution's Leave Management page (v1 or v2), choose the matching **CAMU page version** in the extension popup, use the **Test page detection** button, and inspect `content.js` if any field is not detected. The DOM adapter supports both standard native inputs and modern React-Select / react-datetime widgets.

Important: CAMU is understood to accept applications only Thursday 09:00–23:00. Run now bypasses the extension scheduler restriction, but it cannot bypass CAMU server-side restrictions; if clicked outside CAMU’s permitted window, CAMU may reject the application. Use it during the Thursday window for actual submissions. The extension does not store your CAMU password, bypass authentication, or bypass CAPTCHA/MFA. It relies on your existing logged-in session. It clicks Save automatically after filling the form. Test with automation disabled first.

## Scheduling notes
Alarms are not exact-to-the-minute guarantees. The worker checks every minute and starts at/after the configured time, but only on Thursday and only before 23:00 Asia/Kolkata. If the browser is closed or the laptop is asleep, automation cannot run. A missed Thursday is not replayed on Friday.

## Monthly activity
Stores the latest run result and current execution state in extension storage. Monthly history is displayed in the popup.

V1.5 note: If CAMU is reached through in-app/SPA navigation, the content script may not be injected by the initial URL matching. The popup checks for the content script and injects it into the active Leave Management tab when needed (requires the scripting permission).

V1.6 fixes a malformed regular expression in content.js that prevented the entire content script from parsing. It also waits for the injected script's PING response before sending detection or run messages, and reports injection errors more clearly.

## V3.5 Cross-Browser Compatibility (Chrome, Firefox & Safari) & Multi-Version (v1 + v2) Support
- **Unified Extension API (`browser` / `chrome`):** Handles Promise resolution transparently across Firefox's native Promise-based `browser.*` namespace, Chrome's Manifest V3 `chrome.*` namespace, and Apple Safari's WebExtension APIs.
- **Dual Portal Version Support:** Automatically matches and injects into both `https://student.camu.in/v1/leaveManagement*` and `https://student.camu.in/v2/leaveManagement*`.
- **Configurable Scheduler Page Version:** Easily choose whether Thursday scheduled runs launch the `v1` or `v2` portal.
- **Safari Web Extension App Wrapper:** Includes a native macOS/iOS Xcode project (`safari/CAMU AutoPass/`) and build script (`scripts/build-safari.sh`) using Apple's official WebExtension specifications.
- **Dual Background Dispatch:** Configures `background.scripts` for Firefox/Safari event pages alongside `background.service_worker` for Chromium service workers.
- **Browser-Specific Manifest Settings:** Configured `browser_specific_settings.gecko` (ID `camu-autopass@wecam.addon`, `strict_min_version: 142.0`) and `browser_specific_settings.safari` (`strict_min_version: 15.4`).
- **Standardized Extension Icons:** High-resolution icons (16px to 1024px) for browser toolbars, Safari extension tabs, and App Store metadata.
- **Safe DOM Injection:** Replaced dynamic `innerHTML` rendering in the history view with sanitized DOM creation methods (`replaceChildren` and `textContent`), adhering to Mozilla and Apple add-on security policies.
- **Automated Release Workflow:** GitHub Actions release workflow packages and attaches extension ZIP binaries to GitHub Releases automatically.

## Single-Click Workflow & Multi-Dropdown Calibration
- **Forward-Only Target Discovery (`findDropdownAfterLabel`)**: Uses DOM relative position ordering (`Node.DOCUMENT_POSITION_FOLLOWING`) to ensure that dropdown lookups strictly resolve to the control that appears **after** the corresponding label. This completely eliminates cross-field interference where `Gate Pass Type` accidentally targeted the preceding `Leave Type` control.
- **Scoped Dropdown Reading (`readDropdownValue`)**: Reads the active selection directly from the target control's single-value node, value container, or input, without bleeding across other form elements.
- **Pre-Selected Option Pass-Through**: Detects when CAMU has already initialized a dropdown with the desired default (such as `"Leave"` on form open), seamlessly proceeding without redundant clicks that could deselect or trigger false verification errors.
- **Multi-Trigger React-Select Menu Opening**: Deploys a comprehensive event dispatching sequence (control mouse events, indicator arrow clicks, input focus, and keyboard `ArrowDown`) to guarantee that dynamic React-Select dropdowns (like `Gate Pass Type`) open and commit their options reliably on the very first run.
- **Modal Lifecycle Awareness (`isFormAlreadyOpen`)**: Detects if the leave and gate-pass form modal is already open, avoiding accidental clicks on top-level headers or back buttons (`<-- Apply Leave and Gate Pass`).
