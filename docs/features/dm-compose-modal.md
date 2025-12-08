# DM Compose Modal

**Status:** DONE
**Implementiert:** 2025-12-08

## Beschreibung

Modal zum Erstellen neuer DM-Konversationen aus der MessagesView.

## Implementierung

### Neue Dateien

- `src/components/user-search/UserSearchInput.ts` - Wiederverwendbare User-Suche mit Dropdown
- `src/components/modals/DMComposeModal.ts` - Das Compose-Modal

### Geänderte Dateien

- `src/components/views/MessagesView.ts` - `openComposeModal()` implementiert
- `src/styles/components/_dm-views.scss` - Styles für Modal und UserSearchInput

## Features

- [x] Modal zum Erstellen einer neuen DM
- [x] Empfänger-Suche mit Autovervollständigung (Username, NIP-05)
- [x] npub-Paste erkennt und zeigt als Mention-Chip an
- [x] Nachricht eingeben (Textarea)
- [x] NIP-44 Verschlüsselung via DMService
- [x] Event publishen (Kind 14 Gift Wrap)

## Architektur

### UserSearchInput (wiederverwendbar)

- Nutzt `UserSearchService` (local follows + remote NIP-50)
- Dropdown mit SearchSpotlight CSS-Klassen
- npub-Paste → Profile fetchen → Mention-Chip (`UserMentionHelper`)
- Keyboard navigation (ArrowUp/Down, Enter, Escape)
- Callbacks: `onUserSelected()`, `onSelectionCleared()`

### DMComposeModal

- Nutzt `ModalService` für Modal-Infrastruktur
- `UserSearchInput` für Empfänger-Auswahl
- `DMService.sendMessage()` zum Senden
- Nach Senden: Modal schließt, Toast "Message sent"

## Referenzen

- `DMService.ts` - NIP-17/NIP-44 Verschlüsselung
- `UserSearchService.ts` - Hybrid User-Suche
- `UserMentionHelper.ts` - Mention-Chip Rendering
- `ModalService.ts` - Modal-Infrastruktur
