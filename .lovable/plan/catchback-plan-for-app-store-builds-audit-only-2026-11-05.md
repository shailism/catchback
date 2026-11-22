# CatchBack: plan for app-store builds (audit only)

## Evidence on record (reported by the user, 4 Nov)
- On the live site: Share catch opened the phone's share menu; closing it showed "Sharing cancelled / Nothing was shared"; the species toggle, caption copy and image download worked.
- A fresh backup (3 catches + 4 trips) downloaded. The restore dialog was cancelled, so nothing was imported.
- With all CatchBack tabs closed and airplane mode on (wifi off), the live site reopened from the same browser history and showed the saved photos and 4 trips.
- This proves offline reopening and reading only. It does not prove saving a new record offline, a full browser restart, iPhone, the browser clearing stored data, or notifications.

## What the inspection found
- **No server dependencies block bundling.** The app has no server functions or data loaders. All data lives on the device in IndexedDB. The server-only parts are the page-rendering wrapper (`src/server.ts`) and the middleware in `src/start.ts`. A phone app does not need either.
- **A client-only entry already exists.** `offline.html` and `src/offline-entry.tsx` run the existing TanStack router without server rendering. `config/offline-entry.ts` builds them as a separate bundle. Capacitor can reuse this as its `index.html`, so no rewrite is needed.
- **No native project exists yet.** There is no `android/` folder, no `ios/` folder and no Capacitor config.
- **This workspace cannot make app binaries.** It runs Linux x86_64 with no Java, Gradle, Android SDK, adb or Xcode. An IPA cannot be built here, because that needs macOS and Xcode. An APK or AAB might be possible if an Android SDK and JDK were installed through nix. I have not checked that and do not claim it. The realistic route: source and config are made here, and binaries are built in Android Studio (Android) and Xcode on a Mac (iPhone).

## Moving browser data into the app
- The app stores data separately from Brave, so existing IndexedDB records cannot be carried across automatically.
- Use the existing v3 combined backup instead: export in Brave, then import in the app. Opening a file with the file picker should work inside the app's web view.
- **Problem:** the current backup export uses a browser download link, which phone web views usually ignore. The native build needs to export through the system share or save sheet (`@capacitor/filesystem` + `@capacitor/share`, both free).
- Image sharing hits the same limit, so Share catch should also use `@capacitor/share` in the native build.

## Phone notification work (not built)
- Add `@capacitor/local-notifications` (free, on the device, no server).
- Schedule from the existing pure function `src/lib/reminders.ts`. Reschedule every time the app opens and after any change to reminder settings, catch mutes, or a catch being added, deleted or imported.
- Android:
  - The notification permission (Android 13 and later).
  - A decision between exact and inexact timing. Exact alarms need an extra permission and may face Play Store policy review.
  - Rescheduling after the phone restarts. The plugin handles this, but it needs testing on a device.
- iOS:
  - A limit of 64 pending notifications, so only the soonest ones can be scheduled.
  - A permission prompt.
- The in-app reminders stay as they are. Notifications may only be described as working after a real device has received one while the app was closed.

## Account and build prerequisites (decisions for the user)
- **Google Play:** a developer account with a one-time registration fee. A signing key. A privacy policy URL. The data-safety form, which is simple here because data stays on the phone.
- **Apple:** an Apple Developer Program membership with a yearly fee. A Mac with Xcode. TestFlight for testing. App privacy labels.
- Both fees cost money, so they need your explicit decision first. Check current amounts on Google's and Apple's own sites. I have not looked them up.
- Before submitting: the store icon, splash screen and screenshots, plus the visual identity pass already recorded as required before submission.

## Features still planned, not built
- Live weather and conditions (Home shows demonstration conditions only).
- Similar-condition alerts.
- Photo species suggestions.
- Community, public posting and group sharing.
- Saved spots and gear logging.
- All Plus features.
- Phone notifications.
- Production check of the offline QA copy.

## Order of work
1. **Next change (doable here):** a native-ready static build.
2. The native project and an Android test build, made on your machine in Android Studio.
3. Native backup export and sharing.
4. Local notifications, Android first.
5. iOS project, notifications and TestFlight.
6. Visual identity pass, then store listings.

## Step 1 in detail: the single next change
Goal: produce a self-contained `dist/native/` folder that opens offline with no server.
- Add a `build:native` script that builds the existing client-only entry (`offline.html` → `index.html`) into `dist/native/`. Files load from relative paths. No service worker is registered.
- Add `capacitor.config.ts` (appId and name to be confirmed with you, `webDir: dist/native`) and the `@capacitor/core` + `@capacitor/cli` packages. Do not add the Android or iOS platforms yet.
- Make the service-worker guard in `src/lib/offline-policy.ts` also refuse when running inside the native app, with a unit test. Web behaviour stays unchanged.
- Check:
  - Serve `dist/native` as static files with the network blocked in disposable Chromium at 390px.
  - Open Journal, Trips and a catch detail page directly.
  - Add a disposable catch with a photo and confirm it reads back.
  - Import a disposable v3 backup.
  - Run the full test suite and the TypeScript check, and confirm the automatic build is OK.
- Not touched: the IndexedDB schema, backup formats, routes, the web offline worker, and your records.
- Afterwards you would run `npx cap add android`, `npx cap sync` and open the project in Android Studio to make a debug APK. I cannot run that step here.
