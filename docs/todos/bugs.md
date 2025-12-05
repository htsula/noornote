# Known Bugs

## Open

### Mutual Background Check - False Positives
- **Screenshot:** `screenshots/bugs/mutual-background-check.png`
- **Referenz:** `docs/features/mutual-check-feature-04-automation.md`
- **Problem:** Background Check (App-Start + alle 4h) meldet wiederholt Follow/Unfollow-Wechsel für dieselben 3 User (z.B. "Mike stopped following you back" mehrfach), obwohl diese User durchgehend folgen
- **Symptom:** Falsche Notifications in der NV, gleiche User tauchen immer wieder auf

### Mutual Follow Badge Widerspruch
- **Screenshot:** `screenshots/bugs/mutual-follow-bug.png`
- **Referenz:** `docs/features/mutual-check-feature-01-static-list.md`
- **Problem:** Follow-Liste zeigt "Not following back" für User, aber dessen Profil zeigt "Follows you"
- **Erwartung:** Wenn Profil "Follows you" anzeigt, sollte Mutual-Check "Mutual" sein

## Fixed

- **In-folder bookmark reordering** - Items innerhalb eines Folders ließen sich nicht per Drag & Drop umsortieren (Fixed: 599bb5a)
- **Profile list order mismatch** - Reihenfolge in Profile Lists stimmte nicht mit Folder-Reihenfolge überein (Fixed: 599bb5a)
