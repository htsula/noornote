# NoorNote Installation

## Linux (Ubuntu/Debian)

### Schnellinstallation (empfohlen)

```bash
bash <(curl -s https://raw.githubusercontent.com/77elements/noornote/main/deployment/linux/quick-install.sh)
```

### Manuelle Installation

1. `.deb` Datei von der [Release-Seite](https://github.com/77elements/noornote/releases) herunterladen
2. Installieren:
   ```bash
   sudo apt install ./Noornote_*.deb
   ```
3. Starten: `noornote`

---

## Linux (Arch, Fedora, andere)

1. Tarball von der [Release-Seite](https://github.com/77elements/noornote/releases) herunterladen
2. Entpacken und installieren:
   ```bash
   tar -xzf NoorNote-*.tar.gz
   cd NoorNote-*/
   ./install.sh
   ```

---

## macOS

1. Download `.dmg` from the [Release page](https://github.com/77elements/noornote/releases)
2. Open DMG and drag `Noornote.app` to `/Applications`
3. **Important:** Since the app is not signed, macOS will show an error. Run in Terminal:
   ```bash
   xattr -cr /Applications/Noornote.app
   ```
4. Now the app can be opened normally

---

## Windows

Kommt bald.
