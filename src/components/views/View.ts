/**
 * View - Base class for all application views
 *
 * Provides common lifecycle methods and enforces consistent interface
 * for all views (Timeline, Profile, SingleNote, Article, Settings)
 */

export abstract class View {
  /**
   * Get the DOM element for this view (required)
   */
  abstract getElement(): HTMLElement;

  /**
   * Destroy the view and clean up resources (required)
   */
  abstract destroy(): void;

  /**
   * Pause background tasks (optional - override if needed)
   * Called when navigating away from this view
   */
  pause(): void {
    // Default: do nothing
  }

  /**
   * Resume background tasks (optional - override if needed)
   * Called when navigating back to this view
   */
  resume(): void {
    // Default: do nothing
  }

  /**
   * Save view state before unmounting (optional - override if needed)
   * Called when navigating away from this view
   */
  saveState(): void {
    // Default: do nothing
  }

  /**
   * Restore view state after mounting (optional - override if needed)
   * Called when navigating back to this view
   */
  restoreState(): void {
    // Default: do nothing
  }
}
