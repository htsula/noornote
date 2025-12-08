# Pre-Release Quick Wins

Risikolose Verbesserungen, die vor dem Release erledigt werden können.

---

## 1. Ungenutzte Fonts löschen (42MB Einsparung)

**Problem:** 53MB Fonts im Bundle, aber nur Saira-Bold.ttf wird benutzt.

### Zu löschen:
```bash
# Komplett ungenutzt (kein @font-face, kein CSS-Verweis)
rm -rf public/fonts/Noto_Serif/      # 40MB
rm -rf public/fonts/Playfair_Display/ # 2MB

# Saira-Ordner aufräumen (nur Bold wird genutzt)
# Behalte: public/fonts/Saira/Saira-Bold.ttf
# Lösche: Alle anderen Saira-Varianten
```

### Verifikation:
```bash
# In src/styles/base/_fonts.scss:
# Nur Saira-Bold.ttf wird referenziert
grep -r "Saira" src/styles/
```

**Einsparung:** ~42MB Bundle-Größe

---

## 2. .DS_Store Dateien entfernen

```bash
find /Users/jev/projects/noornote -name ".DS_Store" -delete
```

### .gitignore prüfen:
```bash
grep ".DS_Store" .gitignore || echo ".DS_Store" >> .gitignore
```

---

## 3. Console.log Cleanup (bereits erledigt?)

Laut Commit-History wurden Debug-Logs bereits entfernt:
- `688ab92` Remove debug logs from LikeManager, RepostManager, PostEditorToolbar
- `42a3379` Remove noisy DMService debug logs

### Verifikation:
```bash
grep -r "console.log" src/services/ | grep -v "// console" | wc -l
```

Sollte minimal sein (nur Error-Logs).

---

## 4. TODO Comments prüfen

```bash
grep -r "TODO" src/ --include="*.ts" | grep -v "node_modules"
```

Alle TODOs sollten entweder:
- Entfernt werden (wenn erledigt)
- In Issues/Docs dokumentiert werden
- Oder als bewusste technische Schuld akzeptiert werden

---

## 5. Type-Safety Check

```bash
npm run typecheck
```

Sollte ohne Errors durchlaufen.

---

## 6. Build Check

```bash
npm run build
npm run tauri build
```

Sollte ohne Warnings durchlaufen.

---

## 7. Package.json Cleanup

### Repository URLs prüfen:
```json
"homepage": "https://gitlab.com/77elements/noornote#readme",
"repository": {
  "type": "git",
  "url": "https://gitlab.com/77elements/noornote.git"
}
```

Sollte auf GitHub zeigen (nicht GitLab), falls das Projekt dort gehostet wird.

---

## 8. Version Bump

Aktuell: `0.1.0`

Vor Release prüfen ob Version angepasst werden soll:
- `package.json:3`
- `src-tauri/tauri.conf.json:4`
- `src-tauri/Cargo.toml:3`

---

## Checkliste

- [x] Fonts löschen (42MB)
- [x] .DS_Store entfernen
- [x] Console.log prüfen (kritische → SystemLogger, debug entfernt)
- [x] TODOs prüfen (dokumentiert in docs/todos/)
- [x] Typecheck durchlaufen (~500 verbleibende Fehler dokumentiert in docs/todos/typescript-strict-mode.md)
- [x] Build durchlaufen (✓ erfolgreich)
- [x] Repository URLs korrigieren
- [x] Version prüfen (0.7.0)
- [x] Enduser-taugliche README erstellen
