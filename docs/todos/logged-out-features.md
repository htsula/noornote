# Logged-Out Features - TODO List

Features and improvements for users who are not logged in.

---

## 1. Timeline View (TV) - Onboarding & Curated Feed

**Current State:**
Empty page with message: "Welcome to Noornote - Please log in using the button in the top right corner to access your timeline."

**Required:**

### 1.1 Onboarding & Login Interface
Comprehensive onboarding process that:
- Makes it as easy as possible to provide users with a key pair
- Guides users through the login process step by step

**Login Methods to Implement:**

#### Extension Login
- Detect installed Nostr extensions (Alby, nos2x, etc.)
- One-click login if extension found
- Show extension recommendations if none installed

#### Remote Signer (NIP-46)
- Support for Nostr Connect Protocol (NIP-46)
- Compatible with:
  - Hardware signers (Nsec Remote Nostr Signer device - £39.99 from LNbits)
  - nsecBunker
  - Amber App (Android)
  - Other NIP-46 compatible signers
- Communication via Kind 24133 (NIP-44 encrypted) over relays

#### Direct nsec Input
⚠️ **SECURITY CRITICAL:**
- **Maximum transparency required** - User must understand security implications
- Clear warnings about nsec security
- Explain risks of entering nsec directly
- Recommend extension/remote signer instead
- If user proceeds: Secure handling, never log nsec, clear from memory immediately

**Onboarding Flow:**
1. Welcome screen explaining Nostr
2. Key pair generation option (with explanation)
3. Login method selection
4. Step-by-step guidance for chosen method
5. Success confirmation and next steps

### 1.2 Curated Timeline (Below Onboarding Section)
- Display timeline from selected users (curated list to be created)
- Shows public notes without requiring login (Read Event)
- Acts as "preview" of Nostr content for new users
- Demonstrates platform value before signup

**Implementation Notes:**
- Curated user list: TBD (popular/quality content creators)
- Same TimelineUI component, different data source
- Clear visual separation between onboarding section and timeline
- Consider "Join to see more" CTA at bottom

---

## 2. Profile View - User Search

**Current State:**
Route `/profile` (without npub) returns nothing/empty state.

**Required:**
Search functionality for discovering users:
- Search users by username
- Display search results with:
  - Username
  - Profile picture
  - Short bio (if available)
  - Profile URL (`/profile/{npub}`) for navigation
- Instant search (no "Search" button needed)
- Recent/popular users suggestions
- Works without login (Read Event)

**Implementation Notes:**
- Use existing UserProfileService for profile data
- Cache search results for performance
- Consider pagination for large result sets

---

## 3. Messages View

**Current State:**
Not specified.

**Required:**
According to AUTHENTICATION GUARD ARCHITECTURE in CLAUDE.md:
- Show authentication required prompt
- Explain that messages require login
- Provide login button/link
- Redirect to onboarding flow (see #1.1)

**Rationale:**
Messages are private and require user authentication to:
- Decrypt received messages
- Send new messages (Write Event)

---

## 4. Settings View - Limited Access

**Current State:**
Full settings available.

**Required:**
When logged out, hide all settings EXCEPT Relay Settings:

### Show: Relay Settings (Read-Only Mode)
- Display aggregator relays (damus.io, snort.social, nos.lol, primal.net, nostr.band)
- **Force all relays to "Read Only"** (no Write toggle)
- Hide "Local Relay" section completely
- Show message: "Log in to configure write relays and advanced options"

### Hide When Logged Out:
- Profile Settings
- Appearance Settings
- Privacy Settings
- Cache Management
- All other non-relay settings

**Implementation Notes:**
- Check AuthService.getCurrentUser() in SettingsView
- Conditionally render sections based on login state
- Default relays defined in RelayConfig (mark as system defaults)

---

## 5. Cache View

**Current State:**
Available in Settings.

**Required:**
- Hide completely when user is logged out
- Don't show in Settings navigation
- Remove from Settings view rendering

**Rationale:**
Cache is user-specific and irrelevant without login.

---

## 6. New Post Button

**Current State:**
Shows AuthGuard modal when clicked while logged out.

**Required:**
- Redirect to Timeline View (#1 - Onboarding) when user is logged out
- Show onboarding flow instead of just auth modal
- After successful login, return to compose interface

**Flow:**
1. User clicks "New Post" while logged out
2. Redirect to `/` (Timeline View)
3. Show onboarding/login interface
4. After login: Navigate back to compose modal OR show success message

---

## Implementation Priority

**Phase 1: Essential (Blocking other features)**
1. Settings view restrictions (#4 - Hide all except Read-Only Relays)
2. Hide Cache when logged out (#5)
3. Messages view auth prompt (#3)
4. Timeline View onboarding (#1.1 - Extension login)

**Phase 2: Content Preview**
1. Curated timeline on TV (#1.2)
2. Profile search (#2)

**Phase 3: Advanced Authentication**
1. Remote Signer support (#1.1 - NIP-46)
2. Direct nsec input (#1.1 - with security warnings)
3. New Post redirect logic (#6)

---

## Security Considerations

### Direct nsec Input (HIGH RISK)
- Never store nsec in localStorage
- Never log nsec to console
- Clear from memory immediately after use
- Show multiple warnings before allowing input
- Recommend alternatives (extension/remote signer) prominently

### Remote Signer
- Secure relay communication
- NIP-44 encryption verification
- Connection timeout handling
- Clear error messages for connection issues

### Browser Extension
- Detection of legitimate extensions only
- Warning about fake/malicious extensions
- Extension permission explanations

### Default Relays (Read-Only for Logged-Out)
- Prevent accidental Write attempts without authentication
- Clear indication that Write requires login
- Default relays cannot be removed or modified when logged out

---

## Design Notes

- All logged-out interfaces should be welcoming and educational
- Avoid overwhelming users with technical Nostr terminology
- Progressive disclosure: Show complexity only when needed
- Clear visual hierarchy: Primary action (recommended method) vs alternatives
- Mobile-friendly throughout
- Curated timeline should look native, not like a "demo"

---

## Related Files

- `src/components/views/TimelineView.ts` - Current empty state, onboarding + curated feed
- `src/components/views/ProfileView.ts` - Profile display (search to be added)
- `src/components/views/SettingsView.ts` - Conditional rendering, relay restrictions
- `src/services/AuthService.ts` - Authentication handling
- `src/services/AuthGuard.ts` - Auth required prompts
- `src/services/RelayConfig.ts` - Default relays configuration
- `CLAUDE.md` - Authentication architecture rules
