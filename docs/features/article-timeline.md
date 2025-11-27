# Article Timeline Feature

## Ziel
Separate Timeline nur für Long-form Artikel (kind 30023), chronologisch sortiert mit LoadMore.
Komplett eigenständiges Feature mit eigenen Code-Dateien, leicht abschaltbar.

## Neue Dateien

### Services
- `src/services/orchestration/ArticleFeedOrchestrator.ts` ✅
  - Fetcht kind 30023 Events
  - Pagination mit until/limit
  - Deduplizierung nach pubkey+d-tag

### Components
- `src/components/article/ArticleTimeline.ts`
  - Schlanke Timeline-Komponente
  - Nutzt ArticleFeedOrchestrator
  - Rendert Artikel-Cards mit Bild, Title, Summary, Author
  - InfiniteScroll für LoadMore

- `src/components/views/ArticleTimelineView.ts`
  - View-Wrapper für ArticleTimeline
  - Header mit Titel

### Styles
- `src/styles/components/_article-timeline.scss`
  - Artikel-Card Styling
  - Timeline Layout

## Änderungen an bestehenden Dateien
- `src/App.ts` - Route `/articles` + case 'articles'
- `src/components/layout/MainLayout.ts` - Sidebar Link "Articles"
- `src/styles/main.scss` - Import article-timeline

## Feature abschalten
Um das Feature zu deaktivieren:
1. Route in App.ts entfernen
2. Sidebar-Link in MainLayout.ts entfernen
3. SCSS Import entfernen (optional)

Die Dateien können bleiben, werden dann einfach nicht geladen.

## Implementation Order
1. ✅ ArticleFeedOrchestrator
2. ✅ ArticleTimeline Component
3. ✅ ArticleTimelineView
4. ✅ Route + Sidebar Entry
5. ✅ SCSS Styles

## Status: COMPLETE
All files created. Feature ready for testing.
