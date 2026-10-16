# Dashboard scripts

- `build-store-templates.mjs` (`npm run templates:build`): writes the store
  templates' files under `src/pages/website/templates/generated/`.
- `import-store-templates.mjs` (`npm run templates:import`): adds those
  templates to the platform console, below.

## Importing the store templates into the console

Does what the console's Templates page does by hand for every row of
`src/pages/website/templates/generated/console/INDEX.md`, in that order:

| Step | Request | Body |
|---|---|---|
| New template | `POST /admin/templates` | name, kind `store`, category, tags, rtl (true only for the `-ar` copies), primaryColor, no thumbnail, free |
| New version | `POST /admin/templates/:id/versions` | `console/<key>.json` whole, `activate: true` |
| Publish | `POST /admin/templates/:id/publish` | none |

It first reads `GET /admin/templates`. A store template whose name is already
there is skipped, so running it twice adds nothing. It never edits, deletes or
unpublishes anything. The first failed request stops it, with the server's
whole answer and what was done before.

All commands are for Windows PowerShell, run in
`apps\merchant-dashboard`:

```powershell
cd "D:\zgAllin\STORE BUILDER MAIN\FRONTEND\trial-frontend\apps\merchant-dashboard"
```

### 1. Dry run (the default: sends nothing)

```powershell
node scripts/import-store-templates.mjs
```

Prints the 48 rows (name, kind, rtl, size) and checks every file against what
the API accepts. Exit code 0 means all of them are ready.

### 2. Settings, from the environment only

`ZIMOS_API_URL`: the API base the console calls, ending in `/api/v1` (in the
console, F12 → Network: any `/admin/...` request shows it; take everything
before `/admin`). There is no default.

```powershell
$env:ZIMOS_API_URL = "https://<api host>/api/v1"
```

`ZIMOS_ADMIN_TOKEN`: the console's access token. Sign in to the console, open
F12 → Console and type (it copies the token without showing it):

```js
copy(localStorage.getItem("sb.accessToken"))
```

Then in PowerShell, and empty the clipboard after:

```powershell
$env:ZIMOS_ADMIN_TOKEN = (Get-Clipboard)
Set-Clipboard -Value " "
```

The token works for a short time (15 minutes by default). The script says
how long it has left and refuses an expired one. Do not sign out of the
console while it runs. Never put the token in a file.

### 3. One template first

```powershell
node scripts/import-store-templates.mjs --apply --only xs-01
```

Check it in the console and in a store's gallery.

### 4. The rest

```powershell
node scripts/import-store-templates.mjs --apply --from xs-01-ar
```

Running everything with `--apply` alone is fine too: `xs-01` is skipped.

### If it stops

It prints the request, the status, the server's answer and what it did to
that template. Fix the cause, then run again from that template:

```powershell
node scripts/import-store-templates.mjs --apply --from <key> --resume-incomplete
```

`--resume-incomplete` finishes a template that a stopped run left with no
version (adds its version and publishes it). Without it such a template is
listed and left alone. A template that is there unpublished, or with other
settings than its row, is always left alone and listed for you to look at.

A `401` means the token expired or was refused: copy a fresh one (step 2) and
run again; what was finished is skipped.

### After

```powershell
Remove-Item Env:ZIMOS_ADMIN_TOKEN
```

The tests: `node node_modules/vitest/vitest.mjs run scripts/templateImport.test.mjs`.
