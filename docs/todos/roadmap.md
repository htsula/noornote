# NoorNote Roadmap

Priorisierte Reihenfolge aller Todos.

---

## PRE-RELEASE FEATURES

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
- `src/services/MutualChangeService.ts` (Self-initializing entry point)
- `src/services/MutualChangeDetector.ts`
- `src/services/MutualChangeScheduler.ts`
- `src/services/storage/MutualChangeStorage.ts`

**Debug-Commands (DevTools):**
- `__MUTUAL_CHANGE_STORAGE__.logState()` - Zeigt aktuellen State
- `__MUTUAL_CHANGE_SCHEDULER__.forceCheck()` - Manueller Check
- `__MUTUAL_CHANGE_SCHEDULER__.getStatus()` - Scheduler Status

**Value:** Hoher User-Value, Langzeit-Test erforderlich

---

## 3. NIP-51 Kategorisierte Bookmarks (Optional)

**Datei:** `nip51-categorized-bookmarks.md`

**Status:** Geplant, niedrige Priorität

**Scope:**
- Folder-Sync zu Relays (kind:30001)
- Hybrid: kind:10003 (root) + kind:30001 (folders)

**Aufwand:** ~6-10h

**Note:** Folders funktionieren lokal. Relay-Sync ist "nice to have".

---

## 4. Automatic List Sync (Optional)

**Datei:** `automatic-list-sync.md`

**Status:** Geplant, niedrige Priorität

**Scope:**
- Auto-Sync Switch in Settings
- Sync bei App-Start / bei Änderungen
- Conflict Resolution

**Aufwand:** ~8-12h

**Note:** Manuelle Sync funktioniert. Auto-Sync ist Komfort-Feature.

---

## 5. NIP-17 Private DMs

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

## 6. NoorSigner Cross-Platform (LETZTES PRE-RELEASE)

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

**Note:** Aufwendig wegen Cross-Platform-Testing. Daher ganz am Ende vor Release.

---

## Kleinere Tasks (Pre-Release)

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

---

## Unter Beobachtung

- **KeySigner IPC Connection Lost**: Fix implementiert (Retry-Logik, Grace Period, Adaptive Polling). Monitoring in Production.
- **Mutual Check Feature**: Snapshot-Persistenz Bug gefixt (2025-12-03). Langzeit-Test.

---

## Release-Notizen (für später)

**NoorSigner Installation:**
- NoorSigner nach `/usr/local/bin/noorsigner` installieren (nicht gebündelt in App)
- `key_signer.rs`: Production-Pfad ist bereits `/usr/local/bin/noorsigner`
- `tauri.conf.json`: resources array leeren wenn nicht mehr gebündelt

---

---

## POST-RELEASE: PLUGIN SYSTEM

Nach dem ersten Release wird ein Plugin-System eingeführt. Optionale Funktionalität wird als Plugins umgesetzt, die Nutzer aktivieren/deaktivieren können.

---

## Plugin System Architecture

**Status:** Post-Release geplant

**Konzept:**
- Plugins als optionale Erweiterungen
- Aktivierung/Deaktivierung über Settings
- Isolierte Codebasis pro Plugin
- Gemeinsame Plugin-API für:
  - Views registrieren
  - Sidebar-Einträge hinzufügen
  - Settings-Sektionen erweitern
  - EventBus-Integration

**Aufwand:** ~20-30h (Architektur + erste Plugins)

---

## Onboarding Plugin (ehem. "Logged-Out Features")

**Datei:** `logged-out-features.md`

**Status:** Post-Release, als Plugin

**Scope:**
- Onboarding UI für neue User
- Curated "Starter Feed" Timeline (Preview ohne Login)
- Geführte Einrichtung (Follows, Relays, Profil)
- Settings-Einschränkungen für Logged-Out

**Warum Plugin:**
- Optionales Feature (nicht jeder braucht Onboarding)
- Komplexe UI-Flows die nicht im Core sein müssen
- Gutes erstes Plugin um das System zu validieren

**Aufwand:** ~8-12h (nach Plugin-System)

---

## Weitere Plugin-Ideen (Zukunft)

- **Discovery Plugin**: Erweiterte User/Content-Suche
- **Analytics Plugin**: Detaillierte Statistiken
- **Bookmarks Pro Plugin**: Erweiterte Kategorisierung
- **Freelancer Marketplace**: (sehr vage)
- **Seller Marketplace**: (sehr vage)

---

---

## Zusammenfassung Pre-Release

| # | Feature | Aufwand | Status |
|---|---------|---------|--------|
| 1 | Multi-User Integration | - | ✅ Abgeschlossen |
| 2 | Mutual Check (Phase 2-4) | - | 🔍 Unter Beobachtung |
| 3 | NIP-51 Bookmarks | 6-10h | ⬜ Optional |
| 4 | Auto List Sync | 8-12h | ⬜ Optional |
| 5 | NIP-17 Private DMs | 15-20h | ⬜ Offen |
| 6 | Cross-Platform | 12-18h | ⬜ Letztes |
| - | Legal Page | 2h | ⬜ Offen |
| - | Zap Display Fix | 2-4h | ⬜ Offen |

**Pre-Release verbleibend:** ~37-64h (ohne optionale Features: ~31-44h)

## Zusammenfassung Post-Release

| Feature | Aufwand | Status |
|---------|---------|--------|
| Plugin System Architecture | 20-30h | ⬜ Nach Release |
| Onboarding Plugin | 8-12h | ⬜ Nach Release |

---

## Weitere Dateien

- `x-platform/*.md` - Platform-Strategie Details
- `mutual-check-*.md` - Mutual Check Feature Details (6 Dateien)
- `noorsigner-multi-account.md` - Multi-Account API Details
- `tauri-only-strategy.md` - Cross-Platform Details
- `logged-out-features.md` - Onboarding Plugin Details
