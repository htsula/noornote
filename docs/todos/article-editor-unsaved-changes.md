# Article Editor: Unsaved Changes Confirmation

**Status:** TODO
**Datei:** `src/components/views/ArticleEditorView.ts:668`

## Beschreibung

Der Article Editor warnt nicht vor ungespeicherten Änderungen beim Verlassen der Seite.

## Aktueller Stand

```typescript
// TODO: Confirm if unsaved changes
```

Die `cleanup()` Methode wird aufgerufen, aber ohne Check ob Änderungen vorhanden sind.

## Anforderungen

- [ ] Dirty-State tracken (Änderungen seit letztem Save)
- [ ] Bei Navigation weg vom Editor: Confirmation Modal zeigen
- [ ] "Discard Changes" / "Save Draft" / "Cancel" Optionen
- [ ] Browser `beforeunload` Event für Tab-Schließen

## UX

- Modal nur zeigen wenn tatsächlich Änderungen vorhanden
- Draft auto-save könnte dieses Problem auch lösen (localStorage)

## Referenz

- `ModalService.confirm()` für Confirmation Dialog
- Ähnliche Pattern in anderen Apps: "You have unsaved changes. Are you sure you want to leave?"
