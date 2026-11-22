# Catchback

Catchback is a local-first fishing journal built with TanStack Start, React, TypeScript, and Tailwind CSS.

## Local development

Install Node.js and Bun, then run these commands from the repository root:

```sh
bun install --frozen-lockfile
bun run dev
```

Open the local URL printed by Vite. Use `bun run test` for the test suite and `bun run build` for a production web build.

On Windows with Node.js 26, run the tests in PowerShell with Node's built-in Web Storage disabled so Vitest uses jsdom's storage:

```powershell
$env:NODE_OPTIONS = '--no-webstorage'
bun run test
Remove-Item Env:NODE_OPTIONS
```

## Restoring journal data

Catches, photos, and trips are stored in the browser. To bring your existing journal to the local app, open **More** and import your JSON backup.
