# DM Compose Modal

**Status:** TODO
**Datei:** `src/components/views/MessagesView.ts:517`

## Beschreibung

Die MessagesView hat einen "New Message" Button, aber das Compose-Modal ist noch nicht implementiert.

## Aktueller Stand

```typescript
// TODO: Implement compose modal
```

Der Button existiert, aber `openComposeModal()` ist leer.

## Anforderungen

- [ ] Modal zum Erstellen einer neuen DM
- [ ] Empfänger-Suche mit Autovervollständigung (npub, NIP-05, Username)
- [ ] Nachricht eingeben
- [ ] NIP-44 Verschlüsselung
- [ ] Event publishen (Kind 14 Gift Wrap)

## Autovervollständigung

Die Empfänger-Eingabe soll Username-Autovervollständigung haben, ähnlich der Search Function mit User Suggestions.

**Option A:** Bestehende Search-Komponente komponentisieren und wiederverwenden
**Option B:** Shared Autocomplete-Komponente extrahieren

Prüfen:
- `src/components/search/` - wie funktioniert die User-Suche dort?
- Kann die Suggestion-Logik als eigenständige Komponente extrahiert werden?
- Gleiche UX: Tippen → Suggestions dropdown → Auswahl

## Referenz

- Bestehende DM-Logik in `ConversationView.ts`
- `DMService.ts` für Verschlüsselung/Publishing
- Search-Komponente für User-Suggestions Pattern
