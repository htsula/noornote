# Long-form Post Editor (NIP-23)

## Recherche-Ergebnisse

### NIP-23 Specification
- **Kind 30023**: Addressable event für published articles
- **Kind 30024**: Drafts (same structure)
- **Content**: Markdown (MUST NOT hard line-break, MUST NOT support HTML in Markdown)

**Required Tags:**
- `d`: Unique identifier (slug)

**Optional Tags:**
- `title`: Article headline
- `image`: Banner/cover image URL
- `summary`: Brief description
- `published_at`: Unix timestamp (first publication)
- `t`: Hashtags/topics (multiple allowed)

**Referenzen:**
- Replies nutzen NIP-22 kind 1111 (nicht kind 1!)
- Cross-references via NIP-27 (`nostr:...` links)

### Habla.news Editor Reference (`../habla/`)
**Key Files:**
- `src/markdown/Editor.js` - Main editor component
- `src/pages/write.tsx` - Page wrapper
- `src/nip23.ts` - Metadata extraction

**Form Fields:**
- Title (input)
- Content (textarea mit Markdown)
- Image URL (input)
- Summary (textarea)
- Tags (comma-separated input)
- Identifier/Slug (input)
- Published At (date picker - optional)

---

## Existing Noornote Infrastructure

### Wiederzuverwendende Komponenten:

| Komponente | Pfad | Wiederverwendung |
|------------|------|------------------|
| `PostEditorToolbar` | `src/components/post/PostEditorToolbar.ts` | Media upload, Emoji picker (showPoll: false) |
| `RelaySelector` | `src/components/post/RelaySelector.ts` | Relay-Auswahl |
| `MentionAutocomplete` | `src/components/mentions/MentionAutocomplete.ts` | @mentions im Content |
| `View` | `src/components/views/View.ts` | Base class für ArticleEditorView |
| `marked` | package.json | Markdown rendering für Preview |
| `AuthGuard` | `src/services/AuthGuard.ts` | Write protection |
| `renderPostPreview` | `src/helpers/renderPostPreview.ts` | Content preview (evtl. anpassen) |

### Bestehende Article-Infrastruktur:
- `LongFormOrchestrator.ts` - Fetch kind 30023 via naddr
- `ArticleView.ts` - Display articles mit Markdown rendering
- `ArticleMetadata` interface

---

## Implementierungsplan

### Phase 1: Service Layer

#### 1.1 ArticleService erstellen
`src/services/ArticleService.ts`

```typescript
interface ArticleOptions {
  title: string;
  content: string;          // Markdown
  identifier: string;       // d-tag (slug)
  summary?: string;
  image?: string;
  topics?: string[];        // t-tags
  publishedAt?: number;     // Unix timestamp
  relays: string[];
  isDraft?: boolean;        // kind 30024 vs 30023
}

class ArticleService {
  async publishArticle(options: ArticleOptions): Promise<boolean>
  async saveDraft(options: ArticleOptions): Promise<boolean>
  private buildArticleEvent(options: ArticleOptions): UnsignedEvent
}
```

**Event Structure:**
```typescript
{
  kind: isDraft ? 30024 : 30023,
  created_at: now,
  content: markdownContent,
  tags: [
    ['d', identifier],
    ['title', title],
    ['summary', summary],      // optional
    ['image', imageUrl],        // optional
    ['published_at', String(publishedAt || now)],
    ['t', topic1],              // optional, multiple
    ['t', topic2],
  ]
}
```

#### 1.2 ArticleDraftStorage (optional für MVP)
`src/services/storage/ArticleDraftStorage.ts`
- localStorage für lokale Drafts
- Auto-save bei Content-Änderungen

### Phase 2: View Component

#### 2.1 ArticleEditorView
`src/components/views/ArticleEditorView.ts`

**Full-Page Layout (in primary-content):**
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Timeline              Write Article                   │
├─────────────────────────────────────────────────────────────────┤
│ [Edit] [Preview]                              [Relay Selector ▼]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Title                                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [Article title...]                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Content (Markdown)                                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │  Large textarea (~500px height, resizable)                  │ │
│ │                                                             │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ▼ Details (collapsible, initially open)                         │
│   ┌───────────────────────────────────────────────────────────┐ │
│   │ Cover Image URL  [________________________________] [📷]  │ │
│   │ Summary          [________________________________]       │ │
│   │ Tags             [________________________________]       │ │
│   │ Slug/Identifier  [________________________________]       │ │
│   └───────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ [📷 Media] [😀 Emoji]              [Save Draft]  [Publish]      │
└─────────────────────────────────────────────────────────────────┘
```

**Preview Mode:**
- Rendert kompletten Artikel mit `marked`
- Zeigt Title, Image (wenn vorhanden), Summary, Content
- Ähnliches Styling wie ArticleView

**Komponenten-Reuse:**
- `PostEditorToolbar` mit `showPoll: false`
- `RelaySelector` (aus post/)
- `MentionAutocomplete` für @mentions
- `marked` für Markdown Preview

### Phase 3: Routing & Entry Point

#### 3.1 Route registrieren
In `App.ts`:
```typescript
case 'write-article': {
  const { ArticleEditorView } = await import('./components/views/ArticleEditorView');
  const articleEditor = new ArticleEditorView();
  primaryContent.appendChild(articleEditor.getElement());
  break;
}
```

#### 3.2 Entry Point: "New Post" Button → Dropdown
In `MainLayout.ts`:
- "New Post" Button wird zu Dropdown mit 2 Optionen:
  - "Note" → PostNoteModal (wie bisher)
  - "Article" → Router.navigate('/write-article')

**Alternative:** Separater "Write Article" Link in Sidebar unter "New Post"

### Phase 4: Integration

#### 4.1 LongFormOrchestrator erweitern
- `fetchUserDrafts(pubkey)` - Lädt kind 30024 events
- `fetchUserArticles(pubkey)` - Lädt kind 30023 events

#### 4.2 Edit existing article
- ArticleEditorView akzeptiert optionalen `naddrRef` Parameter
- Lädt existierenden Artikel und füllt Form

---

## File Structure (neu)

```
src/
├── components/
│   └── views/
│       └── ArticleEditorView.ts     # Full-page editor view
├── services/
│   └── ArticleService.ts            # Publish kind 30023/30024
```

**Optional (Phase 2+):**
```
├── services/
│   └── storage/
│       └── ArticleDraftStorage.ts   # Local draft persistence
```

---

## Implementation Order

1. **ArticleService** - Core publishing logic
2. **ArticleEditorView** - Full-page editor UI
3. **App.ts route** - Add 'write-article' case
4. **MainLayout Entry Point** - Add button/link to navigate
5. **Testing & Polish**

---

## Sources

- [NIP-23 Spec](https://github.com/nostr-protocol/nips/blob/master/23.md)
- [Habla.news GitHub](https://github.com/verbiricha/habla.news)
- Local: `../habla/src/markdown/Editor.js`
