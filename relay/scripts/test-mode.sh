#!/bin/bash

##
## Start Noornote Local Relay in TEST MODE
## - Completely isolated from public Nostr network
## - All writes stay local only
## - Perfect for development and testing
##

echo "🧪 Starting Noornote Local Relay in TEST MODE..."
echo ""
echo "Mode: ISOLATED (no sync with public relays)"
echo "Relay URL: ws://localhost:7777"
echo ""
echo "To connect Noornote:"
echo "1. Go to Settings → Relays"
echo "2. Add: ws://localhost:7777"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start only strfry (no router)
docker-compose up strfry
