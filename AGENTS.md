<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Keep the offline build plugin in tracked config source, not ignored build output; append its HTML entry after TanStack establishes client input to preserve SSR/hydration and emit transformed asset URLs.
- Offline startup uses a generated Workbox worker and a client-rendered fallback reusing the existing TanStack router; SSR hydration is reserved for actual SSR documents. Register only through the guarded offline module outside previews; cache same-origin public shell/assets only and let updates wait for all old tabs to close so drafts are never forcibly reloaded.
- Catches (including photo Blobs) live in browser IndexedDB via src/lib/db.ts; there is no backend — keeps the prototype private and free.
- Manual trips use a separate additive IndexedDB store; never infer links to catch photos. Combined backups read a coherent snapshot and atomically restore both stores with conflict checks inside the write transaction; version-1 imports leave trips unchanged.
- Local writes request strict transaction durability where supported and saves verify committed details and photo bytes through a fresh read before confirmation; persistent storage is best-effort, never a guarantee against browser clearing, and failures remain visible without deleting data.
- Backup imports validate records and decode every embedded photo before one atomic IndexedDB transaction; confirmed matches are compared including photo bytes inside that transaction, kept active during Blob reads, to prevent partial restores and overwriting post-confirmation edits without network access.
- Reminder scheduling is a pure function in src/lib/reminders.ts with tests in src/test/reminders.test.ts; reminders are in-app only.
- Photo metadata is read with exifr; missing date/location stays empty until the user enters it — never auto-fill today or current location.
- Home is a coastal overview; the existing calendar and photo journal live at /journal, and /more retains backup/privacy and links to seasonal reminders so existing URLs stay valid.
- Demonstration conditions are isolated in a presentation-only component; never write them into catch records or treat them as live data or analysis.
- Insights uses a pure read-only local aggregation module and useCatches; counts describe records and recorded dates, never trips, effort or success rates, so summaries stay truthful without changing stored data.
- Catch cards and detail headers share one menu/dialog implementation; social choices use the existing device-share and sanitized-image helpers, never local catch URLs or target-app deep links, to preserve privacy and honest browser support.
- Native app builds (Capacitor) bundle the client-only offline entry via config/native-build.ts into dist-native; the web app-shell worker never registers inside the native shell — the app already has every file locally and must not depend on a server.
