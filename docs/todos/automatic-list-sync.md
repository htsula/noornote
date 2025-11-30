# Automatische Listen-Synchronisation

## Übersicht

Derzeit verwaltet der User die 3 Speicherstellen (Festplatte, localStorage, Relays) manuell über Action Buttons:
- "Sync from Relays"
- "Sync to Relays"
- "Save to File"
- "Restore from File"

**Ziel:** Ein Switch in den List-Settings, der diese Synchronisation automatisiert für User, die das nicht selbst managen wollen.

## Herausforderung

Die automatische Synchronisation muss **bullet-proof** sein:
- Keine Liste darf verloren gehen
- Kein versehentliches Überschreiben
- Konflikte müssen sicher aufgelöst werden
- Offline-Fähigkeit muss erhalten bleiben

## Offene Fragen

1. **Sync-Richtung:** Welche Quelle ist "Master"?
   - Option A: Relays sind Master (wie bei anderen Nostr-Clients)
   - Option B: Lokale Datei ist Master (Offline-First)
   - Option C: Merge-Strategie mit Konflikt-UI

2. **Sync-Timing:** Wann synchronisieren?
   - Bei App-Start?
   - Bei Änderungen (sofort oder debounced)?
   - Periodisch im Hintergrund?
   - Bei App-Schließen?

3. **Konflikt-Handling:** Was passiert bei Unterschieden?
   - Lokal hat Item X, Relay nicht → Publishen oder löschen?
   - Relay hat Item Y, lokal nicht → Übernehmen oder ignorieren?
   - Timestamps vergleichen? Event-IDs?

4. **Rollback:** Was wenn etwas schief geht?
   - Backup vor Sync?
   - Undo-Funktion?

## Erster Schritt: RestoreListsService ✓

Als Grundlage existiert bereits `src/services/RestoreListsService.ts`:
- Cascading Restore: Browser → Lokale Datei → Relays
- Generische Methode für alle Listen (Follows, Bookmarks, Mutes)
- Wird aufgerufen wenn Browser-Storage leer ist

Dies ist der **Read-Pfad** der automatischen Sync. Fehlt noch:
- **Write-Pfad:** Automatisches Speichern bei Änderungen
- **Conflict Resolution:** Intelligentes Mergen
- **Settings UI:** Switch zum Aktivieren/Deaktivieren

## Mögliche Architektur

```
┌─────────────────────────────────────────────────────┐
│                  AutoSyncService                     │
├─────────────────────────────────────────────────────┤
│  - enabled: boolean (aus Settings)                  │
│  - syncOnStartup()                                  │
│  - syncOnChange(listType, action)                   │
│  - syncOnClose()                                    │
│  - resolveConflict(local, remote) → merged          │
├─────────────────────────────────────────────────────┤
│  Uses: RestoreListsService (read)                   │
│        ListSyncManager (write)                      │
│        ConflictResolver (merge)                     │
└─────────────────────────────────────────────────────┘
```

## Settings UI

```
List Synchronisation
────────────────────
○ Manual (default)
  Sync-Buttons in jeder Liste verwenden

● Automatic
  Listen werden automatisch synchronisiert:
  - Bei App-Start: Von Relays laden
  - Bei Änderungen: Zu Relays publishen
  - Lokale Backup-Datei wird automatisch aktualisiert
```

## Risiken

- **Datenverlust:** Wenn Auto-Sync falsch implementiert → User verliert Follows/Bookmarks
- **Race Conditions:** Gleichzeitige Änderungen auf verschiedenen Geräten
- **Relay-Probleme:** Was wenn Relay nicht erreichbar?
- **Performance:** Zu häufiges Syncing belastet Relays und Netzwerk

## Priorität

**Niedrig** - Manuelle Sync funktioniert. Auto-Sync ist Komfort-Feature.

## Nächste Schritte

1. [ ] Entscheidung: Welche Sync-Strategie? (Master, Timing, Konflikte)
2. [ ] ConflictResolver Konzept ausarbeiten
3. [ ] Settings UI designen
4. [ ] AutoSyncService implementieren
5. [ ] Ausgiebig testen mit Edge Cases
