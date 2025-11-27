# Bookmark Folders Relay Sync

## Status: TODO

## Problem
Bookmark folders are currently stored only locally in `~/.noornote/bookmarks-public.json`. They don't sync to relays.

## NIP-51 Solution
Use **kind:30003 Bookmark Sets** (parameterized replaceable events):

```
Event 1 (Main bookmarks - current):
  kind: 10003
  tags: [["e", "id1"], ["e", "id2"], ...]

Event 2 (Folder "Work"):
  kind: 30003
  tags: [["d", "Work"], ["e", "id3"], ["e", "id4"], ...]

Event 3 (Folder "Read Later"):
  kind: 30003
  tags: [["d", "Read Later"], ["e", "id5"], ...]
```

## Implementation Steps
1. Publish each folder as separate kind:30003 event with `d`-tag = folder name
2. Fetch all kind:30003 events for user on sync
3. Reconstruct folder structure from `d`-tags
4. Handle folder renames (new event replaces old with same `d`-tag)
5. Handle folder deletions (empty event or remove from local)

## Notes
- kind:30003 is parameterized replaceable → one event per folder name per user
- Private folders: encrypt content same as private bookmarks
- Root-level bookmarks stay in kind:10003
