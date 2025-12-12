/**
 * VideoPlayerService
 * Initializes Plyr video players for note videos
 */

import Plyr from 'plyr';

export class VideoPlayerService {
  private static instance: VideoPlayerService | null = null;
  private players: Map<HTMLVideoElement, Plyr> = new Map();

  private constructor() {}

  public static getInstance(): VideoPlayerService {
    if (!VideoPlayerService.instance) {
      VideoPlayerService.instance = new VideoPlayerService();
    }
    return VideoPlayerService.instance;
  }

  /**
   * Initialize Plyr for all videos in a container
   */
  public initializeForContainer(container: HTMLElement): void {
    const videos = container.querySelectorAll<HTMLVideoElement>('video.note-video');
    videos.forEach(video => {
      if (this.players.has(video)) return; // Already initialized

      const player = new Plyr(video, {
        controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
        hideControls: true,
        resetOnEnd: true
      });

      this.players.set(video, player);
    });
  }

  /**
   * Cleanup Plyr instances for a container
   */
  public cleanupForContainer(container: HTMLElement): void {
    const videos = container.querySelectorAll<HTMLVideoElement>('video.note-video');
    videos.forEach(video => {
      const player = this.players.get(video);
      if (player) {
        player.destroy();
        this.players.delete(video);
      }
    });
  }
}

export function getVideoPlayerService(): VideoPlayerService {
  return VideoPlayerService.getInstance();
}
