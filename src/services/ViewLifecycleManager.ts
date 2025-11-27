/**
 * ViewLifecycleManager
 *
 * Manages view lifecycle (mount/unmount, pause/resume, state save/restore)
 * Removes business logic from App.ts coordination layer
 */

import type { View } from '../components/views/View';

export class ViewLifecycleManager {
  private static instance: ViewLifecycleManager;

  private constructor() {}

  public static getInstance(): ViewLifecycleManager {
    if (!ViewLifecycleManager.instance) {
      ViewLifecycleManager.instance = new ViewLifecycleManager();
    }
    return ViewLifecycleManager.instance;
  }

  /**
   * Handle view unmount - called when navigating away from a view
   */
  public onViewUnmount(view: View): void {
    view.saveState();
    view.pause();
  }

  /**
   * Handle view mount - called when navigating to a view
   */
  public onViewMount(view: View): void {
    view.restoreState();
    view.resume();
  }

  /**
   * Check if a view's element is currently mounted in the DOM
   */
  public isViewMounted(view: View, container: Element): boolean {
    return container.contains(view.getElement());
  }
}
