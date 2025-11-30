# NoorSigner Multi-Account Support

## Übersicht

NoorSigner muss mehrere Keys verwalten können, damit NoorNote im Tauri-Modus Account-Switching unterstützt.

## Aktueller Stand (NoorSigner) - IMPLEMENTIERT

**CLI Commands:**
```bash
noorsigner add-account     # nsec + Passwort einrichten
noorsigner list-accounts   # Alle Accounts auflisten
noorsigner switch <npub>   # Account wechseln
noorsigner remove-account <npub>  # Account entfernen
noorsigner init            # Alias für add-account (erster Account)
noorsigner daemon          # Daemon starten
noorsigner sign            # Direktes Signieren
noorsigner test            # Test mit direktem nsec
noorsigner test-daemon     # Test via Socket
```

**Dateistruktur:**
```
~/.noorsigner/
├── accounts/
│   ├── npub1abc.../
│   │   ├── keys.encrypted    # Encrypted nsec
│   │   └── trust_session     # 24h password cache
│   └── npub1def.../
│       ├── keys.encrypted
│       └── trust_session
├── active_account            # Currently active npub
└── noorsigner.sock           # Daemon socket (shared)
```

**Daemon-Start-Ablauf:**
1. Lädt aktiven Account aus `active_account`
2. Lädt `~/.noorsigner/accounts/<npub>/keys.encrypted`
3. Prüft Trust Session (`trust_session`) - 24h Cache pro Account
4. Falls gültig → kein Passwort nötig
5. Falls abgelaufen → Passwort-Prompt
6. Fork in Background
7. Socket erstellen (`noorsigner.sock`)
8. Auf Sign-Requests warten
9. Live Account-Switch via API möglich

---

## API Endpoints (Socket IPC) - IMPLEMENTIERT

### 1. `list_accounts`
Listet alle gespeicherten Accounts (nur pubkeys, keine secrets).

**Request:**
```json
{ "id": "req-001", "method": "list_accounts" }
```

**Response:**
```json
{
  "id": "req-001",
  "accounts": [
    { "pubkey": "abc123...", "npub": "npub1...", "created_at": 1234567890 },
    { "pubkey": "def456...", "npub": "npub1...", "created_at": 1234567891 }
  ],
  "active_pubkey": "abc123..."
}
```

### 2. `add_account`
Fügt neuen Account hinzu (nsec + Passwort).

**Request:**
```json
{
  "id": "req-002",
  "method": "add_account",
  "nsec": "nsec1...",
  "password": "user_password",
  "set_active": true
}
```

**Response:**
```json
{
  "id": "req-002",
  "success": true,
  "pubkey": "abc123...",
  "npub": "npub1..."
}
```

### 3. `switch_account`
Wechselt aktiven Account (erfordert Passwort für den Ziel-Account).

**Request:**
```json
{
  "id": "req-003",
  "method": "switch_account",
  "pubkey": "def456...",
  "password": "password_for_this_account"
}
```

oder mit npub:
```json
{
  "id": "req-003",
  "method": "switch_account",
  "npub": "npub1def...",
  "password": "password_for_this_account"
}
```

**Response:**
```json
{
  "id": "req-003",
  "success": true,
  "pubkey": "def456...",
  "npub": "npub1..."
}
```

### 4. `remove_account`
Entfernt Account (kann nicht den aktiven Account entfernen).

**Request:**
```json
{
  "id": "req-004",
  "method": "remove_account",
  "pubkey": "def456...",
  "password": "password_for_this_account"
}
```

**Response:**
```json
{ "id": "req-004", "success": true }
```

### 5. `get_active_account`
Gibt aktuell aktiven Account zurück.

**Request:**
```json
{ "id": "req-005", "method": "get_active_account" }
```

**Response:**
```json
{
  "id": "req-005",
  "pubkey": "abc123...",
  "npub": "npub1...",
  "is_unlocked": true
}
```

---

## Passwort-Handling

**Entscheidung:** Separates Passwort pro Account
- Jeder Account hat eigenes Passwort
- Beim Switch muss Passwort eingegeben werden
- Sicherer als Master-Passwort

---

## Implementation Phasen

### Phase 1: Storage Migration (NoorSigner) - FERTIG
- [x] Neue Dateistruktur implementieren (`accounts/npub.../`)
- [x] Migration von Single-Account zu Multi-Account
- [x] `active_account` File für aktiven Account
- [x] Backwards-Compatibility für bestehende Installationen

### Phase 2: CLI Commands (NoorSigner) - FERTIG
- [x] `add-account` implementieren
- [x] `list-accounts` implementieren
- [x] `switch` implementieren
- [x] `remove-account` implementieren
- [x] `init` als Alias für add-account (erster Account)

### Phase 3: API Endpoints (NoorSigner) - FERTIG
- [x] `list_accounts` implementieren
- [x] `add_account` implementieren
- [x] `switch_account` implementieren
- [x] `remove_account` implementieren
- [x] `get_active_account` implementieren
- [x] Daemon nutzt neue Multi-Account Storage
- [x] Live Account-Switch im Daemon (ohne Neustart)
- [x] Thread-safe Account-Wechsel mit RWMutex

### Phase 4: NoorNote Integration - OFFEN
- [ ] KeySignerClient.ts erweitern für neue APIs
- [ ] AccountSwitcher: Passwort-Dialog für Switch bei NoorSigner
- [ ] AuthComponent: Add Account Flow für NoorSigner

---

## Betroffene Dateien

### NoorSigner (../noorsigner/) - FERTIG
- `main.go` - CLI Commands (add-account, list-accounts, switch, remove-account)
- `accounts.go` - Multi-Account Storage, Migration
- `daemon.go` - Daemon mit Multi-Account Support, neue API Endpoints
- `storage.go` - Bestehende Encryption-Funktionen (unverändert)
- `README.md` - Vollständige Dokumentation aller Features und API

### NoorNote - OFFEN
- `src/services/KeySignerClient.ts` - Neue API Methods
- `src/components/ui/AccountSwitcher.ts` - Passwort-Dialog für NoorSigner
- `src/components/auth/AuthComponent.ts` - Add Account Flow

---

## Nächste Schritte

1. [x] NoorSigner Codebase analysieren
2. [x] Entscheidung: Per-Account-Passwort
3. [x] NoorSigner Phase 1 implementieren (Storage)
4. [x] NoorSigner Phase 2 implementieren (CLI)
5. [x] NoorSigner Phase 3 implementieren (API)
6. [ ] NoorNote Phase 4 implementieren (Integration)
