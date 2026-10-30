# CAMU AutoPass – Version 1

A Chrome Manifest V3 extension starter for Thursday-only automation of **three separate daily applications** (Friday, Saturday, Sunday). Each daily form includes the Weekend leave and the integrated Weekend gate pass, so the expected total is **three form submissions**, not six.

## Defaults
- Time zone: Asia/Kolkata
- Allowed execution day/window: Thursday, 09:00–23:00
- Scheduler default: Thursday 09:05
- Supported CAMU leave pages: v1 and v2 (selectable in settings; default v2)
- Daily leave and gate-pass timing: 06:00–20:00 (same day for each application)
- Leave type: Leave (fixed; CAMU dropdown option)
- Gate pass type: Weekend (fixed)
- Gate pass reason: Weekend outing
- No documents uploaded

## Install
1. Extract the ZIP.
2. Open `chrome://extensions` in Chrome.
3. Enable Developer mode.
4. Select **Load unpacked** and choose this folder.
5. Sign in to CAMU in the same Chrome profile.
6. Open the extension and save your settings.

Chrome must be running and the computer awake during the Thursday execution window. V1 deliberately skips missed windows; recovery after a missed Thursday is deferred to V2.

## Important: CAMU selector calibration required
The supplied screenshot confirms the Leave Type dropdown options are Leave, On Duty, and Medical Leave. V1 now selects Leave (fixed). The Gate Pass Type remains Weekend. Therefore this package is a V1 implementation scaffold, **not yet verified against your live CAMU account**. Before enabling automatic Save, navigate to the actual Leave Management page at https://student.camu.in/v1/leaveManagement or https://student.camu.in/v2/leaveManagement, choose the matching **CAMU page version** in the extension, then use the **Test page detection** button, and inspect `content.js` if any field is not detected. The current adapter uses visible labels/placeholders and common native/custom dropdown patterns; CAMU may use custom widgets that need selector-specific adjustments.

The extension does not store your CAMU password, bypass authentication, or bypass CAPTCHA/MFA. It relies on your existing logged-in Chrome session. It clicks Save automatically after filling the form. Test with automation disabled first.

## Scheduling notes
Chrome alarms are not exact-to-the-minute guarantees. The worker checks every minute and starts at/after the configured time, but only on Thursday and only before 23:00 Asia/Kolkata. If Chrome is closed or the laptop is asleep, V1 cannot run. A missed Thursday is not replayed on Friday.

## Monthly activity
V1 stores only the latest run result and current execution state in extension storage. It does not provide a long-term activity log. The monthly-history UI/automatic monthly purge can be added after the CAMU DOM is calibrated.
