import { z } from "zod";
import {
  PHOTO_LIMIT_MAX,
  PHOTO_LIMIT_MIN,
  VIDEO_LIMIT_MAX,
  VIDEO_LIMIT_MIN,
  VIDEO_SIZE_MAX_MB,
  VIDEO_SIZE_MIN_MB,
} from "./photo-limit-types";

function photoLimit(label: string) {
  return z
    .number()
    .int(`${label} harus bilangan bulat.`)
    .min(PHOTO_LIMIT_MIN, `${label} minimal ${PHOTO_LIMIT_MIN} foto.`)
    .max(PHOTO_LIMIT_MAX, `${label} maksimal ${PHOTO_LIMIT_MAX} foto.`);
}

function videoLimit(label: string) {
  return z
    .number()
    .int(`${label} harus bilangan bulat.`)
    .min(VIDEO_LIMIT_MIN, `${label} minimal ${VIDEO_LIMIT_MIN} video.`)
    .max(VIDEO_LIMIT_MAX, `${label} maksimal ${VIDEO_LIMIT_MAX} video.`);
}

export const photoLimitsSchema = z.object({
  checklistPhotos: photoLimit("Batas foto checklist"),
  workPhotos: photoLimit("Batas foto pekerjaan"),
  spklPhotos: photoLimit("Batas dokumentasi SPKL"),
  videoEnabled: z.boolean(),
  maxVideoMb: z
    .number()
    .int("Ukuran video maksimal harus bilangan bulat.")
    .min(VIDEO_SIZE_MIN_MB, `Ukuran video minimal ${VIDEO_SIZE_MIN_MB} MB.`)
    .max(VIDEO_SIZE_MAX_MB, `Ukuran video maksimal ${VIDEO_SIZE_MAX_MB} MB.`),
  spklVideos: videoLimit("Batas video SPKL"),
  checklistVideos: videoLimit("Batas video checklist"),
  workVideos: videoLimit("Batas video pekerjaan"),
});

export type PhotoLimitsInput = z.infer<typeof photoLimitsSchema>;
