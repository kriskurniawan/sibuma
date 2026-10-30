/** Batas jumlah dan ukuran dokumentasi yang dapat diubah super admin. */
export const PHOTO_LIMIT_MIN = 1;
export const PHOTO_LIMIT_MAX = 50;

export const VIDEO_LIMIT_MIN = 0;
export const VIDEO_LIMIT_MAX = 20;

export const VIDEO_SIZE_MIN_MB = 1;
export const VIDEO_SIZE_MAX_MB = 100;

export const DEFAULT_PHOTO_LIMITS = {
  checklistPhotos: 6,
  workPhotos: 6,
  spklPhotos: 12,
  videoEnabled: true,
  maxVideoBytes: 50 * 1024 * 1024,
  spklVideos: 3,
  checklistVideos: 2,
  workVideos: 2,
} as const;

export interface PhotoLimits {
  checklistPhotos: number;
  workPhotos: number;
  spklPhotos: number;
  videoEnabled: boolean;
  maxVideoBytes: number;
  spklVideos: number;
  checklistVideos: number;
  workVideos: number;
  updatedAt: string;
  updatedBy: string | null;
}
