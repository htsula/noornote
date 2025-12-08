# Known Bugs

## Open

### Mutual Background Check - False Positives
- **Screenshot:** `screenshots/bugs/mutual-background-check.png`, `screenshots/bugs/mutual-follow-bug-false-positives.png`
- **Referenz:** `docs/features/mutual-check-feature-04-automation.md`
- **Problem:** Background Check (App-Start + alle 4h) meldet wiederholt Follow/Unfollow-Wechsel für dieselben 3 User (z.B. "Mike stopped following you back" mehrfach), obwohl diese User durchgehend folgen
- **Symptom:** Falsche Notifications in der NV, gleiche User tauchen immer wieder auf
- **Status:** Scheduler DEAKTIVIERT in `MutualChangeService.ts` (zu viele False Positives). Manuelle Checks über Follows-Tab funktionieren weiterhin.

## Fixed

- **Mutual Follow Badge Widerspruch** - Follow-Liste zeigte "Not following back", Profil zeigte "Follows you". Ursache: MutualService und UserService holten Kind:3 Events separat, NDK Cache wurde inkonsistent. Fix: MutualService nutzt jetzt UserService als einzige Datenquelle.
- **In-folder bookmark reordering** - Items innerhalb eines Folders ließen sich nicht per Drag & Drop umsortieren (Fixed: 599bb5a)
- **Profile list order mismatch** - Reihenfolge in Profile Lists stimmte nicht mit Folder-Reihenfolge überein (Fixed: 599bb5a)
