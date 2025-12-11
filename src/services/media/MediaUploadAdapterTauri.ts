/**
 * MediaUploadAdapterTauri - Tauri HTTP Plugin-based upload for Windows
 *
 * Windows WebView2 has CORS issues with XMLHttpRequest to external domains.
 * This adapter uses Tauri's HTTP plugin which makes requests from the Rust
 * backend, bypassing CORS entirely.
 *
 * Note: No real progress tracking available - uses pseudo-progress.
 */

import { fetch } from '@tauri-apps/plugin-http';
import type { MediaUploadAdapter, UploadOptions, UploadResponse } from './MediaUploadAdapter';

export class MediaUploadAdapterTauri implements MediaUploadAdapter {
  private abortController: AbortController | null = null;
  private progressInterval: ReturnType<typeof setInterval> | null = null;

  public async upload(options: UploadOptions): Promise<UploadResponse> {
    const { url, method, headers, body, onProgress } = options;

    this.abortController = new AbortController();

    // Start pseudo-progress (Tauri HTTP has no progress events)
    let pseudoProgress = 0;
    if (onProgress) {
      this.progressInterval = setInterval(() => {
        pseudoProgress = Math.min(pseudoProgress + 5, 90);
        onProgress(pseudoProgress);
      }, 200);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body instanceof Blob ? await body.arrayBuffer() : body,
        signal: this.abortController.signal
      });

      // Stop pseudo-progress
      this.clearProgressInterval();
      onProgress?.(100);

      const responseText = await response.text();

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        text: async () => responseText,
        json: async () => JSON.parse(responseText)
      };
    } catch (error) {
      this.clearProgressInterval();

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Upload cancelled');
      }

      throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.abortController = null;
    }
  }

  public abort(): void {
    this.clearProgressInterval();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private clearProgressInterval(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
}
