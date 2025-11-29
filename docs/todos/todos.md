## TODOs (volatile, user can request details)

### Features (Pending Implementation)

1. **Legal/Support Static Page**: Implement static page with legal information, contact form, and support resources.
  - **Content:** Impressum, Datenschutz (DSGVO compliance), voluntary error reporting contact form
  - **Location:** TBD - likely `/legal` or `/about` route
  - **Implementation:** Static component accessible from Settings or Footer
  - **Requirements:** Privacy-first approach, opt-in contact form, no telemetry

2. Plug-in System:
  - On-boarding
  - Bookmarks
  - Freelancer MP
  - Seller MP
  - Discovery

### Bugs (Require Fixing)

(keine offenen Bugs)


### Analytics & Monitoring

- **Zap Display Inconsistency in Notifications**: Systematisch untersuchen warum Zaps inkonsistent dargestellt werden. Aktuell gibt es 4 verschiedene Zustände: (1) Zap Line + Amount + gelbes Icon (vollständig), (2) nur gelbes Icon (kein Amount, keine Line), (3) Amount + gelbes Icon (keine Line), (4) Zap Line + Amount. Problem: Zap-Receipts (Kind 9735) kommen nicht immer oder fehlerhaft von NWC Wallets, obwohl Payment erfolgreich war. **Ziel:** Zap Line soll IMMER erscheinen wenn Payment erfolgreich war, unabhängig von Receipt-Status (optimistische UI). Mögliche Lösung: Fake Zap-Receipt Event nach erfolgreichem Payment erstellen oder EventBus-basiertes Update-System zwischen ISL und ZapsList implementieren.

### Under Observation

- **KeySigner IPC Connection Lost - UNTER BEOBACHTUNG**: "Broken pipe" Fehler wenn NN im Hintergrund. **Fix implementiert:** (1) Transient Error Detection (Broken pipe, os error 32), (2) Retry-Logik (3x mit 1s Delay), (3) Grace Period (6 Failures = 30s vor Logout), (4) Adaptive Polling (stoppt im Hintergrund, resumed bei Focus). **Logs:** `[KeySigner] Transient connection error`, `[AuthService] Window blurred/focused`, `[AuthService] Daemon check failed (X/6)`, `[AuthService] Connection restored`. **Location:** KeySignerClient.ts, AuthService.ts. **Status:** Monitoring in Production - falls weiterhin Disconnects → Polling Interval erhöhen oder komplett auf EventBus-basierte Lifecycle Events umstellen.
