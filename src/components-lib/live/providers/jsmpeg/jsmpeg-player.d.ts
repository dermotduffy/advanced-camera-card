// The package ships no types of its own, and no DefinitelyTyped package exists.
declare module '@cycjimmy/jsmpeg-player' {
  namespace JSMpeg {
    // Options forwarded to the underlying JSMpeg player.
    // See: https://github.com/phoboslab/jsmpeg#usage
    interface PlayerOptions {
      audio?: boolean;
      audioBufferSize?: number;
      autoplay?: boolean;
      chunkSize?: number;
      disableGl?: boolean;
      disableWebAssembly?: boolean;
      maxAudioLag?: number;
      pauseWhenHidden?: boolean;
      preserveDrawingBuffer?: boolean;
      progressive?: boolean;
      protocols?: string[];
      reconnectInterval?: number;
      throttled?: boolean;
      video?: boolean;
      videoBufferSize?: number;
      onPause?: (player: Player) => void;
      onPlay?: (player: Player) => void;
      onVideoDecode?: (decoder: unknown, elapsedTime: number) => void;
    }

    // Options for the wrapper element that hosts the canvas and play button.
    interface VideoElementOptions {
      autoplay?: boolean;
      canvas?: HTMLCanvasElement;
      poster?: string;
    }

    class Player {
      paused: boolean;
      volume: number;

      play(): void;
      pause(): void;
      stop(): void;
      destroy(): void;
    }

    class VideoElement {
      constructor(
        wrapper: HTMLElement | string,
        videoUrl: string,
        videoOptions?: VideoElementOptions,
        playerOptions?: PlayerOptions,
      );

      player: Player | null;

      play(): void;
      pause(): void;
      stop(): void;
      destroy(): void;
    }
  }
  export default JSMpeg;
}
