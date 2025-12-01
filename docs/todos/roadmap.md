# NoorNote Roadmap

Priorisierte Reihenfolge aller Todos.

---

## 1. Multi-User Integration ✅ ABGESCHLOSSEN

**Datei:** `noorsigner-multi-account.md` (Phase 4)

**Erledigt:**
- ✅ `switchAccount()` in KeySignerClient
- ✅ `listAccounts()` in KeySignerClient
- ✅ `addAccount()` in KeySignerClient
- ✅ `removeAccount()` in KeySignerClient
- ✅ `getActiveAccount()` in KeySignerClient
- ✅ Passwort-Modal für Account-Switch (KeySignerPasswordModal)
- ✅ Per-user file storage (`~/.noornote/{npub}/`)
- ✅ Cache-Clearing bei user:login Events
- ✅ AccountSwitcher Component (komplett implementiert)
- ✅ AccountStorageService (komplett implementiert)
- ✅ NoorSigner Daemon: alle IPC-Methoden vorhanden
- ✅ "+ Add Account" Flow mit Terminal-Anleitung Modal
- ✅ AuthComponent + AccountSwitcher aufgeräumt (nur NoorSigner + Bunker)

**Getestet:** add-account, remove-account, switch-account

---

## 2. Mutual Check Feature

**Dateien:** `mutual-check-*.md` (6 Dateien)

**Status:** Phase 1-4 implementiert - UNTER BEOBACHTUNG (Langzeit-Test)

**Phasen:**
1. ✅ Static Mutuals List - Mutual/Not following back Tags, Zähler, Filter
2. ✅ Unfollow Detection - Wer hat mich entfolgt?
3. ✅ New Mutual Detection - Wer folgt mir neu?
4. ✅ Background Scheduler + Notifications - Automatische Benachrichtigungen

**Implementierte Architektur:**
- Storage: `~/.noornote/{npub}/mutual-check-data.json` + localStorage
- Scheduler: Verzögerter Start (3 Min nach App-Start)
- Notifications: Integration in NV (mutual_unfollow, mutual_new)
- Check-Intervall: Alle 4 Stunden
- UI: "Check for Changes" Link, Modal, Green Dot in Sidebar

**Neue Dateien:**
- `src/services/storage/MutualChangeStorage.ts`
- `src/services/MutualChangeDetector.ts`
- `src/services/MutualChangeScheduler.ts`

**Debug-Commands (DevTools):**
- `__MUTUAL_CHANGE_STORAGE__.logState()` - Zeigt aktuellen State
- `__MUTUAL_CHANGE_SCHEDULER__.forceCheck()` - Manueller Check
- `__MUTUAL_CHANGE_SCHEDULER__.getStatus()` - Scheduler Status

**Value:** Hoher User-Value, Langzeit-Test erforderlich

---

## 3. Logged-Out Features

**Datei:** `logged-out-features.md`

**Status:** Geplant

**Scope:**
- Onboarding UI für neue User
- Curated Timeline (Preview ohne Login)
- Settings-Einschränkungen für Logged-Out
- User-Suche auf Profile-View

**Aufwand:** ~8-12h

---

## 4. NIP-51 Kategorisierte Bookmarks (Optional)

**Datei:** `nip51-categorized-bookmarks.md`

**Status:** Geplant, niedrige Priorität

**Scope:**
- Folder-Sync zu Relays (kind:30001)
- Hybrid: kind:10003 (root) + kind:30001 (folders)

**Aufwand:** ~6-10h

**Note:** Folders funktionieren lokal. Relay-Sync ist "nice to have".

---

## 5. Automatic List Sync (Optional)

**Datei:** `automatic-list-sync.md`

**Status:** Geplant, niedrige Priorität

**Scope:**
- Auto-Sync Switch in Settings
- Sync bei App-Start / bei Änderungen
- Conflict Resolution

**Aufwand:** ~8-12h

**Note:** Manuelle Sync funktioniert. Auto-Sync ist Komfort-Feature.

---

## 6. NIP-17 Private DMs

**Datei:** `nip17-private-dms.md`

**Status:** Geplant

**Scope:**
- NIP-44 Encryption
- Gift Wrap / Seal / Rumor (3-Layer)
- DM Inbox View
- Conversation Threading

**Aufwand:** ~15-20h

**Note:** Unabhängiges Feature, kann standalone entwickelt werden.

---

## 7. NoorSigner Cross-Platform (LETZTES)

**Dateien:** `tauri-only-strategy.md`, `x-platform/*.md`

**Status:** Geplant

**Scope:**
- NoorSigner: keyring-rs Migration (statt security-framework)
- Windows: Named Pipe IPC + Credential Manager
- Linux: Secret Service API

**Testing:**
- Windows Laptop
- Ubuntu VM (UTM)

**Aufwand:** ~12-18h (viel Testing)

**Note:** Aufwendig wegen Cross-Platform-Testing. Daher ganz am Ende.

---

## Kleinere Tasks (aus todos.md)

### Legal/Support Static Page
- Impressum, Datenschutz (DSGVO)
- Route: `/legal` oder `/about`
- Privacy-first, opt-in contact form
- **Aufwand:** ~2h

### Zap Display Inconsistency
- Zaps werden inkonsistent in Notifications dargestellt
- 4 verschiedene Zustände, Problem: Zap-Receipts (Kind 9735) kommen nicht immer
- **Ziel:** Optimistische UI nach erfolgreichem Payment
- **Aufwand:** ~2-4h Investigation + Fix

### Plugin System (Zukunft)
- On-boarding, Bookmarks, Freelancer MP, Seller MP, Discovery
- Sehr vage, niedrige Priorität
- **Aufwand:** TBD

---

## Unter Beobachtung

- **KeySigner IPC Connection Lost**: Fix implementiert (Retry-Logik, Grace Period, Adaptive Polling). Monitoring in Production.

---

## Release-Notizen (für später)

**NoorSigner Installation:**
- NoorSigner nach `/usr/local/bin/noorsigner` installieren (nicht gebündelt in App)
- `key_signer.rs`: Production-Pfad ist bereits `/usr/local/bin/noorsigner`
- `tauri.conf.json`: resources array leeren wenn nicht mehr gebündelt

---

## Zusammenfassung

| # | Feature | Aufwand | Status |
|---|---------|---------|--------|
| 1 | Multi-User Integration | - | ✅ Abgeschlossen |
| 2 | Mutual Check (Phase 2-4) | - | 🔍 Unter Beobachtung (Langzeit-Test) |
| 3 | Logged-Out Features | 8-12h | ⬜ Offen |
| 4 | Legal Page | 2h | ⬜ Offen |
| 5 | Zap Display Fix | 2-4h | ⬜ Offen |
| 6 | NIP-51 Bookmarks | 6-10h | ⬜ Optional |
| 7 | Auto List Sync | 8-12h | ⬜ Optional |
| 8 | NIP-17 Private DMs | 15-20h | ⬜ Offen |
| 9 | Cross-Platform | 12-18h | ⬜ Letztes |

**Gesamt verbleibend:** ~62-89h (ohne optionale Features: ~47-64h)

---

## Weitere Dateien

- `x-platform/*.md` - Platform-Strategie Details
- `mutual-check-*.md` - Mutual Check Feature Details (6 Dateien)
- `noorsigner-multi-account.md` - Multi-Account API Details
- `tauri-only-strategy.md` - Cross-Platform Details
