import { BadRequest } from "@/lib/exceptions";
import {
  getIGVideoFileName,
  getIGImageFileName,
  getIGAudioFileName,
  parseDashManifest,
} from "./helpers";
import { _generateRandomId } from "@/lib/facebook/scrapers/formatters";
import { DOMParser } from "xmldom";
import {
  InstagramContentType,
  InstagramResource,
  InstagramResponse,
  InstagramStoryResponse,
  Owner,
} from "@/types/api/downloader";
import fs from "fs";

export const formatGraphqlJson = (json: any, type: InstagramContentType) => {
  if (type === "post" || type === "reel") {
    if (json?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0]) {
      return formatWebInfoMedia(
        json.data.xdt_api__v1__media__shortcode__web_info.items[0]
      );
    }
    return postAndReelFormatter(json);
  }

  if (type === "highlight") return highlightFormatter(json);

  if (type === "story") return storyFormatter(json);
  
  if (json?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0]) {
    return formatWebInfoMedia(
      json.data.xdt_api__v1__media__shortcode__web_info.items[0]
    );
  }

  return postAndReelFormatter(json);
};

export const formatWebInfoMedia = (data: any): InstagramResponse | null => {
  if (!data) return null;

  const thumbnail =
    data.image_versions2?.candidates?.[0]?.url ||
    data.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url;

  const owner: Owner = {
    id: String(data.user?.id || data.user?.pk || ""),
    name: data.user?.full_name || data.user?.username || "",
    username: data.user?.username || "",
    profile_pic: data.user?.profile_pic_url || "",
    profile_url: `https://www.instagram.com/${data.user?.username}/`,
  };

  const isCarousel = !!(data.carousel_media && data.carousel_media.length > 0);
  const isVideo = !!(data.video_versions && data.video_versions.length > 0);

  if (isCarousel) {
    const resources: InstagramResource[] = data.carousel_media.map(
      (child: any, idx: number) => {
        const childIsVideo = !!(
          child.video_versions && child.video_versions.length > 0
        );
        const childThumb =
          child.image_versions2?.candidates?.[0]?.url || thumbnail;
        const id = String(child.id || child.pk || `${data.id}_${idx}`);

        const resource: InstagramResource = {
          id,
          filename: childIsVideo
            ? getIGVideoFileName(id)
            : getIGImageFileName(id),
          type: childIsVideo ? "video" : "image",
          mime_type: childIsVideo ? "video/mp4" : "image/jpeg",
          has_audio: childIsVideo,
          width: childIsVideo
            ? child.video_versions?.[0]?.width
            : child.image_versions2?.candidates?.[0]?.width,
          height: childIsVideo
            ? child.video_versions?.[0]?.height
            : child.image_versions2?.candidates?.[0]?.height,
          baseURL: childIsVideo ? child.video_versions?.[0]?.url : childThumb,
          thumbnail: childThumb,
        };

        if (childIsVideo) {
          resource.quality = "720p";
        }

        return resource;
      }
    );

    return {
      id: String(data.id || data.pk),
      owner,
      type: "post",
      thumbnail,
      resources,
    };
  }

  if (isVideo) {
    const id = String(data.id || data.pk);
    const videoUrl = data.video_versions?.[0]?.url;
    const width = data.video_versions?.[0]?.width;
    const height = data.video_versions?.[0]?.height;

    const videoJson: InstagramResponse = {
      id,
      owner,
      thumbnail,
      type: "reel",
      resources: [
        {
          id,
          filename: getIGVideoFileName(id),
          type: "video",
          mime_type: "video/mp4",
          quality: "720p",
          has_audio: true,
          width,
          height,
          baseURL: videoUrl,
          thumbnail,
        },
      ],
    };

    if (data.video_dash_manifest) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(
        data.video_dash_manifest,
        "application/xml"
      );
      const AdaptationSet = doc.getElementsByTagName("AdaptationSet");

      for (let i = 0; i < AdaptationSet.length; i++) {
        const adp = AdaptationSet[i];
        const rep = adp.getElementsByTagName("Representation");

        for (let j = 0; j < rep.length; j++) {
          const baseURL =
            rep[j].getElementsByTagName("BaseURL")[0]?.textContent;
          if (!baseURL) continue;

          const repWidth = rep[j].getAttribute("width");
          const repHeight = rep[j].getAttribute("height");
          const mimeType = rep[j].getAttribute("mimeType");
          const quality =
            rep[j].getAttribute("FBQualityLabel") ||
            rep[j].getAttribute("FBQualityClass") ||
            `${repWidth}p`;
          const repType = adp.getAttribute("contentType");

          if (repType === "video") {
            videoJson.resources.push({
              id: `${rep[j].getAttribute("id")}`,
              mime_type: mimeType || "video/mp4",
              filename: getIGVideoFileName(rep[j].getAttribute("id") || ""),
              type: "video",
              quality,
              has_audio: false,
              width: Number(repWidth),
              height: Number(repHeight),
              baseURL,
              thumbnail,
            });
          } else if (repType === "audio") {
            videoJson.resources.push({
              id: `${rep[j].getAttribute("id")}`,
              mime_type: "audio/mp3",
              filename: getIGAudioFileName(rep[j].getAttribute("id") || ""),
              has_audio: true,
              type: "audio",
              bitrate: "128kbps",
              baseURL,
            });
          }
        }
      }
    }

    return videoJson;
  }

  // Single Image Post
  const id = String(data.id || data.pk);
  const imgUrl = data.image_versions2?.candidates?.[0]?.url;

  return {
    id,
    owner,
    thumbnail: imgUrl,
    type: "post",
    resources: [
      {
        id,
        filename: getIGImageFileName(id),
        type: "image",
        mime_type: "image/jpeg",
        has_audio: false,
        width: data.image_versions2?.candidates?.[0]?.width,
        height: data.image_versions2?.candidates?.[0]?.height,
        baseURL: imgUrl,
        thumbnail: imgUrl,
      },
    ],
  };
};

/**
 * @private
 */
const postAndReelFormatter = (json: any) => {
  const data = json.data.xdt_shortcode_media;

  if (!data) {
    return null;
  }

  const owner = data.owner;
  owner.profile_pic = owner.profile_pic_url;
  owner.name = owner.full_name;
  owner.profile_url = `https://www.instagram.com/${owner.username}/`;

  const keysToRemove = [
    "is_verified",
    "is_private",
    "blocked_by_viewer",
    "followed_by_viewer",
    "restricted_by_viewer",
    "followed_by_viewer",
    "has_blocked_viewer",
    "is_embeds_disabled",
    "is_unpublished",
    "requested_by_viewer",
    "pass_tiering_recommendation",
    "edge_owner_to_timeline_media",
    "edge_followed_by",
    "profile_pic_url",
    "full_name",
  ];

  keysToRemove.forEach((key) => {
    if (key in owner) delete owner[key];
  });

  if (!data.is_video) {
    const childrenEdges =
      data.edge_sidecar_to_children?.edges || [
        {
          node: {
            id: _generateRandomId(),
            width: data.display_resources.at(-1).config_width,
            height: data.display_resources.at(-1).config_height,
          },
        },
      ] ||
      [];

    const PostJson: InstagramResponse = {
      id: data.id,
      type: "post",
      owner: owner,
      thumbnail: data.thumbnail_src,
      resources: [
        ...childrenEdges.map((edge: any) => {
          const resource: InstagramResource = {
            id: edge.node.id,
            filename: edge.node.is_video
              ? getIGVideoFileName(edge.node.id)
              : getIGImageFileName(edge.node.id),
            type: edge.node.is_video ? "video" : "image",
            mime_type: edge.node.is_video ? "video/mp4" : "image/jpeg",
            has_audio: edge.node.is_video ? edge.node.has_audio : false,
            width: edge.node?.dimensions?.width || edge.node.width,
            height: edge.node?.dimensions?.height || edge.node.height,
            baseURL: edge.node.is_video
              ? edge.node.video_url
              : edge.node.display_url,
            thumbnail: edge.node.display_url,
          };

          if (edge.node.is_video) resource.quality = "720p";

          return resource;
        }),
      ],
    };
    return PostJson;
  }

  const filename = getIGVideoFileName(data.id);
  const videoUrl = data.video_url;
  const { width, height } = data.dimensions;
  const thumbnailUrl = data.thumbnail_src;

  if (!videoUrl || !thumbnailUrl) {
    return null;
  }

  const videoJson: InstagramResponse = {
    id: data.id,
    thumbnail: thumbnailUrl,
    owner: owner,
    type: "reel",
    resources: [
      {
        id: data.id,
        filename: filename,
        type: "video",
        mime_type: "video/mp4",
        quality: "720p",
        has_audio: true,
        width: width,
        height: height,
        baseURL: videoUrl,
        thumbnail: thumbnailUrl,
      },
    ],
  };

  if (data.dash_info?.video_dash_manifest) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      data.dash_info.video_dash_manifest,
      "application/xml"
    );
    const AdaptationSet = doc.getElementsByTagName("AdaptationSet");

    for (let i = 0; i < AdaptationSet.length; i++) {
      const adp = AdaptationSet[i];
      const rep = adp.getElementsByTagName("Representation");

      for (let j = 0; j < rep.length; j++) {
        const baseURL = rep[j].getElementsByTagName("BaseURL")[0]?.textContent;
        if (!baseURL) continue;

        const width = rep[j].getAttribute("width");
        const height = rep[j].getAttribute("height");
        const mimeType = rep[j].getAttribute("mimeType");
        const quality =
          rep[j].getAttribute("FBQualityLabel") ||
          rep[j].getAttribute("FBQualityClass") ||
          `${width}p`;
        const type = adp.getAttribute("contentType");

        if (type === "video") {
          videoJson.resources.push({
            id: `${rep[j].getAttribute("id")}`,
            mime_type: mimeType || "video/mp4",
            filename: getIGVideoFileName(rep[j].getAttribute("id") || ""),
            type: "video",
            quality: quality,
            has_audio: false,
            width: Number(width),
            height: Number(height),
            baseURL: baseURL,
            thumbnail: thumbnailUrl,
          });
        } else if (type === "audio") {
          videoJson.resources.push({
            id: `${rep[j].getAttribute("id")}`,
            mime_type: "audio/mp3",
            filename: getIGAudioFileName(rep[j].getAttribute("id") || ""),
            has_audio: true,
            type: "audio",
            bitrate: "128kbps",
            baseURL: baseURL,
          });
        }
      }
    }
  }

  return videoJson;
};

/**
 * @private
 */
const storyFormatter = (json: any): InstagramStoryResponse | null => {
  if (!json?.data) return null;

  // Support both reels_media array structure and legacy connection edges
  const data =
    json?.data?.xdt_api__v1__feed__reels_media?.reels_media?.[0] ||
    json?.data?.xdt_api__v1__feed__reels_media__connection?.edges?.[0]?.node ||
    json?.data?.xdt_api__v1__feed__reels_media?.edges?.[0]?.node;

  if (!data) {
    return null;
  }

  const user = data.user || {};
  const owner: Owner = {
    id: String(user.id || user.pk || data.id || ""),
    name: user.full_name || user.username || "",
    username: user.username || "",
    profile_pic: user.profile_pic_url || user.profile_pic || "",
    profile_url: user.username
      ? `https://www.instagram.com/${user.username}/`
      : "",
  };

  const firstCandidate =
    data.items?.[0]?.image_versions2?.candidates?.[0]?.url || null;

  const contentInfo: InstagramStoryResponse = {
    id: String(data.id || owner.id),
    owner,
    type: "story",
    thumbnail: firstCandidate,
    stories: [],
  };

  const items = Array.isArray(data.items) ? data.items : [];

  for (const item of items) {
    const imageVersions = item?.image_versions2?.candidates;

    // Pick best image candidate by largest resolution area (width * height)
    const bestImageCandidate =
      Array.isArray(imageVersions) && imageVersions.length > 0
        ? imageVersions.reduce((best: any, cand: any) => {
            const bestArea = (best?.width ?? 0) * (best?.height ?? 0);
            const candArea = (cand?.width ?? 0) * (cand?.height ?? 0);
            return candArea > bestArea ? cand : best;
          }, imageVersions[0])
        : null;

    const bestImageUrl: string | null = bestImageCandidate?.url ?? null;
    const isVideo =
      item?.media_type === 2 ||
      !!(item?.video_versions && item.video_versions.length > 0) ||
      !!item?.video_dash_manifest;

    const resources: InstagramResource[] = [];

    // Image Resource (High quality poster / still photo)
    if (bestImageUrl) {
      resources.push({
        id: _generateRandomId(),
        filename: getIGImageFileName(
          `${item?.id || item?.pk}_${bestImageCandidate?.width}x${bestImageCandidate?.height}`
        ),
        type: "image",
        mime_type: "image/jpg",
        has_audio: false,
        width: bestImageCandidate?.width,
        height: bestImageCandidate?.height,
        baseURL: bestImageUrl,
        thumbnail: bestImageUrl,
      });
    }

    // Standard Progressive MP4 Video (if video)
    const standardVideo = item?.video_versions?.[0]?.url;
    if (standardVideo) {
      const vidWidth = item?.original_width || item?.video_versions?.[0]?.width;
      const vidHeight =
        item?.original_height || item?.video_versions?.[0]?.height;
      resources.push({
        id: _generateRandomId(),
        filename: getIGVideoFileName(
          `${item?.id || item?.pk}_${vidWidth}x${vidHeight}`
        ),
        type: "video",
        mime_type: "video/mp4",
        quality: vidWidth ? `${vidWidth}p` : "720p",
        has_audio: item?.has_audio !== false,
        width: vidWidth,
        height: vidHeight,
        baseURL: standardVideo,
        thumbnail: bestImageUrl || "",
      });
    }

    // DASH Manifest Representations (1080p, 720p, 540p, 360p, and Audio)
    if (item?.video_dash_manifest) {
      const dashResources = parseDashManifest({
        manifest: item.video_dash_manifest,
        thumbnailUrl: bestImageUrl || "",
      });
      resources.push(...dashResources);
    }

    contentInfo.stories.push({
      id: String(item.id || item.pk),
      type: isVideo ? "video" : "image",
      resources,
      thumbnail: bestImageUrl || "",
    });
  }

  return contentInfo;
}

/**
 * @private
 */
const highlightFormatter = (json: any) => {
  const data =
    json?.data?.xdt_api__v1__feed__reels_media__connection?.edges?.[0]?.node

    if (!data) {
    return null;
  }
  const owner = data?.user;
  owner.profile_pic = owner?.profile_pic_url;
  owner.name = owner?.full_name;
  owner.profile_url = `https://www.instagram.com/${owner?.username}/`;

  const keysToRemove = [
    "is_verified",
    "is_private",
    "blocked_by_viewer",
    "followed_by_viewer",
    "restricted_by_viewer",
    "followed_by_viewer",
    "has_blocked_viewer",
    "is_embeds_disabled",
    "is_unpublished",
    "requested_by_viewer",
    "pass_tiering_recommendation",
    "edge_owner_to_timeline_media",
    "edge_followed_by",
    "profile_pic_url",
    "full_name",
  ];

  keysToRemove.forEach((key) => {
    if (key in owner) delete owner[key];
  });

  const contentInfo: InstagramStoryResponse = {
    id: data.id,
    owner: owner,
    type: "story",
    stories: [],
  };

  data.items.forEach((item: any) => {
    const imageVersions = item?.image_versions2?.candidates;
    // Pick the best image candidate by largest area (width * height)
    const bestImageCandidate =
      Array.isArray(imageVersions) && imageVersions.length > 0
        ? imageVersions.reduce((best: any, cand: any) => {
            const bestArea = (best?.width ?? 0) * (best?.height ?? 0);
            const candArea = (cand?.width ?? 0) * (cand?.height ?? 0);
            return candArea > bestArea ? cand : best;
          }, imageVersions[0])
        : null;
    const bestImageUrl: string | null = bestImageCandidate?.url ?? null;

    const standardVideo = item?.video_versions?.[0]?.url;

    const resources: InstagramResource[] = [];

    if (bestImageUrl) {
      resources.push({
        id: _generateRandomId(),
        filename: getIGImageFileName(
          `${item?.id}_${bestImageCandidate?.width}x${bestImageCandidate?.height}`
        ),
        type: "image",
        mime_type: "image/jpg",
        has_audio: false,
        width: bestImageCandidate?.width,
        height: bestImageCandidate?.height,
        baseURL: bestImageUrl,
      });
    }

    if (standardVideo) {
      resources.push({
        id: _generateRandomId(),
        filename: getIGVideoFileName(
          `${item?.id}_${item?.original_width}x${item?.original_height}`
        ),
        type: "video",
        mime_type: "video/mp4",
        quality: `${item?.original_width}p`,
        has_audio: true,
        width: item?.original_width,
        height: item?.original_height,
        baseURL: standardVideo,
      });
    }

    resources.push(
      ...parseDashManifest({
        manifest: item?.video_dash_manifest,
        thumbnailUrl: bestImageUrl || "",
      })
    );

    contentInfo.stories.push({
      id: item.id,
      type: "video",
      resources,
      thumbnail: bestImageUrl || "",
    });
  });
  
  return contentInfo;
};
