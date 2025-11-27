# Article Notification Feature

## Ziel
User kann bei bestimmten Usern "Article Notifications" aktivieren. Bei neuen Artikeln dieser User erscheint eine Notification.

## Funktionsweise
1. User aktiviert "Notify on articles" für bestimmte Profile
2. App pollt 1x pro Stunde nach neuen Artikeln (kind 30023) dieser User
3. Bei neuem Artikel → Notification unter "Notifications" anzeigen
4. Notification: "Username posted a new Article" → Link zum Artikel
5. In Follow-Liste: "(Article Notification)" Label neben subscribed Usern

## Neue Dateien

### Service
- `src/services/ArticleNotificationService.ts`
  - localStorage: Liste der subscribed pubkeys
  - localStorage: Timestamp des letzten Checks pro User
  - `isSubscribed(pubkey): boolean`
  - `subscribe(pubkey): void`
  - `unsubscribe(pubkey): void`
  - `getSubscribedPubkeys(): string[]`
  - `checkForNewArticles(): Promise<NewArticle[]>`
  - Polling-Logik (1x pro Stunde)

## Änderungen an bestehenden Dateien

### NoteMenu.ts
- Neue Option nach Mute-Optionen: "Notify on articles" (toggle)
- Icon: Bell oder ähnlich
- Zeigt aktuellen Status (subscribed/not subscribed)

### ProfileView.ts / ProfileMuteManager.ts
- Checkbox rechts neben Mute-Button: "Notify on articles"
- Checkbox-Status aus ArticleNotificationService

### NotificationsOrchestrator.ts oder NotificationsView.ts
- Integration der Article-Notifications
- Format: "Username posted a new Article"
- Link zu `/article/{naddr}`

### FollowListSecondaryManager.ts
- Label "(Article Notification)" in Kleinschrift rechts neben Username
- Nur bei subscribed Usern anzeigen

## Implementation Order
1. ✅ ArticleNotificationService (Storage + API)
2. ✅ Polling-Logik + Integration mit Notifications
3. ✅ NoteMenu Option
4. ✅ ProfileView Checkbox
5. ✅ Follow-Liste Label
6. ✅ Test + Build

## Status: COMPLETE
All features implemented. Ready for testing.
