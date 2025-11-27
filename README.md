# Noornote - High-Performance Nostr Web Client

**Noornote** (Arabic: نور, meaning "light") is a high-performance, enterprise-grade Nostr web client built with vanilla JavaScript and a modular orchestrator architecture.

## Project Status

🚀 **Active Development** - Core features implemented and functional

### Implemented Features
- ✅ Timeline View (TV) with infinite scroll and real-time polling
- ✅ Single Note View (SNV) with replies and quoted notes
- ✅ Profile View (PV) with metadata display
- ✅ Interaction Status Line (ISL) - Likes, Reposts, Quotes, Zaps, Replies
- ✅ Quoted reposts rendering with smart deduplication
- ✅ User authentication via browser extensions (nos2x, Alby, Flamingo)
- ✅ Multi-relay support with NIP-65 relay list fetching
- ✅ Advanced caching system (Memory + IndexedDB)

### In Progress
- 🔄 Reply list refactoring (DOM & Styles)
- 🔄 Enhanced system logging in Central State Management
- 🔄 Persistent reply stats caching

## Architecture

### Orchestrator Pattern
Noornote uses a **modular orchestrator architecture** inspired by Gossip:

```
Components → Orchestrators → Router → Transport → Relays
```

**Core Orchestrators:**
- **FeedOrchestrator** - Timeline feed loading (initial, load more, polling)
- **ReactionsOrchestrator** - Interaction stats (reactions, reposts, zaps, replies)
- **ThreadOrchestrator** - Reply fetching for Single Note View
- **ProfileOrchestrator** - User profile metadata (kind:0)
- **QuoteOrchestrator** - Quoted event fetching by reference

**Key Principles:**
- Components NEVER call SimplePool directly
- One subscription per type in Router, distributed to Orchestrators
- Clean separation of concerns with proper encapsulation

### Cache Strategy
Multi-layer caching with different TTLs:
- **Notes** (kind:1): Permanent in FeedOrchestrator
- **Profiles** (kind:0): 7 days in UserProfileService
- **Reactions** (kind:7): 5 minutes in ReactionsOrchestrator
- **Replies** (kind:1): 5 minutes in ThreadOrchestrator
- **Quotes** (kind:1): 30 minutes in QuoteOrchestrator

## Technology Stack

### Core Technologies
- **Framework**: Vanilla JavaScript (zero framework overhead)
- **Language**: TypeScript with strict configuration
- **Build**: Vite + Rollup with aggressive optimization
- **Styling**: SASS with CSS Variables (mobile-first design)
- **Bundle Target**: <500KB gzipped

### Nostr Integration
- **Libraries**: nostr-tools + SimplePool for relay management
- **Authentication**: Browser extension integration (nos2x, Alby, Flamingo)
- **NIPs Supported**: NIP-01, NIP-05, NIP-27, NIP-65
- **Security**: Client-side only, zero server dependencies

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Modern browser (Chrome, Firefox, Safari, or Brave)
- Nostr browser extension (optional, for write operations)

### Development Setup
```bash
# Clone the repository
git clone https://gitlab.com/77elements/noornote.git
cd noornote

# Install dependencies
npm install

# Start development server (runs on localhost:3000)
npm run dev

# Build for production
npm run build
```

### Optional: Local Relay for Development

Noornote includes an **optional local strfry relay** for development and testing. This is completely separate from the main app.

**Use Cases:**
- Test write operations (likes, reposts, replies) without polluting public relays
- Run a local backup/cache of your Nostr data
- Develop offline

**Quick Start:**
```bash
cd relay

# TEST Mode (isolated, no sync with public relays)
./scripts/test-mode.sh

# PROXY Mode (bidirectional sync with public relays)
./scripts/proxy-mode.sh
```

**Requirements:**
- Docker + Docker Compose
- Port 7777 available
- Colima recommended for macOS (better isolation)

**Configuration:**
- Relay URL: `ws://localhost:7777`
- Add manually in Noornote Settings → Relays
- Full docs: [relay/README.md](./relay/README.md)

## Development Workflow

### Strict 5-Phase Process
1. **Code Implementation** - Clean, modular, TypeScript-compliant
2. **Build Verification** - `npm run build` must succeed with zero errors
3. **Real-World Testing** - User tests in browser (localhost:3000)
4. **User Approval Gate** - Explicit approval required before commit
5. **Git Commit** - Short message, no Claude signature

### Quality Standards
- ✅ TypeScript compilation with zero errors
- ✅ Modular architecture with proper separation of concerns
- ✅ No TODOs in code (address immediately)
- ✅ SASS spacing uses `$gap` variable only (no hardcoded rem values)
- ✅ No deprecated SASS functions (use `color.adjust` instead of `darken`/`lighten`)

## Project Documentation

### Core Standards
- **[CLAUDE.md](./CLAUDE.md)** - Complete development standards, architecture patterns, and coding principles

## Contributing

This project follows **enterprise-level development standards**. Please review [CLAUDE.md](./CLAUDE.md) before contributing.

### Key Principles
- **Research First**: Look up existing implementations before guessing
- **Modular Architecture**: Ask "Could this be useful elsewhere?" before implementing
- **No Chaos Mode**: If debugging takes 10+ rounds, stop and reset
- **Clean Commits**: Only with explicit user approval, no auto-signatures

## License

MIT License

---

*Project initiated: 20.09.2025*
*Status: Active Development*
*Last updated: October 2025*
