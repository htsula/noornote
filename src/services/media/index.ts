/**
 * Media Upload Adapter Factory
 *
 * Returns platform-specific upload adapter:
 * - Windows: Tauri HTTP Plugin (bypasses WebView2 CORS issues)
 * - Mac/Linux: XMLHttpRequest (works fine)
 */

import type { MediaUploadAdapter } from './MediaUploadAdapter';
import { MediaUploadAdapterXHR } from './MediaUploadAdapterXHR';
import { MediaUploadAdapterTauri } from './MediaUploadAdapterTauri';

export type { MediaUploadAdapter, UploadOptions, UploadResponse } from './MediaUploadAdapter';

/**
 * Detect if running on Windows
 * Uses navigator.platform which works in both browser and Tauri WebView
 */
function isWindows(): boolean {
  // navigator.platform is deprecated but still works and is simplest solution
  // Alternatives: navigator.userAgentData.platform (not universally supported)
  return navigator.platform.toLowerCase().includes('win');
}

/**
 * Create platform-appropriate upload adapter
 *
 * To remove Windows support: delete MediaUploadAdapterTauri.ts and
 * change this to always return MediaUploadAdapterXHR
 */
export function createMediaUploadAdapter(): MediaUploadAdapter {
  if (isWindows()) {
    console.log('[MediaUpload] Using Tauri HTTP adapter (Windows)');
    return new MediaUploadAdapterTauri();
  }
  console.log('[MediaUpload] Using XHR adapter (Mac/Linux)');
  return new MediaUploadAdapterXHR();
}
