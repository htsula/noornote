# Mount Bookmark Folder to Profile (NIP-78)

## Status: TODO

## Übersicht

**Feature:** NIP-51 Bookmark-Folder (Kategorien) können unter dem eigenen Profil angehängt ("gemounted") werden. Die Items des Folders werden dann für andere NoorNote-User auf der Profilseite sichtbar.

**Einzigartigkeit:** Erstes Feature dieser Art in der Nostr-Welt. Reines Client-Feature - nur NoorNote-User profitieren davon.

---

## Use Case

> Ich bin Freelancer und möchte mein Portfolio auf meiner Profilseite darstellen.
> Ich erstelle eine "Portfolio"-Liste, packe ein paar Items da rein (URLs mit Descriptions) und hänge sie unter mein Profil an.
> Ab da ist es für jeden NoorNote-User sichtbar.

**Weitere Anwendungen:**
- Künstler zeigt "Meine Werke"
- Entwickler zeigt "Meine Projekte"
- Autor zeigt "Meine Bücher"
- Kurator zeigt "Empfohlene Reads"

---

## Technische Lösung: NIP-78 (kind:30078)

### Warum NIP-78?

NIP-78 definiert kind:30078 für "Application-specific data". Perfekt für Client-Features:

- **Andere Clients ignorieren es** - fetchen kind:30078 mit `d: "noornote/*"` gar nicht erst
- **Saubere Trennung** - Polluted keine NIP-51 Events
- **Erweiterbar** - Reihenfolge, Display-Optionen, etc.
- **Standard Nostr Pattern** - Nutzt existierendes NIP

### Event-Struktur

```json
{
  "kind": 30078,
  "pubkey": "<user-pubkey>",
  "created_at": 1234567890,
  "tags": [
    ["d", "noornote/profile-mounts"]
  ],
  "content": "{\"mounts\":[\"Portfolio\",\"Projects\"],\"version\":1}",
  "id": "...",
  "sig": "..."
}
```

### Content-Schema

```typescript
interface ProfileMountsContent {
  version: 1;
  mounts: string[];  // Array von Folder-Namen (= d-tags der kind:30003 Sets)
}
```

**Beispiel:**
```json
{
  "version": 1,
  "mounts": ["Portfolio", "Projects"]
}
```

**Hinweise:**
- `mounts` Array definiert auch die Reihenfolge der Anzeige
- Folder-Namen entsprechen den `d`-Tags der kind:30003 Bookmark Sets
- Leeres Array = keine Folder gemounted

---

## Datenfluss

### Eigenes Profil (Schreiben)

```
User klickt "Mount to Profile" Checkbox
    ↓
localStorage aktualisieren (noornote_profile_mounts)
    ↓
kind:30078 Event publishen (bei "Sync to Relays")
```

### Fremdes Profil (Lesen)

```
ProfileView lädt Profil von User X
    ↓
Fetch kind:30078 {d: "noornote/profile-mounts"} von User X
    ↓
Falls vorhanden: Parse content.mounts[]
    ↓
Für jeden Mount: Fetch kind:30003 {d: "<folder-name>"} von User X
    ↓
Render Items in .profile-lists Section
```

### Eigenes Profil (Lesen)

```
ProfileView lädt eigenes Profil
    ↓
Lese aus localStorage (noornote_profile_mounts)
    ↓
Für jeden Mount: Hole Items aus localStorage (bereits vorhanden)
    ↓
Render Items in .profile-lists Section
```

---

## UI-Änderungen

### 1. Bookmark Folder Card (Hover-State)

**Datei:** `src/components/layout/managers/BookmarkSecondaryManager.ts`

**Aktuell bei Hover:**
- Edit-Icon (oben rechts)
- Delete-Icon (oben rechts)

**Neu bei Hover:**
- Checkbox "Mount to Profile" (unten rechts)
- Checked = Folder ist gemounted
- Nur für eigene Bookmarks (nicht bei fremden Profilen)

**Mockup:**
```
┌─────────────────────────┐
│ [Edit] [Delete]     ←── Hover-Icons oben rechts
│                         │
│      📁                 │
│   Portfolio             │
│    3 items              │
│                         │
│    ☑ Mount to Profile ←── Neue Checkbox unten rechts
└─────────────────────────┘
```

### 2. Profile View - Neue Section

**Datei:** `src/components/views/ProfileView.ts`

**Position:** Nach `.profile-info`, vor `.profile-timeline-container`

**Struktur:**
```html
<div class="profile-header">
  <!-- Bestehend: Banner, Avatar, Info -->
  <div class="profile-info">...</div>

  <!-- NEU: Gemountete Listen -->
  <div class="profile-lists">
    <div class="profile-list-section">
      <h3 class="profile-list-title">Portfolio</h3>
      <div class="profile-list-items">
        <!-- URL Items wie in Bookmark-Detail-View -->
        <div class="profile-list-item">
          <span class="item-icon">🔗</span>
          <div class="item-content">
            <a href="..." class="item-url">example.com/project1</a>
            <span class="item-description">Mein erstes Projekt</span>
          </div>
        </div>
        <!-- Weitere Items -->
      </div>
    </div>
    <!-- Weitere gemountete Folder -->
  </div>
</div>

<div class="profile-timeline-container">...</div>
```

**Styling:**
- Kompakte Darstellung (keine großen Cards)
- Items untereinander gelistet
- Folder-Titel als Überschrift
- Konsistent mit bestehendem Profile-Design

---

## Implementierungsplan

### Phase 1: Storage-Layer

1. **ProfileMountsService erstellen**
   - `getMounts(): string[]` - Aus localStorage lesen
   - `setMounts(mounts: string[]): void` - In localStorage schreiben
   - `addMount(folderName: string): void`
   - `removeMount(folderName: string): void`
   - `isMount(folderName: string): boolean`

2. **ProfileMountsOrchestrator erstellen** (oder in BookmarkOrchestrator integrieren)
   - `publishToRelays(): Promise<void>` - kind:30078 publishen
   - `fetchFromRelays(pubkey: string): Promise<string[]>` - Mounts von User laden

### Phase 2: UI - Checkbox in Bookmark Folder

1. **BookmarkSecondaryManager.ts erweitern**
   - Checkbox im Folder-Card Hover-State
   - Click-Handler: `ProfileMountsService.addMount/removeMount`
   - Checked-State aus `ProfileMountsService.isMount`

### Phase 3: UI - Profile Lists Section

1. **ProfileView.ts erweitern**
   - `.profile-lists` Container nach `.profile-info`
   - Logik: Mounts laden → Bookmark Sets fetchen → Items rendern

2. **ProfileView.scss erstellen/erweitern**
   - Styling für `.profile-lists`, `.profile-list-section`, `.profile-list-item`

### Phase 4: Sync Integration

1. **ListSyncManager Integration**
   - "Sync to Relays" publiziert auch kind:30078
   - Oder: Separater Sync-Button für Profile Mounts

---

## Betroffene Dateien

### Neu zu erstellen
```
src/services/ProfileMountsService.ts        - localStorage Management
src/services/orchestration/ProfileMountsOrchestrator.ts - Relay Sync
```

### Zu erweitern
```
src/components/layout/managers/BookmarkSecondaryManager.ts - Checkbox
src/components/views/ProfileView.ts         - .profile-lists Section
src/styles/components/_profile.scss         - Styling (falls vorhanden)
```

### Configs
```
src/services/orchestration/configs/ProfileMountsConfig.ts - Optional
```

---

## localStorage Keys

```
noornote_profile_mounts = ["Portfolio", "Projects"]
```

Einfaches String-Array der gemounteten Folder-Namen.

---

## Edge Cases

### 1. Folder gelöscht aber noch gemounted
- Beim Rendern prüfen ob Folder existiert
- Falls nicht: Skip (nicht anzeigen)
- Optional: Beim nächsten Sync automatisch aus mounts entfernen

### 2. Fremdes Profil hat keine Mounts
- kind:30078 fetch gibt null/leer zurück
- `.profile-lists` Section nicht rendern

### 3. Bookmark Set ist private
- Private Items NICHT in Profile Lists anzeigen
- Nur public Items des Sets

### 4. Folder hat keine Items
- Folder-Section nicht anzeigen wenn leer

### 5. Relay hat kind:30078 nicht
- Graceful degradation - Section nicht anzeigen
- Kein Error

### 6. User ist nicht eingeloggt
- Checkbox "Mount to Profile" nicht anzeigen
- Profile Lists von anderen Usern trotzdem laden

---

## Referenzen

- **NIP-78:** https://github.com/nostr-protocol/nips/blob/master/78.md
- **NIP-51 Bookmarks:** `docs/features/nip51-categorized-bookmarks.md`
- **Bookmark Architektur:** `src/services/orchestration/BookmarkOrchestrator.ts`
- **GenericListOrchestrator:** `src/services/orchestration/GenericListOrchestrator.ts`

---

## Screenshots

- `screenshots/pv.png` - Profile View Übersicht
- `screenshots/pv1.png` - Profile View mit Timeline-Grenze
- `screenshots/pv-bookmark-folders.png` - Bookmark Folder Hover-State
- `screenshots/screenshot.png` - Bookmark Folder Grid
- `screenshots/screenshot1.png` - Bookmark Folder Detail (Portfolio)

---

## Entscheidungen (Offene Fragen)

1. **Sync-Strategie:** ✅ Sofort automatisch beim nächsten PV-Load anzeigen. Kein separater Button. Cache darf nicht im Wege stehen - frische Daten laden.
2. **Reihenfolge:** ✅ Ja, änderbar (nur eigenes Profil).
   - Default: Nach Zeitpunkt des Checkbox-Klicks (first click, first show)
   - Im PV: Drag-Handle (⠿ 6 Punkte, 2x3) rechts neben Folder-Titel
   - Drag & Drop zum Umsortieren, Loslassen speichert sofort
   - **NUR für eigenes Profil sichtbar** - andere User sehen keine Drag-Handles
3. **Anzahl-Limit:** ✅ Maximum 5 Folder.
   - Bei Versuch 6. zu mounten: Toast "Maximale Anzahl mounts erreicht. Deselektiere, bevor du neue anhängen willst."
4. **Styling:** ✅ 5 Items pro Folder, danach "Show more".
   - Item-Reihenfolge = Reihenfolge im Bookmark-Folder (oben bleibt oben)
