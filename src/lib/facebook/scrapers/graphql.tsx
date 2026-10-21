import querystring from "querystring";
import { formatGraphqlVideoJson, formatGraphqlStoryJson } from "./formatters";
import { HttpRequest } from "@/utils";
import { handleScraperError } from "./helpers";
import {
  FacebookContentType,
  FacebookVideoResponse,
} from "@/types/api/downloader";
import { FB_SEMI_PRIVATE_REEL_OR_VIDEO_FETCH_API } from "@/constants";
import axios from "axios";
import { BadRequest } from "@/lib/exceptions";
import { redenv } from "@/lib/redenv";

const encodeVideoRequestData = (contentId: string) => {
  const requestData = {
    doc_id: 5279476072161634,
    variables: JSON.stringify({
      UFI2CommentsProvider_commentsKey: "CometTahoeSidePaneQuery",
      caller: "CHANNEL_VIEW_FROM_PAGE_TIMELINE",
      displayCommentsContextEnableComment: null,
      displayCommentsContextIsAdPreview: null,
      displayCommentsContextIsAggregatedShare: null,
      displayCommentsContextIsStorySet: null,
      displayCommentsFeedbackContext: null,
      feedbackSource: 41,
      feedLocation: "TAHOE",
      focusCommentID: null,
      privacySelectorRenderLocation: "COMET_STREAM",
      renderLocation: "video_channel",
      scale: 1,
      streamChainingSection: false,
      useDefaultActor: false,
      videoChainingContext: null,
      videoID: contentId,
    }),
    server_timestamps: true,
  };
  const encoded = querystring.stringify(requestData);
  return encoded;
};

const encodeStoryHighlightRequestData = (
  contentId: string,
  type: FacebookContentType,
  dtsg: string,
) => {
  // const isHighlight = type === "highlight";
  const variables = {
    blur: 10,
    bucketID: contentId,
    feedbackSource: 65,
    feedLocation: "COMET_MEDIA_VIEWER",
    focusCommentID: null,
    initialBucketID: contentId,
    initialLoad: true,
    isFbNotesIncluded: false,
    isStoriesArchive: false,
    scale: 1,
    shouldDeferLoad: false,
    shouldEnableArmadilloStoryReply: true,
    shouldEnableLiveInStories: true,
  };

  const docId = "27780046204945099";

  return querystring.stringify({
    doc_id: docId,
    variables: JSON.stringify(variables),
    fb_dtsg: dtsg,
    server_timestamps: true,
  });
};

export const fetchFromFbGraphQL = async (
  type: FacebookContentType,
  contentId: string,
  requestedUrl: string,
  timeout: number = 0,
) => {
  if (!contentId) return null;
  const env = await redenv.load();
  const API_URL = "https://www.facebook.com/api/graphql/";
  const isVideo = type === "video";

  const headers = {
    "content-type": "application/x-www-form-urlencoded",
    "accept-language": "en-US,en;q=0.8",
    accept: "*/*",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-gpc": "1",
    "user-agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-asbd-id": "359341",
    "x-fb-friendly-name": isVideo
      ? "CometTahoeSidePaneQuery"
      : "StoriesViewerBucketPrefetcherMultiBucketsQuery",
    origin: "https://www.facebook.com",
    cookie: !isVideo ? env.FB_COOKIE : null,
  };

  const encodedData =
    type === "video"
      ? encodeVideoRequestData(contentId)
      : encodeStoryHighlightRequestData(contentId, type, env.FB_DTSG_TOKEN);

  let responseJson: any = null;
  try {
    const response = await HttpRequest({
      url: API_URL,
      method: "POST",
      headers,
      data: encodedData,
      timeout,
    });
    if (response && response.statusText !== "error") {
      responseJson = response.data;
    }
  } catch (e: any) {
    handleScraperError(e);
  }

  if (type === "video") {
    let json = responseJson ? formatGraphqlVideoJson(responseJson) : null;
    // if formatedJson is null, thats mean it might be a private or semi-private video. so fetch it from the cdn
    if (json === null) {
      json = await fetchSemiPrivateVideo(requestedUrl);
    }

    // if it is still null, then throw error
    if (json === null)
      throw new BadRequest(
        "The requested post is either unavailable or has privacy restrictions.",
      );

    return json;
  } else if (type === "story" || type === "highlight") {
    if (!responseJson) return null;
    const formatedJson = formatGraphqlStoryJson(responseJson, contentId, type);

    if (!formatedJson?.owner || formatedJson?.stories?.length === 0)
      return null;
    return formatedJson;
  }
};

export const fetchSemiPrivateVideo = async (
  url: string,
  timeout: number = 5000,
): Promise<FacebookVideoResponse | null> => {
  if (!url) return null;
  try {
    const env = await redenv.load();
    const api = new URL(FB_SEMI_PRIVATE_REEL_OR_VIDEO_FETCH_API);
    const response = await axios.get(
      `${FB_SEMI_PRIVATE_REEL_OR_VIDEO_FETCH_API}${url}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          Origin: api.origin,
          Referer: api.origin,
          Accept: "*/*",
          "X-API-KEY": env.CDN_API_KEY,
          Cookie: env.FB_COOKIE,
          Host: api.host,
        },
        timeout,
      },
    );
    // it will return formated json so no need to format it again
    return response.data;
  } catch (e: any) {
    handleScraperError(e);
    return null;
  }
};
