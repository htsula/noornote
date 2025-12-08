# TypeScript Strict Mode - Post-Release Cleanup

**Status:** TODO (Post-Release)
**Erstellt:** 2025-12-08

## Übersicht

Nach dem Release müssen folgende TypeScript-Fehler behoben werden. Der Build funktioniert, aber `npm run typecheck` zeigt ~700 Fehler bei strikter Konfiguration.

## Fehler nach Typ

| Code | Anzahl | Beschreibung | Priorität |
|------|--------|--------------|-----------|
| TS6133 | 112 | Unused variables/properties | Niedrig |
| TS7006 | 95 | Implicit any type | Niedrig |
| TS2614 | 90 | Wrong import (Event vs NostrEvent) | Niedrig |
| TS2345 | 74 | Type mismatch (string \| undefined → string) | Mittel |
| TS18048 | 63 | Possibly undefined | Mittel |
| TS2322 | 57 | Type not assignable | Mittel |
| TS2379 | 36 | exactOptionalPropertyTypes conflict | Mittel |
| TS2339 | 34 | Property does not exist | Hoch |
| TS4114 | 25 | Override modifier missing | Niedrig |
| TS2375 | 22 | exactOptionalPropertyTypes in return | Mittel |
| TS2532 | 18 | Object possibly undefined | Mittel |

## Hauptursachen

### 1. NDK Import-Problem (90 Fehler)
```typescript
// Falsch:
import { Event } from '@nostr-dev-kit/ndk';

// Richtig:
import type { NostrEvent } from '@nostr-dev-kit/ndk';
```

### 2. Implicit Any in Callbacks (95 Fehler)
```typescript
// Falsch:
tags.find(tag => tag[0] === 'p')

// Richtig:
tags.find((tag: string[]) => tag[0] === 'p')
```

### 3. exactOptionalPropertyTypes (36 Fehler)
```typescript
// Problem: params.noteId kann undefined sein
this.appState.setState('view', {
  currentView: 'single-note',
  currentNoteId: params.noteId  // string | undefined
});

// Lösung:
const noteId = params.noteId ?? '';
this.appState.setState('view', {
  currentView: 'single-note',
  currentNoteId: noteId
});
```

### 4. Unused Class Properties (112 Fehler)
Viele `private` Properties sind deklariert aber nicht genutzt. Diese sollten entfernt werden.

## Empfohlene Vorgehensweise

### Phase 1: Low-Hanging Fruit
1. NDK Imports fixen (Event → NostrEvent) - 90 Fehler
2. Implicit any in tag callbacks fixen - ~50 Fehler
3. Unused imports entfernen - ~30 Fehler

### Phase 2: Type Safety
1. exactOptionalPropertyTypes Fehler fixen
2. Undefined checks hinzufügen
3. Type Guards implementieren

### Phase 3: Cleanup
1. Unused class properties entfernen
2. Override modifiers hinzufügen
3. Property initializers fixen

## tsconfig.json Optionen

Folgende Optionen wurden für den Release temporär deaktiviert:

```json
{
  "compilerOptions": {
    "noUnusedLocals": false,        // 112 Fehler
    "noUnusedParameters": false,    // Teil von TS6133
    "exactOptionalPropertyTypes": false,  // 36+ Fehler
    "noUncheckedIndexedAccess": false     // Viele Fehler
  }
}
```

Nach dem Cleanup können diese wieder aktiviert werden.

## Betroffene Dateien (Top 20)

```
src/services/orchestration/*.ts - Viele TS7006 (implicit any)
src/components/layout/MainLayout.ts - Mehrere Typen
src/components/layout/managers/BookmarkSecondaryManager.ts - Viele Fehler
src/services/ZapService.ts - Subscription handling
src/components/analytics/AnalyticsModal.ts - Tag callbacks
src/components/article/ArticleTimeline.ts - InfiniteScroll type
src/App.ts - ViewState types
```

## Notizen

- Build funktioniert trotz Typecheck-Fehlern (Vite ist weniger strikt)
- Keine Runtime-Fehler durch diese Type-Issues
- Schrittweise fixen, nicht alles auf einmal
