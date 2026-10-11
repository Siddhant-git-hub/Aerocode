# Aerocode client

React + Vite + Tailwind frontend for the Aerocode website generator.

## Run

```bash
# 1. backend (port 3001)  ->  start it the way you already do
# 2. frontend
npm install        # first time only (no new dependencies were added)
npm run dev        # http://localhost:5173
```

## The port problem (fixed)

The old `App.tsx` called `http://localhost:3000`, but the backend runs on **3001**.
Now the browser calls `/api/generate` on the Vite dev server and Vite forwards `/api/*`
to the backend (see `vite.config.ts`). To point at a different backend:

```bash
cp .env.example .env     # then edit VITE_BACKEND_URL
```

For a production build, set `VITE_API_URL` instead (the backend must allow CORS).

## What the backend sends

`POST /api/generate` with `{ prompt, category, type }`. The client reads a
**Server-Sent Events** stream (what the Aerocode backend sends):

```
data: {"phase":"PLANNING","message":"Architecting UI layout..."}
data: {"phase":"CODING","file":{"path":"index.html","content":"...","language":"html"}}
data: {"phase":"COMPLETE","message":"...","files":[ ...all files... ]}
```

`message` is shown live while generating, `file` events fill the "received" list, and the
`COMPLETE` event provides the final files. A `phase` of `ERROR`/`FAILED` (or an `error`
field) shows in the red banner. A plain JSON reply `{ success, files }` also works.

If a file ends mid-way (the model hit its output limit) an amber banner says which one.

## Layout

- Top bar: request input, site type, voice input, Generate / Stop
- Scroll down: the workspace tilts out of the 3D scene and settles flat
- Left: file manager (folders, active file, "being written" dot, Download .zip)
- Middle: code, typed out as it is written. **Copy code** copies the whole file.
  **Open in browser** inlines the CSS/JS into index.html and opens it in a new tab.
- Right: live preview with desktop / tablet / phone widths. Drag the divider to resize.

Shortcuts: Enter = generate, Shift+Enter = new line, Ctrl/Cmd+Enter = generate from anywhere.

## Structure

```
src/
  App.tsx                  page, scroll-depth effect, generate flow
  components/
    Scene3D.tsx            canvas 3D scene (knot, floor grid, dust)
    PromptBar.tsx          top input bar
    Workspace.tsx          file tree | code | preview layout
    FileTree.tsx  CodePane.tsx  PreviewPane.tsx  CopyButton.tsx
  hooks/useReveal.ts       "files are being written" playback
  lib/api.ts               backend call + response normalising
  lib/bundle.ts            inlines css/js, opens in browser
  lib/zip.ts  highlight.ts  clipboard.ts
```
