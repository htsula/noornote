# Tauri-Only Strategy

## Entscheidung

Browser-Version wird eingestellt. NoorNote wird ausschließlich als Tauri Desktop-App entwickelt.

## Begründung

Die Komplexität, für alle Tauri-Features Browser-Alternativen zu entwickeln, ist zu hoch:

| Feature | Tauri | Browser-Alternative | Problem |
|---------|-------|---------------------|---------|
| Per-user file storage | `~/.noornote/{npub}/` | IndexedDB | Nicht portabel zwischen Geräten |
| List-Sync (File) | Lokale JSON-Files | - | Keine Alternative |
| Bookmark Folders | Lokal gespeichert | Relay-only | Relays unterstützen keine Folders (kind:10003 ist flat) |
| Key-Management | NoorSigner + Keychain | NIP-07 Extensions | Abhängig von Drittanbieter-Extensions |
| Native Dialoge | Tauri FS API | Browser File API | Eingeschränkte Funktionalität |

## NoorSigner Ports

NoorSigner muss für alle Plattformen verfügbar sein:

### macOS (✅ Fertig)
- Keychain für sichere Speicherung
- ARM64 + x86_64

### Windows (❌ TODO)

**Credential Manager API:**
```rust
// Windows Credential Manager statt Keychain
// Crate: windows-credentials oder keyring-rs

use keyring::Entry;

let entry = Entry::new("noorsigner", &npub)?;
entry.set_password(&encrypted_nsec)?;
let nsec = entry.get_password()?;
```

**Schritte:**
1. [ ] `keyring` crate evaluieren (cross-platform)
2. [ ] Windows Credential Manager testen
3. [ ] GitHub Actions: Windows Build hinzufügen
4. [ ] Windows Installer (.msi) konfigurieren

### Linux (❌ TODO)

**Secret Service API (GNOME Keyring / KWallet):**
```rust
// Secret Service D-Bus API
// Crate: keyring-rs (unterstützt Linux)

use keyring::Entry;

let entry = Entry::new("noorsigner", &npub)?;
entry.set_password(&encrypted_nsec)?;
```

**Schritte:**
1. [ ] Secret Service auf Linux testen
2. [ ] Fallback für Systeme ohne Secret Service (encrypted file?)
3. [ ] GitHub Actions: Linux Build hinzufügen
4. [ ] AppImage konfigurieren

## keyring-rs Crate

Cross-platform Lösung für alle drei Plattformen:

```toml
# Cargo.toml
[dependencies]
keyring = "2"
```

| Platform | Backend |
|----------|---------|
| macOS | Keychain |
| Windows | Credential Manager |
| Linux | Secret Service (D-Bus) |

**Vorteile:**
- Ein API für alle Plattformen
- Gut maintained
- Rust-native

**Aktuell in NoorSigner:**
- Verwendet `security-framework` (macOS-only)
- Muss auf `keyring` umgestellt werden

## NoorNote Cleanup

Nach NoorSigner-Ports kann NoorNote vereinfacht werden:

### Phase 1: Browser-Code entfernen
- [ ] `noorserver/` Repo archivieren
- [ ] Browser-Fallbacks in Services entfernen
- [ ] `PlatformService.isBrowser` Checks entfernen

### Phase 2: Codebase vereinfachen
- [ ] `PlatformService` auf Tauri-only reduzieren
- [ ] Browser-spezifische File-APIs entfernen (Blob download, FileReader)
- [ ] NIP-07 Extension Support entfernen (optional behalten?)

### Phase 3: Docs aktualisieren
- [ ] `docs/todos/x-platform/` archivieren oder löschen
- [ ] README: Nur Tauri-Installation dokumentieren

## Zeitplan

1. **NoorSigner Windows-Port** - Höchste Priorität
   - keyring-rs Integration
   - Windows Build + Installer

2. **NoorSigner Linux-Port** - Zweite Priorität
   - Secret Service testen
   - Linux Build + AppImage

3. **NoorNote Cleanup** - Nach erfolgreichen Ports
   - Browser-Code entfernen
   - Docs aktualisieren

## Offene Fragen

- [ ] Librem 5: Unterstützt Secret Service? Falls nein → eigene Lösung
- [ ] NIP-07 Support behalten für Nutzer die Extension bevorzugen?
