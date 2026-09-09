# Scrapbook Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the linear Tiptap rich-text diary editor with a free-form "scrapbook" canvas where text boxes and images can be dragged, resized, rotated, and layered anywhere on a page.

**Architecture:** New `frontend/src/components/scrapbook/` module (`ScrapbookEditor`, `TextElement`, `ImageElement`, `Toolbar`) renders/edits a JSON layout of absolutely-positioned elements using `react-moveable` for drag/resize/rotate. The backend gains a new nullable `entries.layout jsonb` column threaded through the existing Go handlers. `diary-form.tsx` is rewired to use the new editor; `diary-grid.tsx` renders the same component read-only (scaled down) for card previews, and disables editing for legacy (pre-scrapbook) entries.

**Tech Stack:** Next.js/React 19 (frontend), Go/Gin + `lib/pq` + Postgres (backend), `react-moveable` (new dependency).

**Spec:** `docs/superpowers/specs/2026-09-06-scrapbook-editor-design.md`

## Global Constraints

- This repo has **no frontend test runner** and **no Go test files** anywhere (confirmed via `CLAUDE.md` and repo inspection). Do not introduce a testing framework as part of this plan — verify each task manually: Go tasks via `go build` + `curl` against the running `diary-backend` container; frontend tasks via `npm run build`/`tsc --noEmit` + manual check in the browser (the project's established verification pattern this session).
- Full stack runs via `docker compose` (`docker-compose.yml` at repo root) — rebuild the relevant service (`docker compose build backend` / `docker compose build frontend` then `docker compose up -d <service>`) after each backend/frontend task to verify against the real running app.
- Local login for manual verification: username `boy`, password `test1234` (local DB only).
- Preserve Thai UI strings and code comments already in touched files — don't translate existing Thai text.
- `react-moveable`'s exact event payload field names (`left`/`top`/`width`/`height`/`drag.left`/`drag.top`/`rotate`) are given from best knowledge of the library; the task that wires it up includes a step to check the installed version's TypeScript declarations and adjust field names if they've drifted.

---

## Task 1: Backend — `layout` column + Go model field

**Files:**
- Modify: `backend/internal/models/entry.go`
- DB: run a manual `ALTER TABLE` against the running `diary-db` container (no migration tooling exists in this repo — matches its existing ad-hoc SQL convention)

**Interfaces:**
- Produces: `models.Entry.Layout json.RawMessage` (JSON tag `"layout,omitempty"`) — a raw, unparsed JSON blob consumed by Task 2's handlers and eventually the frontend's `ScrapbookLayout` shape (Task 3).

- [ ] **Step 1: Add the column to the local database**

```bash
docker exec diary-db psql -U postgres -d diary -c "ALTER TABLE entries ADD COLUMN layout jsonb;"
```

- [ ] **Step 2: Verify the column exists**

```bash
docker exec diary-db psql -U postgres -d diary -c '\d entries'
```

Expected: output lists a `layout | jsonb` row alongside the existing columns.

- [ ] **Step 3: Add the `Layout` field to the Go model**

Edit `backend/internal/models/entry.go` to:

```go
package models

import (
	"encoding/json"

	"github.com/lib/pq"
)

type Entry struct {
	ID          int             `json:"id"`
	Title       string          `json:"title"`
	Content     string          `json:"content"`
	CreatedDate string          `json:"created_date"`
	CreatedBy   string          `json:"created_by"`
	Images      pq.StringArray  `json:"images"`
	Layout      json.RawMessage `json:"layout,omitempty"`
}
```

- [ ] **Step 4: Verify the backend still builds**

```bash
cd backend && go build -o /dev/null ./cmd/main.go
```

Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/models/entry.go
git commit -m "feat(backend): add nullable layout column and model field for scrapbook entries"
```

---

## Task 2: Backend — wire `layout` through the entry handlers

**Files:**
- Modify: `backend/internal/handlers/diary_handler.go` (all four functions: `GetEntries`, `CreateEntry`, `UpdateEntry`, `GetEntry`)

**Interfaces:**
- Consumes: `models.Entry.Layout json.RawMessage` from Task 1.
- Produces: `/entries` (GET/POST), `/entries/:id` (GET/PUT) now accept and return a `layout` JSON field. Frontend Task 3 depends on this being present in API responses.

- [ ] **Step 1: Update `GetEntries` to select and scan `layout`**

In `backend/internal/handlers/diary_handler.go`, change:

```go
	query := `SELECT id, title, content, created_date, COALESCE(created_by, ''), images 
			  FROM entries 
			  WHERE user_id = $3 
			  ORDER BY id DESC LIMIT $1 OFFSET $2`
```

to:

```go
	query := `SELECT id, title, content, created_date, COALESCE(created_by, ''), images, layout 
			  FROM entries 
			  WHERE user_id = $3 
			  ORDER BY id DESC LIMIT $1 OFFSET $2`
```

and change:

```go
		err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images)
```

to:

```go
		err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &e.Layout)
```

- [ ] **Step 2: Update `CreateEntry` to insert `layout`**

Change:

```go
	userID := c.MustGet("user_id")

	// เพิ่ม user_id ลงใน INSERT query
	query := `INSERT INTO entries (title, content, created_by, images, user_id) 
              VALUES ($1, $2, $3, $4, $5) RETURNING id, created_date`

	err := h.DB.QueryRow(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), userID).
		Scan(&input.ID, &input.CreatedDate)
```

to:

```go
	userID := c.MustGet("user_id")

	var layoutParam interface{}
	if len(input.Layout) > 0 {
		layoutParam = string(input.Layout)
	}

	// เพิ่ม user_id และ layout ลงใน INSERT query
	query := `INSERT INTO entries (title, content, created_by, images, user_id, layout) 
              VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id, created_date`

	err := h.DB.QueryRow(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), userID, layoutParam).
		Scan(&input.ID, &input.CreatedDate)
```

- [ ] **Step 3: Update `UpdateEntry` to set `layout`**

Change:

```go
	query := `UPDATE entries SET title = $1, content = $2, created_by = $3, images = $4 
			  WHERE id = $5 AND user_id = $6`
	res, err := h.DB.Exec(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), id, userID)
```

to:

```go
	var layoutParam interface{}
	if len(input.Layout) > 0 {
		layoutParam = string(input.Layout)
	}

	query := `UPDATE entries SET title = $1, content = $2, created_by = $3, images = $4, layout = $5::jsonb 
			  WHERE id = $6 AND user_id = $7`
	res, err := h.DB.Exec(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), layoutParam, id, userID)
```

- [ ] **Step 4: Update `GetEntry` to select and scan `layout`**

Change:

```go
	query := `SELECT id, title, content, created_date, created_by, images 
			  FROM entries WHERE id = $1 AND user_id = $2`
	err := h.DB.QueryRow(query, id, userID).
		Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images)
```

to:

```go
	query := `SELECT id, title, content, created_date, created_by, images, layout 
			  FROM entries WHERE id = $1 AND user_id = $2`
	err := h.DB.QueryRow(query, id, userID).
		Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &e.Layout)
```

- [ ] **Step 5: Build and rebuild the running backend container**

```bash
cd backend && go build -o /dev/null ./cmd/main.go
cd .. && docker compose build backend && docker compose up -d backend
```

Expected: clean build, container restarts without error (`docker logs diary-backend --tail 10` shows `Listening and serving HTTP on :8888`).

- [ ] **Step 6: Verify round-trip with curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:9090/login -H 'Content-Type: application/json' -d '{"username":"boy","password":"test1234"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

curl -s -X POST http://localhost:9090/entries -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"scrapbook test","content":"","created_by":"Watchara","images":[],"layout":{"pageWidth":794,"elements":[{"id":"el_1","type":"text","x":10,"y":10,"width":100,"height":40,"rotation":0,"zIndex":1,"text":"hi","color":"#000","fontFamily":"Prompt","fontSize":16}]}}'
```

Expected: `200` response echoing back `"layout":{"pageWidth":794,...}` with the same structure. Then:

```bash
curl -s "http://localhost:9090/entries?page=1&limit=1" -H "Authorization: Bearer $TOKEN"
```

Expected: the same entry appears first with its `layout` field intact, and any pre-existing legacy entries in the list have **no `layout` key at all** (confirms `omitempty` works for `NULL` rows).

- [ ] **Step 7: Commit**

```bash
git add backend/internal/handlers/diary_handler.go
git commit -m "feat(backend): read and write the layout field on entry CRUD endpoints"
```

---

## Task 3: Frontend — scrapbook types + `react-moveable` dependency

**Files:**
- Create: `frontend/src/types/scrapbook.ts`
- Modify: `frontend/src/services/api.ts:6-13` (the `Entry` interface)
- Modify: `frontend/package.json` (via `npm install`)

**Interfaces:**
- Produces: `ScrapElement`, `TextScrapElement`, `ImageScrapElement`, `ScrapbookLayout` types, and the constants `PAGE_WIDTH`, `FONT_OPTIONS` — consumed by every later frontend task. `Entry.layout?: ScrapbookLayout | null` — consumed by `diary-form.tsx` and `diary-grid.tsx`.

- [ ] **Step 1: Install `react-moveable`**

```bash
cd frontend && npm install react-moveable
```

Expected: `package.json`/`package-lock.json` updated, no peer-dependency errors (already dry-run verified against React 19).

- [ ] **Step 2: Create the shared scrapbook types**

Create `frontend/src/types/scrapbook.ts`:

```typescript
export interface TextScrapElement {
  id: string
  type: "text"
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  text: string
  color: string
  fontFamily: string
  fontSize: number
}

export interface ImageScrapElement {
  id: string
  type: "image"
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  src: string
}

export type ScrapElement = TextScrapElement | ImageScrapElement

export interface ScrapbookLayout {
  pageWidth: number
  elements: ScrapElement[]
}

export const PAGE_WIDTH = 794
export const PAGE_HEIGHT_MIN = 1123
export const FONT_OPTIONS = ["Prompt", "Georgia", "Courier New"] as const

export function newElementId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
```

- [ ] **Step 3: Extend the `Entry` interface**

In `frontend/src/services/api.ts`, change:

```typescript
export interface Entry {
  id: number;
  title: string;
  content: string;
  created_date: string;
  created_by: string;
  images: string[];
}
```

to:

```typescript
import { ScrapbookLayout } from "@/types/scrapbook";

export interface Entry {
  id: number;
  title: string;
  content: string;
  created_date: string;
  created_by: string;
  images: string[];
  layout?: ScrapbookLayout | null;
}
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "scrapbook|services/api"
```

Expected: no output (pre-existing unrelated errors in `components/ui/*` from missing packages are fine and out of scope — see `CLAUDE.md`).

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types/scrapbook.ts frontend/src/services/api.ts
git commit -m "feat(frontend): add scrapbook layout types and react-moveable dependency"
```

---

## Task 4: Frontend — `TextElement` and `ImageElement` renderers

**Files:**
- Create: `frontend/src/components/scrapbook/TextElement.tsx`
- Create: `frontend/src/components/scrapbook/ImageElement.tsx`

**Interfaces:**
- Consumes: `TextScrapElement`, `ImageScrapElement` from `@/types/scrapbook` (Task 3).
- Produces: `<TextElement element editable onChangeText />` and `<ImageElement element />` — consumed by `ScrapbookEditor` (Task 5).

- [ ] **Step 1: Create `TextElement.tsx`**

```tsx
"use client"

import { useRef } from "react"
import DOMPurify from "isomorphic-dompurify"
import { TextScrapElement } from "@/types/scrapbook"

interface TextElementProps {
  element: TextScrapElement
  editable: boolean
  onChangeText: (text: string) => void
}

export function TextElement({ element, editable, onChangeText }: TextElementProps) {
  const ref = useRef<HTMLDivElement>(null)
  const sanitized = DOMPurify.sanitize(element.text, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "u", "br"],
    ALLOWED_ATTR: [],
  })

  return (
    <div
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      onBlur={() => {
        if (!editable || !ref.current) return
        onChangeText(ref.current.innerHTML)
      }}
      className="w-full h-full overflow-hidden outline-none"
      style={{
        color: element.color,
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
      }}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
```

- [ ] **Step 2: Create `ImageElement.tsx`**

```tsx
"use client"

import { ImageScrapElement } from "@/types/scrapbook"

interface ImageElementProps {
  element: ImageScrapElement
}

export function ImageElement({ element }: ImageElementProps) {
  return (
    <img
      src={element.src}
      alt=""
      draggable={false}
      className="w-full h-full object-cover select-none"
    />
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "scrapbook/TextElement|scrapbook/ImageElement"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/scrapbook/TextElement.tsx frontend/src/components/scrapbook/ImageElement.tsx
git commit -m "feat(frontend): add scrapbook text and image element renderers"
```

---

## Task 5: Frontend — `ScrapbookEditor` canvas

**Files:**
- Create: `frontend/src/components/scrapbook/ScrapbookEditor.tsx`

**Interfaces:**
- Consumes: `ScrapElement`, `TextScrapElement`, `ImageScrapElement`, `PAGE_WIDTH`, `PAGE_HEIGHT_MIN`, `newElementId` from `@/types/scrapbook` (Task 3); `TextElement`, `ImageElement` (Task 4); `Toolbar` (Task 6 — imported here even though written next, since `ScrapbookEditor` owns the add/update/delete logic `Toolbar` triggers).
- Produces: `<ScrapbookEditor elements onChange editable token scale />` — the single public entry point consumed by `diary-form.tsx` (Task 7, `editable`) and `diary-grid.tsx` (Task 8, read-only).

- [ ] **Step 1: Check the installed `react-moveable` event types**

```bash
cd frontend && grep -n "left\|top\|rotate\b" node_modules/react-moveable/declaration/types.d.ts | head -30
```

Read the output. Confirm `OnDrag` exposes `left`/`top`, `OnResize` exposes `width`/`height`/`drag.left`/`drag.top`, and `OnRotate` exposes `rotate`. If any field name differs, use the actual name from this file in Step 3 below instead of the one shown.

- [ ] **Step 2: Create `ScrapbookEditor.tsx`**

```tsx
"use client"

import { useMemo, useRef, useState } from "react"
import Moveable from "react-moveable"
import {
  ScrapElement,
  TextScrapElement,
  ImageScrapElement,
  PAGE_WIDTH,
  PAGE_HEIGHT_MIN,
  newElementId,
} from "@/types/scrapbook"
import { TextElement } from "./TextElement"
import { ImageElement } from "./ImageElement"
import { Toolbar } from "./Toolbar"

interface ScrapbookEditorProps {
  elements: ScrapElement[]
  onChange: (elements: ScrapElement[]) => void
  editable: boolean
  token?: string
  scale?: number
}

export function ScrapbookEditor({ elements, onChange, editable, token, scale = 1 }: ScrapbookEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const elementRefs = useRef(new Map<string, HTMLDivElement>())

  const canvasHeight = useMemo(
    () => Math.max(PAGE_HEIGHT_MIN, ...elements.map((e) => e.y + e.height + 80)),
    [elements]
  )

  const selectedElement = elements.find((e) => e.id === selectedId) ?? null

  const updateElement = (id: string, patch: Partial<ScrapElement>) => {
    onChange(elements.map((e) => (e.id === id ? ({ ...e, ...patch } as ScrapElement) : e)))
  }

  const handleAddText = () => {
    const offset = (elements.length % 5) * 20
    const newElement: TextScrapElement = {
      id: newElementId(),
      type: "text",
      x: 40 + offset,
      y: 40 + offset,
      width: 220,
      height: 100,
      rotation: 0,
      zIndex: elements.length + 1,
      text: "พิมพ์ข้อความที่นี่...",
      color: "#222222",
      fontFamily: "Prompt",
      fontSize: 18,
    }
    onChange([...elements, newElement])
    setSelectedId(newElement.id)
  }

  const handleAddImageFile = async (file: File) => {
    if (!token) return
    const formData = new FormData()
    formData.append("media", file)
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9090"
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) return
    const data = await res.json()
    const url: string | undefined = data.paths?.[0]
    if (!url) return
    const offset = (elements.length % 5) * 20
    const newElement: ImageScrapElement = {
      id: newElementId(),
      type: "image",
      x: 40 + offset,
      y: 40 + offset,
      width: 240,
      height: 240,
      rotation: 0,
      zIndex: elements.length + 1,
      src: url,
    }
    onChange([...elements, newElement])
    setSelectedId(newElement.id)
  }

  const handleDeleteSelected = () => {
    if (!selectedId) return
    onChange(elements.filter((e) => e.id !== selectedId))
    setSelectedId(null)
  }

  const handleBringToFront = () => {
    if (!selectedId) return
    const maxZ = Math.max(0, ...elements.map((e) => e.zIndex))
    updateElement(selectedId, { zIndex: maxZ + 1 })
  }

  const handleSendToBack = () => {
    if (!selectedId) return
    const minZ = Math.min(0, ...elements.map((e) => e.zIndex))
    updateElement(selectedId, { zIndex: minZ - 1 })
  }

  return (
    <div>
      {editable && (
        <Toolbar
          selectedElement={selectedElement}
          onAddText={handleAddText}
          onAddImageFile={handleAddImageFile}
          onUpdateSelected={(patch) => selectedId && updateElement(selectedId, patch)}
          onDeleteSelected={handleDeleteSelected}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
        />
      )}

      <div
        className="relative bg-white mx-auto overflow-hidden rounded-md border border-border"
        style={{
          width: PAGE_WIDTH * scale,
          height: canvasHeight * scale,
        }}
        onClick={(e) => {
          if (editable && e.target === e.currentTarget) setSelectedId(null)
        }}
      >
        <div
          style={{
            width: PAGE_WIDTH,
            height: canvasHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "relative",
          }}
        >
          {elements.map((el) => (
            <div
              key={el.id}
              ref={(node) => {
                if (node) elementRefs.current.set(el.id, node)
                else elementRefs.current.delete(el.id)
              }}
              onMouseDown={() => editable && setSelectedId(el.id)}
              style={{
                position: "absolute",
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                transform: `rotate(${el.rotation}deg)`,
                zIndex: el.zIndex,
                cursor: editable ? "move" : "default",
              }}
            >
              {el.type === "text" ? (
                <TextElement
                  element={el}
                  editable={editable}
                  onChangeText={(text) => updateElement(el.id, { text })}
                />
              ) : (
                <ImageElement element={el} />
              )}
            </div>
          ))}

          {editable && selectedId && elementRefs.current.get(selectedId) && (
            <Moveable
              target={elementRefs.current.get(selectedId)!}
              draggable
              resizable
              rotatable
              onDrag={({ target, left, top }) => {
                ;(target as HTMLElement).style.left = `${left}px`
                ;(target as HTMLElement).style.top = `${top}px`
                updateElement(selectedId, { x: left, y: top })
              }}
              onResize={({ target, width, height, drag }) => {
                ;(target as HTMLElement).style.width = `${width}px`
                ;(target as HTMLElement).style.height = `${height}px`
                ;(target as HTMLElement).style.left = `${drag.left}px`
                ;(target as HTMLElement).style.top = `${drag.top}px`
                updateElement(selectedId, { width, height, x: drag.left, y: drag.top })
              }}
              onRotate={({ target, rotate }) => {
                ;(target as HTMLElement).style.transform = `rotate(${rotate}deg)`
                updateElement(selectedId, { rotation: rotate })
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Adjust event field names if Step 1 found differences**

If the installed `react-moveable` version's `OnDrag`/`OnResize`/`OnRotate` types use different field names than `left`/`top`/`width`/`height`/`drag.left`/`drag.top`/`rotate`, update the three `onDrag`/`onResize`/`onRotate` handlers above to match.

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "ScrapbookEditor"
```

Expected: no output (this task references `Toolbar`, written in Task 6 — if this task is executed before Task 6 exists, create a temporary empty `Toolbar.tsx` stub exporting an empty component so this typechecks in isolation, then let Task 6 replace it).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/scrapbook/ScrapbookEditor.tsx
git commit -m "feat(frontend): add ScrapbookEditor canvas with drag/resize/rotate/layering"
```

---

## Task 6: Frontend — `Toolbar`

**Files:**
- Create: `frontend/src/components/scrapbook/Toolbar.tsx`

**Interfaces:**
- Consumes: `ScrapElement`, `FONT_OPTIONS` from `@/types/scrapbook` (Task 3).
- Produces: `<Toolbar selectedElement onAddText onAddImageFile onUpdateSelected onDeleteSelected onBringToFront onSendToBack />` — consumed by `ScrapbookEditor` (Task 5).

- [ ] **Step 1: Create `Toolbar.tsx`**

```tsx
"use client"

import { useRef } from "react"
import { Type, ImagePlus, Trash2, BringToFront, SendToBack } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrapElement, FONT_OPTIONS } from "@/types/scrapbook"

interface ToolbarProps {
  selectedElement: ScrapElement | null
  onAddText: () => void
  onAddImageFile: (file: File) => void
  onUpdateSelected: (patch: Partial<ScrapElement>) => void
  onDeleteSelected: () => void
  onBringToFront: () => void
  onSendToBack: () => void
}

export function Toolbar({
  selectedElement,
  onAddText,
  onAddImageFile,
  onUpdateSelected,
  onDeleteSelected,
  onBringToFront,
  onSendToBack,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 mb-3 rounded-xl border border-border bg-muted/50">
      <Button type="button" variant="ghost" size="sm" onClick={onAddText}>
        <Type className="size-4 mr-1.5" /> ข้อความ
      </Button>

      <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
        <ImagePlus className="size-4 mr-1.5" /> รูปภาพ
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onAddImageFile(file)
          e.target.value = ""
        }}
      />

      {selectedElement && (
        <>
          <div className="w-[1px] h-6 bg-border mx-1" />

          {selectedElement.type === "text" && (
            <>
              <input
                type="color"
                value={selectedElement.color}
                onChange={(e) => onUpdateSelected({ color: e.target.value })}
                className="size-8 rounded cursor-pointer border border-border"
                title="สีข้อความ"
              />
              <select
                value={selectedElement.fontFamily}
                onChange={(e) => onUpdateSelected({ fontFamily: e.target.value })}
                className="h-8 rounded-md border border-border bg-background px-2 text-sm"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={8}
                max={96}
                value={selectedElement.fontSize}
                onChange={(e) => onUpdateSelected({ fontSize: Number(e.target.value) })}
                className="h-8 w-16 rounded-md border border-border bg-background px-2 text-sm"
                title="ขนาดตัวอักษร"
              />
            </>
          )}

          <Button type="button" variant="ghost" size="sm" onClick={onBringToFront} title="เอาไว้หน้าสุด">
            <BringToFront className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSendToBack} title="เอาไว้หลังสุด">
            <SendToBack className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDeleteSelected}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "scrapbook/Toolbar|scrapbook/ScrapbookEditor"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/scrapbook/Toolbar.tsx
git commit -m "feat(frontend): add scrapbook toolbar for adding elements and per-element styling"
```

---

## Task 7: Frontend — rewire `diary-form.tsx`

**Files:**
- Modify: `frontend/src/components/diary-form.tsx` (full rewrite of body)

**Interfaces:**
- Consumes: `ScrapbookEditor` (Task 5), `ScrapElement`, `ImageScrapElement`, `PAGE_WIDTH` (Task 3).
- Produces: same public `DiaryForm` props as before (`onSuccess`, `initialData`, `token`, `userId`) — no change to how `page.tsx` invokes it.

- [ ] **Step 1: Replace `diary-form.tsx`**

```tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrapbookEditor } from "@/components/scrapbook/ScrapbookEditor"
import { ScrapElement, ImageScrapElement, PAGE_WIDTH } from "@/types/scrapbook"
import { createEntry, updateEntry, Entry } from "@/services/api"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface DiaryFormProps {
  onSuccess: () => void;
  initialData?: Entry | null;
  token: string | undefined;
  userId: number | undefined;
}

export function DiaryForm({ onSuccess, initialData, token, userId }: DiaryFormProps) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(initialData?.title || "")
  const [elements, setElements] = useState<ScrapElement[]>(initialData?.layout?.elements || [])

  useEffect(() => {
    setTitle(initialData?.title || "")
    setElements(initialData?.layout?.elements || [])
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return toast.error("กรุณาเข้าสู่ระบบใหม่");
    if (!title.trim()) return toast.error("กรุณากรอกหัวข้อ");

    setLoading(true)

    try {
      const images = elements
        .filter((el): el is ImageScrapElement => el.type === "image")
        .map((el) => el.src)

      const payload = {
        title,
        content: "",
        images,
        created_by: "Watchara",
        layout: { pageWidth: PAGE_WIDTH, elements },
      };

      if (initialData?.id) {
        await updateEntry(initialData.id, payload, token);
      } else {
        await createEntry(payload, token);
      }

      onSuccess();
    } catch (err: any) {
      toast.error("บันทึกไม่สำเร็จ", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">หัวข้อเรื่องราว</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ระบุหัวข้อไดอารี่..."
          required
          className="text-lg font-bold bg-card"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">ตกแต่งหน้าบันทึก</label>
        <ScrapbookEditor elements={elements} onChange={setElements} editable token={token} />
      </div>

      <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังบันทึก...</> : (initialData ? "อัปเดตไดอารี่" : "บันทึกเรื่องราววันนี้")}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "diary-form"
```

Expected: no output.

- [ ] **Step 3: Rebuild frontend and verify in the browser**

```bash
cd .. && docker compose build frontend && docker compose up -d frontend
```

Log in (username `boy`, password `test1234`) at `http://localhost:3000/login`, click "New Entry", add a title, click "ข้อความ" to add a text box, drag/resize/rotate it, click "รูปภาพ" and upload an image, drag it around, save. Confirm no console errors and the entry appears in the list (card rendering isn't updated until Task 8, so it'll show a blank/fallback body for now — that's expected here).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/diary-form.tsx
git commit -m "feat(frontend): replace Tiptap editor with ScrapbookEditor in DiaryForm"
```

---

## Task 8: Frontend — rewire `diary-grid.tsx` for scrapbook previews + legacy lock

**Files:**
- Modify: `frontend/src/components/diary-grid.tsx`

**Interfaces:**
- Consumes: `ScrapbookEditor` (Task 5), `Entry.layout` (Task 3).

- [ ] **Step 1: Add the import**

In `frontend/src/components/diary-grid.tsx`, add near the top:

```tsx
import { ScrapbookEditor } from "@/components/scrapbook/ScrapbookEditor"
import { PAGE_WIDTH } from "@/types/scrapbook"
```

- [ ] **Step 2: Replace the content-rendering block**

Change:

```tsx
          <CardContent className="space-y-4">
            {/* ✅ 3. ใช้งาน getCleanHtml ก่อนแสดงผล */}
            <div
              className="prose dark:prose-invert max-w-none text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: getCleanHtml(entry.content) }}
            />
```

to:

```tsx
          <CardContent className="space-y-4">
            {entry.layout && entry.layout.elements.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border" style={{ maxHeight: 320 }}>
                <ScrapbookEditor
                  elements={entry.layout.elements}
                  onChange={() => {}}
                  editable={false}
                  scale={320 / PAGE_WIDTH}
                />
              </div>
            ) : (
              <div
                className="prose dark:prose-invert max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: getCleanHtml(entry.content) }}
              />
            )}
```

- [ ] **Step 3: Disable "แก้ไข" for legacy entries**

Change:

```tsx
            <Button variant="ghost" size="sm" onClick={() => onEdit?.(entry.id)} className="text-foreground hover:bg-accent hover:text-accent-foreground rounded-lg">
              <Pencil className="h-4 w-4 mr-1.5" /> แก้ไข
            </Button>
```

to:

```tsx
            <Button
              variant="ghost"
              size="sm"
              disabled={!entry.layout}
              title={!entry.layout ? "บันทึกเก่า ไม่รองรับการแก้ไข — กรุณาลบแล้วสร้างใหม่" : undefined}
              onClick={() => entry.layout && onEdit?.(entry.id)}
              className="text-foreground hover:bg-accent hover:text-accent-foreground rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Pencil className="h-4 w-4 mr-1.5" /> แก้ไข
            </Button>
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "diary-grid"
```

Expected: no output.

- [ ] **Step 5: Rebuild frontend and verify in the browser**

```bash
cd .. && docker compose build frontend && docker compose up -d frontend
```

Log in, confirm: (a) the 23 pre-existing legacy entries still display their old HTML content in cards, with "แก้ไข" visibly disabled/greyed out; (b) the scrapbook entry created in Task 7 now shows a scaled-down preview of its actual layout (same text/image positions, just smaller) instead of a blank body; (c) clicking "แก้ไข" on the scrapbook entry opens the editor pre-loaded with its elements, editable.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/diary-grid.tsx
git commit -m "feat(frontend): render scrapbook previews in cards and lock editing for legacy entries"
```

---

## Task 9: Cleanup — remove the unused Tiptap editor

**Files:**
- Delete: `frontend/src/components/Editor.tsx`
- Delete: `frontend/src/components/RichTextEditor.tsx`
- Modify: `frontend/package.json` (via `npm uninstall`)

**Interfaces:** none — purely dead-code removal, verified in Task 7/8 that nothing imports these anymore.

- [ ] **Step 1: Confirm nothing still imports Tiptap**

```bash
cd frontend && grep -rln "@tiptap\|lowlight\|from \"@/components/Editor\"\|from \"@/components/RichTextEditor\"" src --include="*.tsx" --include="*.ts"
```

Expected: no output (both files about to be deleted are excluded from this search implicitly since they'll be gone — if this still shows a hit in some other file, stop and investigate before deleting).

- [ ] **Step 2: Delete the files**

```bash
rm frontend/src/components/Editor.tsx frontend/src/components/RichTextEditor.tsx
```

- [ ] **Step 3: Uninstall the Tiptap packages**

```bash
cd frontend && npm uninstall @tiptap/react @tiptap/starter-kit @tiptap/pm @tiptap/extension-code-block-lowlight lowlight
```

- [ ] **Step 4: Rebuild and verify**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -iv "cmdk\|vaul\|input-otp\|react-resizable-panels\|use-mobile\|use-toast\|chart.tsx"
cd .. && docker compose build frontend && docker compose up -d frontend
```

Expected: typecheck shows no new errors (the grep -v filters out the pre-existing unrelated errors already documented in `CLAUDE.md`); frontend container builds and starts cleanly; re-verify in the browser that creating/editing/viewing scrapbook entries still works exactly as in Task 8.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/components/Editor.tsx frontend/src/components/RichTextEditor.tsx frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): remove unused Tiptap rich-text editor now that ScrapbookEditor replaces it"
```
