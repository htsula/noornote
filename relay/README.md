# Noornote Local Relay (Optional)

**Optional local strfry relay for Noornote development and testing.**

This is a standalone component - Noornote works perfectly fine without it. Use this relay when you want to:
- Test write operations (likes, zaps, replies) without polluting public relays
- Run a local backup/cache of your Nostr data
- Develop offline

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Noornote running on `localhost:3000`

### Modes

**TEST Mode (Isolated)**
```bash
./scripts/test-mode.sh
```
- Relay runs on `ws://localhost:7777`
- Completely isolated from public Nostr network
- All writes stay local only
- Perfect for development/testing

**PROXY Mode (Sync with Public Relays)**
```bash
./scripts/proxy-mode.sh
```
- Relay runs on `ws://localhost:7777`
- Bidirectional sync with public relays
- Acts as local cache + backup
- Writes are forwarded to public relays

### Stop Relay
```bash
docker-compose down
```

## Configure Noornote

1. Start Noornote: `npm run dev`
2. Go to Settings → Relays
3. Add relay: `ws://localhost:7777`
4. (Optional) Remove public relays if you want to use only local relay

## Directory Structure

```
relay/
├── README.md                 # This file
├── docker-compose.yml        # Docker services
├── strfry.conf              # Base relay config
├── strfry-router.conf       # Proxy mode config
├── strfry-db/               # Local database (gitignored)
└── scripts/
    ├── test-mode.sh         # Start in TEST mode
    └── proxy-mode.sh        # Start in PROXY mode
```

## Advanced Configuration

### Change Public Relays for Proxy Mode

Edit `strfry-router.conf` and modify the `urls` array:
```
streams {
  public-relays {
    dir = "both"
    urls = [
      "wss://your-relay.com"
      "wss://another-relay.com"
    ]
  }
}
```

### Export/Import Database

**Export:**
```bash
docker-compose exec strfry strfry export > backup.jsonl
```

**Import:**
```bash
cat backup.jsonl | docker-compose exec -T strfry strfry import
```

### View Logs
```bash
docker-compose logs -f strfry
```

## Troubleshooting

**Port 7777 already in use:**
```bash
# Find process using port
lsof -i :7777
# Kill it or change port in docker-compose.yml
```

**Database corruption:**
```bash
docker-compose down
rm -rf strfry-db/*
docker-compose up -d
```

## Technical Details

- **Relay:** strfry (C++, high-performance)
- **Database:** LMDB (embedded, no external DB needed)
- **Port:** 7777 (WebSocket)
- **Storage:** All data in `strfry-db/` directory

## License

Same as Noornote (check main repository)
