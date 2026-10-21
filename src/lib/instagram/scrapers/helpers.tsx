import { APP_NAME } from "@/constants";
import { BadRequest, TimeoutException } from "@/lib/exceptions";
import { InstagramResource } from "@/types/api/downloader";
import { getTimedFilename } from "@/utils";
import { DOMParser } from "xmldom";

export const getIGVideoFileName = (id: string) =>
  getTimedFilename(`${APP_NAME}_IG_VID_${id}`, "mp4");

export const getIGImageFileName = (id: string) =>
  getTimedFilename(`${APP_NAME}_IG_IMG_${id}`, "jpg");

export const getIGAudioFileName = (id: string) =>
  getTimedFilename(`${APP_NAME}_IG_AUD_${id}`, "mp3");

export const handleScraperError = (error: Error) => {
  console.error("Scraper error:", error.message);
  if (error.message.includes("status code 404")) {
    throw new BadRequest("This post is private or does not exist", 404);
  } else if (error instanceof TimeoutException) {
    throw new TimeoutException();
  }
};

export const parseDashManifest = ({
  manifest,
  thumbnailUrl,
}: {
  manifest: string;
  thumbnailUrl: string;
}): Array<InstagramResource> => {
  if (!manifest) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(manifest, "application/xml");
  const AdaptationSets = doc.getElementsByTagName("AdaptationSet");

  const list: InstagramResource[] = [];

  for (let i = 0; i < AdaptationSets.length; i++) {
    const adp = AdaptationSets[i];
    const rawType = adp.getAttribute("contentType");

    const reps = adp.getElementsByTagName("Representation");
    for (let j = 0; j < reps.length; j++) {
      const rep = reps[j];
      const baseURL = rep.getElementsByTagName("BaseURL")[0]?.textContent;
      if (!baseURL) continue;

      const id = rep.getAttribute("id") || crypto.randomUUID();
      const width = Number(rep.getAttribute("width")) || undefined;
      const height = Number(rep.getAttribute("height")) || undefined;
      const mimeType = rep.getAttribute("mimeType") || "video/mp4";
      const quality =
        rep.getAttribute("FBQualityLabel") ||
        rep.getAttribute("FBQualityClass") ||
        (width && height
          ? `${Math.min(width, height)}p`
          : width
            ? `${width}p`
            : "unknown");

      const isVideo =
        rawType === "video" ||
        mimeType.startsWith("video") ||
        !!(width || height);
      const isAudio =
        rawType === "audio" ||
        mimeType.startsWith("audio");

      if (isVideo) {
        list.push({
          id,
          type: "video",
          mime_type: mimeType,
          filename: getIGVideoFileName(id),
          quality,
          has_audio: false,
          width,
          height,
          baseURL,
          thumbnail: thumbnailUrl,
        });
      } else if (isAudio) {
        list.push({
          id,
          type: "audio",
          mime_type: "audio/mp3",
          filename: getIGAudioFileName(id),
          has_audio: true,
          bitrate: "128kbps",
          baseURL,
        });
      }
    }
  }

  return list.filter((i): i is InstagramResource => !!i && !!i.baseURL);
};
