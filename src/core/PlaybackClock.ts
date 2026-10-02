export interface PlaybackClockSnapshot {
  mediaTime: number;
  sidecarTime: number;
  drift: number;
}

export class PlaybackClock {
  constructor(private readonly timeOffsetSeconds = 0) {}

  snapshot(mediaTime: number, sidecarTime: number): PlaybackClockSnapshot {
    const expectedSidecarTime = mediaTime + this.timeOffsetSeconds;
    return {
      mediaTime,
      sidecarTime,
      drift: sidecarTime - expectedSidecarTime
    };
  }

  shouldResync(mediaTime: number, sidecarTime: number, toleranceSeconds = 0.08): boolean {
    return Math.abs(this.snapshot(mediaTime, sidecarTime).drift) > toleranceSeconds;
  }

  targetSidecarTime(mediaTime: number): number {
    return Math.max(0, mediaTime + this.timeOffsetSeconds);
  }
}
