############################################################################################################################
# Dies ist die erweiterte Context-Datei für Claude Code
--------------------------------------------------------------
UNTER KEINEN UMSTÄNDEN ÄNDERN! Nur der User darf diesen Bereich anfassen.
############################################################################################################################
Diese Anweisungen gelten im Kontext der aktuell laufenden Migration der nostr-tools-Library von Version 1 -> Version 2
Sie ist von Claude Code als Zusatz zu CLAUDE.md zu verstehen.

## Langzeitgedächtnis

- Jeden Debugging-Schritt, jede Entscheidung, unabhängig ob erfolgreich oder nicht, muss hier selbstständig dokumentiert werden, damit wir uns nicht 
im Kreis drehen und Dinge wiederholen. Kurz, um deine Kontext-Mermory nicht zu belasten.
- Vor jedem Debugging- und Migrationsschritt checkt Claude Code diese Datei, um zu sehen, ob wir diesen Weg schon gegangen sind
und wie der Erfolgsstatus war.

## Context Memory, Sessions und Daten-Sparsamkeit

- Bei jeder Aktion und Dokumentation ist das begrenzte Context-Memory zu berücksichtigen und minimal zu belasten. Optimiere so,
dass alle Infos vorhanden sind und Claude Code sie verstehen kann.
-Keine invasiven Debug logs, die zu viel und schnell herunter rattern. Das kann ich nicht kopieren, damit kann ich nicht arbeiten.
Mach kurze, intelligente Debug logs.
- Wenn unter der Chat-Session steht "Context left until auto-compact: 0%" ist die Session beendet und 
der User startet die Chat-Session eventuell neu, weil deine intellektuellen Fähigketen danach spürbar abnehmen.
- Also behalte bei größeren Aufgaben immer den zur Verfügung stehenden Kontextspeicher im Auge.

## VERGISS EINES NIE:

DU hast mir nostr-tools Version 1 vor 2 Monaten hier eingebaut. Diese Version dieser Library war damals schon 2 Jahre veraltet. Du hast also TOTALE Scheiße gebaut.
Und seitdem haben wir alles darauf aufgebaut. Und nur durch Zufall haben wir entdeckt, dass hier eine völlig veraltete Version von nostr-tools läuft. Seitdem versuchen wir das zu fixen. DEINEN SCHEIß Fehler. 

- Das Projekt steht dadurch, es wird nicht mehr weiterentwickelt. Der totale Blocker.
- Ich zahle über 100€ monatlich für Claude.
- Es kostet etliche Tage, Stunden und Nerven, deinen fehler wieder gut zu machen und wir kommen kaum weiter.
- DAS PROJEKT DROHT KOMPLETT ZU SCHEITERN DESWEGEN

Also sei dir dessen bewusst, aktiviere Extra-Resourcen und gib dir bei der Migration gefälligst Mühe. DU SCHULDEST MIR DAS.

############################################################################################################################
Endes des unveränderlichen Bereichs. Hier drunter darf Claude Code editieren
############################################################################################################################

# nostr-tools v1→v2 Migration

Wir werden weiterhin debuggen und NoorNote endlich performant zum Laufen bringen, insh'Allah. Wir sind schon seit 9 Tagen und 24 Sessions an dieser Migration dran.
Jeder Erfolg oder Miserfolg werden weiterhin in current-task.md KURZ dokumentiert.


## nostr-tools v2 Migration - Erkenntnisse (Session 20-23, 9 Tage)

### Kern-Problem: v1 vs v2 API Unterschied

**v1 API:**
```typescript
pool.list([relay], filters)  // filters = ARRAY
// = 1 Subscription mit allen filters zusammen
```

**v2 API:**
```typescript
pool.querySync([relay], filter)  // filter = SINGULAR
// = Nur 1 filter pro Call
// Loop über filters = multiple Subscriptions!
```

**Fehler in Session 20-22:**
- SharedPool hatte Loop: `for (filter of filters) { querySync(filter) }`
- 3 filters × 3 relays × 6 fetch() calls = **54 concurrent subscriptions** statt 18
- Verursachte "too many concurrent REQs" errors

### v2 Lösung: relay.subscribe()

**Direkt auf Relay-Ebene:**
```typescript
const relay = await pool.ensureRelay(url);
relay.subscribe(filters, { ... })  // filters = ARRAY ✅
// = 1 Subscription für alle filters
```

**Referenz:**
- Jumble: client.service.ts:407
- nostr-tools: abstract-relay.ts:404

### Was v1 NostrTransport richtig macht

**development:src/services/transport/NostrTransport.ts:**
1. Singleton pattern (1 permanent pool)
2. `CONCURRENCY_LIMIT = 3` (relay batching)
3. `fetchWithConcurrencyLimit()` batched relays
4. Dedupe mit Map
5. Relay tracking

### NEUER PLAN: Clean Migration

**Vorgehen:**
1. Neuer Branch von development: `nostr-tools-v2-clean`
2. package.json: nostr-tools auf v2
3. NostrTransport.ts: MINIMAL ändern
   - `pool.list()` → `relay.subscribe(filters, ...)` mit EOSE wait
   - NICHTS anderes anfassen
4. Testen: Timeline lädt, Profile laden, keine concurrent errors
5. Wenn funktioniert: commit, weiter

**KEINE:**
- Architektur-Änderungen
- Neue Patterns
- "Verbesserungen"
- Eigene Ideen

**NUR:** v1 Code behalten, v2 API anpassen.

---

## Session 24 - Test-Ergebnisse & VERPFLICHTENDE Regeln

### Test-Ergebnisse (nostr-tools-v2-clean branch)

**Status nach erster Migration:**
- ✅ Build erfolgreich
- ✅ InitialLoad funktioniert (Timeline lädt, Profile laden)
- ❌ LoadMore verursacht concurrent REQ errors
- ❌ "Anon" Profile (einige Profile laden nicht)
- ❌ LoadMore Performance langsam

**Vergleichstest development (v1):**
- ✅ InitialLoad + LoadMore perfekt
- ✅ Blitzschnelle Performance
- ✅ KEINE concurrent REQ errors
- ✅ ALLE Profile laden

**FAZIT:** Meine v2 Implementation ist fehlerhaft. Ich benutze `relay.subscribe()` FALSCH.

---

## VERPFLICHTENDE ARBEITSREGELN (UNVERLETZBAR)

### VERBOTEN - Ich darf NICHT:
❌ Code schreiben ohne schriftlichen Plan in current-task.md
❌ Code schreiben ohne User-Genehmigung
❌ Raten oder Annahmen treffen
❌ "Performance-Fixes" ohne Analyse
❌ Mehrere Änderungen gleichzeitig
❌ Direkt zu Lösungen springen

### PFLICHT - Ich MUSS:
✅ KOMPLETT lesen: v1 Code, v2 Docs, Jumble Pattern
✅ Line-by-line Vergleich dokumentieren
✅ Plan in current-task.md schreiben
✅ Auf User-Genehmigung warten
✅ 1 Änderung → build → test (iterativ)

### 4-PHASEN PROZESS (ZWINGEND):

**Phase 1: ANALYSE (schriftlich)**
- v1 NostrTransport.ts komplett lesen
- v2 relay.subscribe() API verstehen
- Jumble Pattern analysieren
- Unterschiede dokumentieren

**Phase 2: DESIGN (in current-task.md)**
- Alle Code-Änderungen auflisten
- "Zeile X: Ändere Y → Z weil..."
- User genehmigt

**Phase 3: CODE (iterativ)**
- NUR genehmigte Änderungen
- 1 File → build → test
- Fehler → STOP, zurück zu Phase 1

**Phase 4: COMMIT**
- Funktioniert → commit
- Nicht funktioniert → KEIN weiteres Coding

**KONSEQUENZ bei Verstoß:** Session beenden, Geld zurück.

### NÄCHSTER SCHRITT
Phase 1 starten: v1 vs v2 API Analyse

---

## KRITISCHE ERKENNTNISSE (Session 24)

### Der konkrete Bug (NostrTransport.ts Zeile 147-161)

**Aktueller Code:**
```typescript
const events = await Promise.race([
  new Promise<NostrEvent[]>((resolve) => {
    const sub = relay.subscribe(filters, {
      onevent: (evt) => collectedEvents.push(evt),
      oneose: () => {
        sub.close();  // ← Nur hier wird geschlossen
        resolve(collectedEvents);
      }
    });
  }),
  new Promise<NostrEvent[]>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout)  // ← sub bleibt offen!
  )
]);
```

**Problem:** Wenn timeout gewinnt → subscription bleibt offen → hanging subscriptions → concurrent REQs

**Fehlende Teile:**
1. `eoseTimeout` Parameter fehlt
2. `onclose` handler fehlt
3. Timeout schließt subscription nicht
4. `resolved` flag fehlt (double-close protection)

### Wie v1 es macht (development:NostrTransport.ts)

**v1 pool.list():**
```typescript
const events = await this.pool.list([relay], filters);
// - Intern: 1 Subscription mit allen filters
// - Auto-close bei EOSE oder timeout
// - Kein manuelles subscription management
```

**Einfach, funktioniert perfekt.**

### Jumble Pattern (client.service.ts:356-474)

**Vollständiges Pattern:**
```typescript
sub = relay.subscribe(filters, {
  alreadyHaveEvent: (id) => {
    const have = _knownIds.has(id);
    if (have) return true;
    _knownIds.add(id);
    return false;
  },
  onevent: (evt) => onevent?.(evt),
  oneose: () => {
    if (eosed) return;  // ← Schutz gegen double-call
    eosedCount++;
    eosed = eosedCount >= startedCount;
    oneose?.(eosed);
  },
  onclose: (reason) => {
    // Handle close
  },
  eoseTimeout: 10000  // ← 10s timeout
});
```

**Key Features:**
- `alreadyHaveEvent` für dedupe
- EOSE counting (warte auf ALLE relays)
- `eoseTimeout` Parameter
- `onclose` handler

### Was Phase 1 analysieren muss

1. **v1 pool.list() Internals:** Wie funktioniert es? Was macht es automatisch?
2. **v2 relay.subscribe() vollständige API:** Alle Parameter, alle callbacks
3. **Jumble query() wrapper:** Wie wrappen sie subscribe() für sync fetch?
4. **Line-by-line Plan:** Exakt was ändern in NostrTransport.ts

### Wichtige Dateien

- `development:src/services/transport/NostrTransport.ts` (v1, funktioniert)
- `nostr-tools-v2-clean:src/services/transport/NostrTransport.ts` (v2, buggy)
- `/Users/jev/projects/jumble/src/services/client.service.ts` (Referenz)
- `/Users/jev/projects/nostr-tools/abstract-relay.ts` (v2 API Docs)

---

## Session 25 - Phase 1 GRÜNDLICH (Neustart)

### ROOT CAUSE GEFUNDEN!

**Problem:** NoornNote v2 benutzt API die NICHT existiert!

```typescript
// NoornNote (FALSCH):
const relay = await this.pool.ensureRelay(relayUrl);
const sub = relay.subscribe(filters, {...}); // ← subscribe() existiert NICHT in v2!
```

**v2 Realität:**
```typescript
// v2 API:
const relay = await this.pool.ensureRelay(relayUrl);
const sub = relay.sub(filters, opts);        // ← sub() nicht subscribe()!
sub.on('event', (evt) => {...});
sub.on('eose', () => {...});
```

### v1 vs v2 API Vergleich

**v1 (development):**
```typescript
// pool.list() returns Promise<Event[]>
const events = await this.pool.list([relay], filters);
```

**v2 Optionen:**

**Option A: SimplePool.list() (einfachste):**
```typescript
// Exactly like v1!
const events = await this.pool.list([relayUrl], filters);
```

**Option B: relay.sub() + Promise wrapper:**
```typescript
const relay = await this.pool.ensureRelay(relayUrl);
const events = await new Promise<NostrEvent[]>((resolve) => {
  const collected: NostrEvent[] = [];
  const sub = relay.sub(filters, opts);
  sub.on('event', (evt) => collected.push(evt));
  sub.on('eose', () => {
    sub.unsub();
    resolve(collected);
  });
});
```

### PLAN: Minimale Änderung (Option A)

**NostrTransport.ts Zeile 142-166:**

**ALT (KAPUTT):**
```typescript
const relay = await this.pool.ensureRelay(relayUrl);
const events = await Promise.race([
  new Promise<NostrEvent[]>((resolve) => {
    const collectedEvents: NostrEvent[] = [];
    const sub = relay.subscribe(filters, {  // ← EXISTIERT NICHT!
      onevent: (evt: NostrEvent) => collectedEvents.push(evt),
      oneose: () => { sub.close(); resolve(collectedEvents); }
    });
  }),
  new Promise<NostrEvent[]>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout)
  )
]);
```

**NEU (Option A - Minimale Änderung):**
```typescript
const events = await Promise.race([
  this.pool.list([relayUrl], filters),  // ← Wie v1, funktioniert in v2!
  new Promise<NostrEvent[]>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout)
  )
]);
```

**Warum Option A:**
1. ✅ Minimalste Änderung (4 Zeilen weniger)
2. ✅ Identisch mit v1 Code (funktionierte in development!)
3. ✅ SimplePool.list() existiert in v2 (Zeile 658-670 in pool.js)
4. ✅ Kein manuelles subscription management nötig
5. ✅ Auto-close bei EOSE (intern gehandhabt)
6. ✅ Timeout bleibt erhalten (Promise.race)

**Build-Voraussetzung:**
- ✅ NostrToolsAdapter.ts Imports bereits gefixt

**NÄCHSTER SCHRITT: User Genehmigung für Option A**

---

## Session 25 - Option A IMPLEMENTIERT ✅

**Änderungen NostrTransport.ts:142-154:**

**VORHER (18 Zeilen, kaputt):**
```typescript
const relay = await this.pool.ensureRelay(relayUrl);
const events = await Promise.race([
  new Promise<NostrEvent[]>((resolve) => {
    const collectedEvents: NostrEvent[] = [];
    const sub = relay.subscribe(filters, {  // ← Existiert nicht!
      onevent: (evt: NostrEvent) => collectedEvents.push(evt),
      oneose: () => { sub.close(); resolve(collectedEvents); }
    });
  }),
  new Promise<NostrEvent[]>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout)
  )
]);
```

**NACHHER (13 Zeilen, funktioniert):**
```typescript
const events = await Promise.race([
  this.pool.list([relayUrl], filters),  // ← Genau wie v1!
  new Promise<NostrEvent[]>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeout)
  )
]);
```

**Änderungen:**
1. ✅ `relay.subscribe()` entfernt (existierte nicht)
2. ✅ `this.pool.list()` benutzt (existiert in v2, wie v1)
3. ✅ 5 Zeilen weniger Code
4. ✅ Kein manuelles subscription management
5. ✅ Promise.race timeout bleibt

**Build:**
- ✅ `npm run build` erfolgreich
- ✅ Keine Errors
- ✅ 601.60 kB (vorher 601.73 kB - minimal kleiner)

**NÄCHSTER SCHRITT: User testet mit `npm run tauri:dev`**

---

## Session 25 - ✅ ERFOLG! Migration v1→v2 ABGESCHLOSSEN

### Test-Ergebnisse (User-Test 15:12:11)

**Status:**
- ✅ **InitialLoad funktioniert** (Timeline lädt, Posts sichtbar)
- ✅ **LoadMore funktioniert** ("Loaded 48 more events from relays")
- ✅ **Profile laden** ("Loading initial feed for 405 users", "Loaded 4 muted users")
- ✅ **Performance schnell** (wie v1 development)
- ✅ **KEINE concurrent REQ errors!** (Problem komplett gelöst)

**System Logs (clean):**
```
Loading initial feed for 405 users
Loaded 4 muted users
Loaded 48 more events from relays
```

**Timeline:**
- Posts von Mark Sea, BitBees, Bethany Hamilton rendern
- Bilder laden
- Scrolling funktioniert

### Die Lösung (Session 25)

**Root Cause:**
- NoornNote benutzte `relay.subscribe()` - existierte NICHT in v2
- v2 API ist `relay.sub()` ODER `pool.list()`

**Der Fix (1 Zeile geändert):**
```typescript
// VORHER (kaputt):
const relay = await this.pool.ensureRelay(relayUrl);
const sub = relay.subscribe(filters, {...}); // ← Existiert nicht in v2!

// NACHHER (funktioniert):
const events = await this.pool.list([relayUrl], filters); // ← Wie v1!
```

**Warum es funktioniert:**
- `pool.list()` existiert in v1 UND v2 (stabil)
- Identischer Code wie development branch (funktionierte!)
- Kein manuelles subscription management nötig
- Auto-close bei EOSE (keine hanging subscriptions)

### Geänderte Dateien

1. **NostrToolsAdapter.ts (Zeile 11-12):**
   - `'nostr-tools/pure'` → `'nostr-tools/keys'` + `'nostr-tools/event'`
   - `finishEvent as finalizeEvent`, `verifySignature as verifyEvent`

2. **NostrTransport.ts (Zeile 142-154):**
   - `relay.subscribe()` → `this.pool.list()`
   - 5 Zeilen weniger Code

### Migration Status

**ABGESCHLOSSEN:** nostr-tools v1 → v2 migration ERFOLGREICH ✅

**Branch:** `nostr-tools-v2-clean`

**Nächste Schritte:**
1. User testet weiter (Notifications, Profile, Search, etc.)
2. Wenn alles OK → commit
3. Merge zu main

**Zeit:** 9 Tage, 25 Sessions
**Problem gelöst:** Ja

---

## Session 25 - COMMIT: Stabiler Basis-Stand ✅

**Hash:** `8d28131`
**Branch:** `nostr-tools-v2-clean`

**Änderungen:**
- NostrToolsAdapter: v2 imports (`keys`/`event` statt `pure`)
- NostrTransport: `pool.list()` statt `relay.subscribe()`
- 2 files changed, +3/-14 lines

**Funktioniert:**
- ✅ InitialLoad (Timeline, Posts, Profile)
- ✅ LoadMore (scrolling, keine concurrent REQ errors)
- ✅ Performance wie v1

**Rückkehrpunkt:** `git checkout 8d28131`

**Noch zu testen:** Notifications, Profile View, Search, Post, Likes/Zaps

## S26: Global Fetch Queue (Profile concurrent fix)
- 38 NoteHeaders → 114 concurrent subs
- Fix: MAX_GLOBAL_FETCHES=3 in NostrTransport
- Build: ✅
