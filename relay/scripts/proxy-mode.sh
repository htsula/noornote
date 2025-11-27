#!/bin/bash

##
## Start Noornote Local Relay in PROXY MODE
## - Bidirectional sync with public relays
## - Acts as local cache + backup
## - Writes are forwarded to public relays
##

echo "🌐 Starting Noornote Local Relay in PROXY MODE..."
echo ""
echo "Mode: PROXY (bidirectional sync with public relays)"
echo "Relay URL: ws://localhost:7777"
echo ""
echo "Syncing with public relays:"
echo "  - wss://relay.damus.io"
echo "  - wss://relay.primal.net"
echo "  - wss://nos.lol"
echo "  - wss://relay.nostr.band"
echo ""
echo "To connect Noornote:"
echo "1. Go to Settings → Relays"
echo "2. Add: ws://localhost:7777"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start strfry + router (proxy profile)
docker-compose --profile proxy up
