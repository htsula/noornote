# Encryption Fallback Logic für Private Listen

## Ziel
Einheitliche, robuste Verschlüsselungslogik für alle privaten Listen (Follows, Mutes, Bookmarks).

## Gewünschte Logik

```
Encrypt:
1. Versuche NIP-44
2. Falls NIP-44 fehlschlägt → Fallback auf NIP-04
3. Falls beide fehlschlagen → Fehlermeldung anzeigen, nur Public-Liste übertragen

Decrypt:
1. Auto-detect Format (NIP-44 vs NIP-04 via `?iv=` Check)
2. Versuche passendes Protokoll
3. Falls fehlschlägt → Fallback auf anderes Protokoll
4. Falls beide fehlschlagen → Warnung, Private Items ignorieren
```

## Aktuelle Situation (Stand: 2024-11)

### Auth-Methoden Support

| Auth-Methode | NIP-04 | NIP-44 |
|--------------|--------|--------|
| **NoorSigner** | ✓ `nip04Encrypt/Decrypt` | ✓ `nip44Encrypt/Decrypt` |
| **Remote Signer (NIP-46)** | ❌ fehlt | ✓ `nip44Encrypt/Decrypt` |
| **Browser Extension** | ✓ (wird entfernt) | ✓ (wird entfernt) |
| **Direct nsec** | ❌ | ✓ (wird entfernt) |

### Listen-Orchestratoren

| Liste | NoorSigner | Remote Signer | Fallback 44→04 | Error → nur Public |
|-------|------------|---------------|----------------|-------------------|
| **Follows** | NIP-44 only | NIP-44 only | ❌ | ❌ |
| **Mutes** | NIP-04/44 (User wählt) | ❌ nicht unterstützt | ✓ nur decrypt | ❌ |
| **Bookmarks** | NIP-44 only | ❌ nicht unterstützt | ❌ | ❌ |

## Aufgaben

### 1. Remote Signer (NIP-46) - NIP-04 Support hinzufügen

**Datei:** `src/services/managers/Nip46SignerManager.ts`

```typescript
// Hinzufügen:
public async nip04Encrypt(plaintext: string, recipientPubkey: string): Promise<string>
public async nip04Decrypt(ciphertext: string, senderPubkey: string): Promise<string>
```

NDK's Signer Interface unterstützt `scheme` Parameter:
```typescript
bunkerSigner.encrypt(pubkey, plaintext, 'nip04')
bunkerSigner.decrypt(pubkey, ciphertext, 'nip04')
```

### 2. Follows - Remote Signer und Fallback

**Dateien:**
- `src/helpers/encryptPrivateFollows.ts`
- `src/helpers/decryptPrivateFollows.ts`
- `src/services/orchestration/FollowListOrchestrator.ts`

**Änderungen:**
- NIP-44 → NIP-04 Fallback in encrypt/decrypt Helpers
- Try/catch in `publishToRelays()`: Bei Fehler nur kind:3 (public) publishen

### 3. Mutes - Remote Signer Support

**Datei:** `src/services/orchestration/MuteOrchestrator.ts`

**Änderungen:**
- `encryptPrivateMutes()`: NIP-46 Case hinzufügen
- `decryptPrivateMutes()`: NIP-46 Case hinzufügen
- Fallback-Logik für encrypt (aktuell nur decrypt)
- Error-Handling: Bei Fehler nur Public-Mutes publishen

### 4. Bookmarks - Remote Signer und Fallback

**Datei:** `src/services/orchestration/BookmarkOrchestrator.ts`

**Änderungen:**
- `createPrivateBookmarkEvent()`: NIP-46 Case + NIP-04 Fallback
- `extractPrivateBookmarkItems()`: NIP-46 Case + NIP-04 Fallback
- Error-Handling: Bei Fehler nur kind:10003 (public) publishen

### 5. Einheitliche Helper-Funktion (Optional)

Erwägen: Zentrale `encryptForPrivateList()` und `decryptFromPrivateList()` Funktionen die:
- Auth-Methode erkennen
- NIP-44 → NIP-04 Fallback automatisch handhaben
- Einheitliches Error-Handling bieten

**Vorteile:**
- DRY (Don't Repeat Yourself)
- Konsistentes Verhalten über alle Listen
- Einfacher zu testen und warten

## Betroffene Dateien (Zusammenfassung)

```
src/services/managers/Nip46SignerManager.ts     # NIP-04 Methoden hinzufügen
src/helpers/encryptPrivateFollows.ts            # Fallback-Logik
src/helpers/decryptPrivateFollows.ts            # Fallback-Logik
src/services/orchestration/FollowListOrchestrator.ts   # Error-Handling
src/services/orchestration/MuteOrchestrator.ts         # NIP-46 + Fallback
src/services/orchestration/BookmarkOrchestrator.ts     # NIP-46 + Fallback
```

## Hinweise

- MuteOrchestrator hat bereits User-Preference für Encryption-Methode (`getEncryptionMethod()`)
- Diese könnte global gemacht werden für alle Listen
- Oder: Immer NIP-44 versuchen, NIP-04 nur als Fallback (kein User-Setting nötig)
