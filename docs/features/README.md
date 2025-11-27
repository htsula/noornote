# Noornote Future Features

This directory contains detailed planning documents for major features planned for future releases.

## Why Separate Docs?

- **Keep CLAUDE.md focused** - Only active development context
- **Preserve detailed planning** - Don't lose architectural decisions
- **Prevent context overflow** - Claude forgets less with smaller context files
- **Better organization** - One feature = one document

## Feature Status

### Planned
- [Embedded Local Relay](./embedded-relay.md) - Full-featured backup relay bundled with Tauri builds (v1.0)

### In Progress
- ✅ NIP-56 Reporting (Completed - v0.8)

### Backlog
- **NIP-46 Remote Signer Support** - Awaiting hardware device (Nsec Remote Nostr Signer)
- **NIP-51 Mute Lists** - Public & Private user muting
- **NIP-17 Direct Messages** - Encrypted private messaging
- **NIP-28 Public Chat Channels** - Group chat functionality
- **NIP-23 Long-form Content** - Article publishing & reading
- **NIP-57 Lightning Zaps** - Tipping system
- **NIP-98 HTTP Auth** - Authenticate with web services via Nostr

## Document Template

Each feature document should include:

1. **Overview** - What and why
2. **User Experience Flow** - How users interact with it
3. **Requirements** - Must-haves and constraints
4. **Technical Implementation** - Architecture, code structure
5. **Testing Strategy** - Validation approach
6. **Rollout Plan** - Phased implementation
7. **Future Enhancements** - Post-MVP improvements

## Contributing

When planning a new major feature:

1. Create `docs/features/feature-name.md`
2. Use existing documents as templates
3. Update this README with status
4. Link from CLAUDE.md only when actively working on it
5. Move back here when feature is completed or paused
