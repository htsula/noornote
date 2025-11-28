# Performance Optimizations

Analyse vom 2025-11-29: Potenzielle Performance-Flaschenhälse im Code.

**Kontext:** Nach dem Fix von NostrTransport (shared connect promise) wurde die gesamte Codebase auf ähnliche Probleme untersucht.

---

## Kritisch (High Impact)

### 1. ProfileView - Parallele Fetches bei Navigation
**Datei:** `src/components/views/ProfileView.ts` (Zeilen 149-150)

**Problem:** ProfileView lädt drei Dinge parallel ohne zu prüfen ob dieselben Operationen bereits laufen:
```typescript
const [profile, following, followEvents] = await Promise.all([
  this.userProfileService.getUserProfile(this.pubkey),
  this.userService.getUserFollowing(this.pubkey),
  // ...
]);
```
Wenn User schnell zweimal zum selben Profil navigiert, oder mehrere Profile-Cards denselben User zeigen, werden alle Operationen doppelt ausgeführt.

**Lösung:** Request-Deduplizierung per `pubkey+viewType` Key, oder ViewLifecycleManager-aware Cache für in-flight Profile-Loads.

---

### 2. ReactionsOrchestrator - ISL Stats Überlastung
**Datei:** `src/services/orchestration/ReactionsOrchestrator.ts` (Zeilen 50-51, 104-127)

**Problem:** Der Orchestrator hat zwar `fetchingDetailedStats` Deduplizierung, aber holt alle 5 Interaktionstypen (reactions, reposts, replies, zaps, quotes) parallel mit Promise.all(). Bei vielen Timeline-Notes gleichzeitig kann das den Relay-Pool überlasten.

**Lösung:** Request-Queue mit max. 5-10 gleichzeitigen ISL-Stat-Fetches, oder Batching nach 100ms Zeitfenstern.

---

### 3. UserProfileService - Promise nach Fehler gelöscht
**Datei:** `src/services/UserProfileService.ts` (Zeilen 79-102)

**Problem:** Die `fetchingProfiles` Map teilt Promises, aber bei Timeout/Fehler wird das Promise sofort gelöscht (Zeile 101). Schnelle Re-Requests starten dann einen neuen Fetch statt zu warten.

```typescript
} finally {
  this.fetchingProfiles.delete(pubkey); // Erlaubt sofortigen Duplikat-Fetch
}
```

**Lösung:** Promise auch nach Fehler im Map behalten, exponential backoff implementieren, oder "lastAttempt" Timestamp für Deduplizierung innerhalb 1-2 Sekunden.

---

## Mittel (Medium Impact)

### 4. ArticleNotificationService - startPolling() Race Condition
**Datei:** `src/services/ArticleNotificationService.ts` (Zeilen 118-128)

**Problem:** Die `startPolling()` Methode prüft `if (this.pollInterval)`, aber bei schnellen parallelen Aufrufen können mehrere Intervals erstellt werden bevor der Check greift.

**Lösung:** Boolean Flag `isPollingScheduled` setzen BEVOR die async Operation startet.

---

### 5. RelayHealthMonitor - Constructor async ohne shared Promise
**Datei:** `src/services/RelayHealthMonitor.ts` (Zeilen 32, 214-217)

**Problem:** Service startet periodisches Health-Checking im Constructor ohne shared Promise Mechanismus. Mehrfache `getInstance()` Aufrufe könnten Setup-Duplikate erzeugen.

**Lösung:** Shared Promise für initialen Health-Check, wie bei NostrTransport.ensureConnected().

---

### 6. ThreadOrchestrator - Cache-TTL Thundering Herd
**Datei:** `src/services/orchestration/ThreadOrchestrator.ts` (Zeilen 49-53, 83-104)

**Problem:** Parent-Chain Fetch nutzt Deduplizierung (`fetchingParentChain` Map), aber Cache hat 5-Minuten TTL. Bei Zugriff auf denselben Note von verschiedenen Views nach Cache-Ablauf werden mehrere Fetches gestartet.

**Lösung:** Deduplizierung über Cache-Ablauf hinaus erweitern mit "retry-after" Delay (1-2 Sekunden).

---

## Niedrig (Low Impact)

### 7. RelayConfig - Mehrfache NIP-65 Fetches
**Datei:** `src/services/RelayConfig.ts` (Zeilen 278-336)

**Problem:** Login-Listener ruft `fetchAndLoadRelayList()` bei jedem `user:login` Event. Bei mehreren Login-Events (z.B. verschiedene Auth-Methoden) werden doppelte Relay-Fetches ausgeführt.

**Lösung:** `lastFetchedPubkey` Tracker um doppeltes Fetchen innerhalb 5 Sekunden zu verhindern.

---

### 8. KeySignerConnectionManager - Doppeltes Daemon-Polling
**Datei:** `src/services/managers/KeySignerConnectionManager.ts` (Zeilen 61-95)

**Problem:** `tryAutoLogin()` und `authenticate()` rufen beide `startDaemonPolling()` auf. Bei gleichzeitigem Aufruf startet Polling zweimal.

**Lösung:** `isPollingActive` Boolean Guard in `startDaemonPolling()`.

---

### 9. Nip46SignerManager - Keine RPC-Subscribe Deduplizierung
**Datei:** `src/services/managers/Nip46SignerManager.ts` (Zeilen 80-84)

**Problem:** `authenticate()` subscribed zu RPC Messages ohne Idempotenz-Check. Schnelle Aufrufe mit derselben Bunker-URI könnten mehrere Subscriptions erstellen.

**Lösung:** Prüfen ob bereits subscribed bevor subscribe() aufgerufen wird.

---

## Zusammenfassung

| Datei | Problem | Schwere | Aufwand |
|-------|---------|---------|---------|
| ProfileView.ts | Keine Dedup bei Multi-Navigation | Hoch | Mittel |
| ReactionsOrchestrator.ts | Keine ISL Request-Queue | Hoch | Mittel |
| UserProfileService.ts | Promise bei Fehler gelöscht | Hoch | Niedrig |
| ArticleNotificationService.ts | Polling Race Condition | Mittel | Niedrig |
| RelayHealthMonitor.ts | Constructor async ohne shared Promise | Mittel | Niedrig |
| ThreadOrchestrator.ts | Cache-TTL Thundering Herd | Mittel | Niedrig |
| RelayConfig.ts | Mehrfache NIP-65 Fetches | Niedrig | Niedrig |
| KeySignerConnectionManager.ts | Doppeltes Polling | Niedrig | Niedrig |
| Nip46SignerManager.ts | Keine Subscribe Dedup | Niedrig | Niedrig |

---

## Bereits behoben

- [x] **NostrTransport** - Shared Connect Promise (commit aed90c1)
- [x] **NWCService** - Pre-connect zu NWC Relay vor Publish (commit aed90c1)
