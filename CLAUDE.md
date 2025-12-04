# Noornote - Nostr Desktop Client (Vanilla JS + Tauri)

## ABBREVIATIONS

**Views:** TV (Timeline), SNV (Single Note), PV (Profile), AV (Article), NV (Notifications), MLV (Mute List), SV (Settings), LV (Login)
**Components:** ISL (Interaction Status Line), CSM (AppState.ts), NNM (New Note Modal)
**Eco:** NN (this app), NS (NoorSigner at ../noorsigner/)
**Debug:** ss = screenshots/screenshot.png (ss1, ss2...), csl = console logs

## WORKFLOW - ⚠️ NEVER FORGET! ⚠️

**Philosophy:** Enterprise-level modularity. Ask: "Could this be useful elsewhere? Where's the right architectural home?" If unsure, ask user. Think addon/extension system future-proofing.

**Communication:** Keep replies short (user reads first paragraph only).

**Process:**
1. **Code:** Modular and clean, no dirty hacks, no timeout tricks. `npm run build` + `npm run tauri build` MUST pass (zero errors/warnings). Minimal logs. Persistence: indexedDB (permanent), localStorage (session), KeyChain (sensitive).
2. **File Editing:** For multiple changes in ONE file: Use `Read` + `Write` (1 approval). NEVER multiple `Edit` calls (each needs approval). `Edit` is ONLY for single, targeted changes. Multi-edit = Read entire file → modify → Write complete file.
3. **Test:** User tests via `npm run tauri:dev` (wide+devtools) or `tauri:dev:clean` (production-like) in a different terminal window.
4. **Debug:** Don't leave behind debug logs or traces of unsuccessful code changes.
5. **Commit (⚠️FOLLOW EXACTLY⚠️):** 
    - ONLY on explicit user approval ("commit"/"feature ok").
    - Format: `git add . && git commit -m "[msg]"`.
    - No selective adds,
    - No 'git log', no 'git diff' before or after ... nothing.
    - Short one-liner messages preferred.
    - NO Claude signatures.
    - Never mentions other client in commit message.
6. **Push:** User says "push" → `git checkout main && git merge development && git push && git checkout development` → confirm (say: "Back at development branch. Awaiting instructions.").
7. **Research:** New features REQUIRE upfront research (NIPs, Jumble/Amethyst, NDK docs). Document findings in `docs/todos/` BEFORE coding.
8. **Roadmap (⚠️KRITISCH⚠️):**
    - `docs/todos/roadmap.md` ist der ZENTRALE FAHRPLAN - IMMER aktuell halten!
    - Nach jeder Session: Status in roadmap.md updaten
    - Feature erst abhaken wenn VOLLSTÄNDIG umgesetzt
    - Fertige Features: Todo-Datei nach `docs/features/` verschieben
    - Verweise auf Detail-Dateien aktuell halten
9. And last but not least:
   ⚠️ DON'T GUESS! DON'T GUESS! DON'T GUESS! DON'T GUESS! DON'T GUESS! DON'T GUESS! DON'T GUESS! DON'T GUESS!
      KNOW! ANALYZE. FIND OUT. LEARN. KNOW! ⚠️
10. **⚠️ MANDATORY RESEARCH BEFORE CODING ⚠️:**
    - BEFORE creating any new file: scan `src/services/` and `src/helpers/` for existing solutions
    - BEFORE implementing a feature: find 2-3 similar implementations, READ them fully
    - SHOW the user what you found ("Found ModalService, ZapModal uses it like X...")
    - WAIT for user confirmation before writing code
    - 90% research, 10% coding. Not the other way around.
    - Violating this = wasted work that gets reverted

**⚠️ BROWSER COMPATIBILITY:** NO `require()` in any browser-executed code! Use ES6 imports only. `require()` only works in Node.js.

## ARCHITECTURE

### NDK Integration (Post-Migration)
**Transport Layer:** 100% NDK-based. NostrTransport wraps NDK singleton with custom API.
```typescript
✅ Components → Services → NostrTransport → NDK → Relays
❌ NEVER import NDK directly in components/orchestrators
❌ NEVER use require() in browser code (Node.js only!)
```

**Event Types:**
```typescript
import type { NostrEvent } from '@nostr-dev-kit/ndk';  // 78 files use this
import type { UnsignedEvent } from '../services/NostrToolsAdapter';
```

### NostrToolsAdapter Rule
Crypto functions use NostrToolsAdapter (wraps nostr-tools, NDK's peer dependency).
```typescript
✅ import { decodeNip19, finalizeEvent } from '../../services/NostrToolsAdapter';
✅ import type { UnsignedEvent } from '../../services/NostrToolsAdapter';
❌ import { nip19 } from 'nostr-tools';  // Always use adapter
❌ const x = require('...'); // Browser doesn't support require()!
```

### Event Signing & Publishing
**Sign:** Always via `AuthService.signEvent()` (supports nsec, extension, KeySigner)
**Publish:** Always via `NostrTransport.publish()`
❌ Never sign/publish directly with `finalizeEvent()` or `ndkEvent.publish()`

### Event Signature Verification
- **NDK auto-verifies ALL events** from `NostrTransport.fetch/subscribe`
- ❌ NEVER bypass NostrTransport
- ❌ NEVER manually verify events from NostrTransport (already verified)
- ✅ ONLY verify events from external sources (WebSocket, NWC, etc.)

### AuthGuard
- **Write Events:** Via domain services (PostService, ReactionService, etc.) - call `AuthGuard.requireAuth()` before operations
- **Read-Protected Views:** Manual `AuthGuard.requireAuth()` at view init
- Missing AuthGuard = not committable

### UI/UX
- Layout: 3-col-Layout. Column names (from left to right): .sidebar (sbc), .primary-content (pcc), .secondary-content (scc‚)
- No browser dialogs (use Modal Helper)
- Colors: $color-1-6, interactive = $color-4 (pink)
- Spacing: $gap-based (`calc($gap / 2)`, `$gap * 2`)
- reuse existing CSS patterns in Atoms and Molecules, like _typography.scss, _buttons.scss, _tabs.scss etc. If you want to introduce new styles: ask. But before, verify, they don't exist yet.
- Async: ErrorService (catch) + ToastService (success)
- No TODOs, no deprecated SASS (use color.adjust)
- App.ts = coordination only (business logic in components)

### Orchestrator Pattern
```
Components → Orchestrators → NostrTransport → NDK → Relays
```
- ❌ Components NEVER import NDK or SimplePool directly
- ✅ Use NostrTransport methods (see NostrTransport.ts for API)
- ✅ Check `src/services/orchestration/` before creating new Orchestrator (30+ exist)
- ✅ Ask user before creating new Orchestrator

### User Display Rule
- **HEX/NPUB**: Internal only, NEVER visible in UI (except npub in URLs)
- **USERNAME**: ONLY legitimate user representation
- ❌ NEVER "shorten" pubkeys (npub1abc...xyz) - use username or fetch it

### List Storage (Follows, Bookmarks, Mutes)
3 storage locations: **Local Files** ↔ **Browser/localStorage** ↔ **Relays**
- **ALL changes happen ONLY in Browser (localStorage)**
- Explicit "Save to File" or "Sync to Relays" required to persist elsewhere
- UI reads/writes browserItems via `adapter.getBrowserItems()` / `adapter.setBrowserItems()`
- ❌ NEVER write to files directly from UI (use ListSyncManager buttons)

### Reference Implementations
Research: Jumble (master branch!), YakiHonne, Nostur - navigate from front page

**Local Directories:**
- NDK: `../NDK/` (local NDK development)
- Yakihonne: https://github.com/YakiHonne/yakihonne-web-app
- Jumble: `../jumble/` (local github clone, uses nostr-tools version2)
- Habla: `../habla/` (habla.news - NIP-23 long-form reference, Next.js + NDK)

---

