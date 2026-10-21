import { BadRequest } from "@/lib/exceptions";
import { fetchFromFbGraphQL } from "./scrapers/graphql";
import { resolveRedirectUrl } from "@/utils";
import { USER_AGENT } from "@/constants";
import { getTranslations } from "next-intl/server";
import { FacebookContentType } from "@/types/api/downloader";
import { redenv } from "../redenv";

export function extractFacebookRedirectedUrl(fullUrl: string) {
  try {
    const parsedUrl = new URL(fullUrl);
    const nextParam = parsedUrl.searchParams.get("next");

    if (nextParam) {
      const decodedNext = decodeURIComponent(nextParam);

      // Check if it's a Facebook story URL
      const isStory = /facebook\.com\/stories\/\d+/.test(decodedNext);

      if (isStory) {
        return decodedNext;
      }
    }

    return fullUrl;
  } catch (err) {
    return fullUrl;
  }
}

const facebookVideoIdStoredKeys = ["story_fbid"];

export const getContentFbId = async ({
  url,
  html,
}: {
  url: string;
  html?: string;
}): Promise<{
  type: FacebookContentType;
  contentId: string;
}> => {
  const t = await getTranslations("errors");
  const videoRegex = /\/(?:videos|reel|watch)(?:\/?)(?:\?v=)?(\d+)/;
  const storyRegex = /stories\/(\d+)/;
  const postRegex = /\/posts\/(pfbid[^/?]+)/i;

  let contentId: any;

  if (!url) {
    throw new BadRequest(t("invalid_url"), 400);
  }

  // Check for post URLs first
  const postCheck = url.match(postRegex);
  if (postCheck) throw new BadRequest(t("facebook_not_supported_content"), 400);

  // video handler
  const videoCheck = url.match(videoRegex);
  if (videoCheck) {
    contentId = videoCheck.at(-1);
    return {
      type: "video",
      contentId,
    };
  }

  // story handler
  const storyCheck = url.match(storyRegex);
  if (storyCheck) {
    contentId = storyCheck.at(-1);
    if (
      url.includes("source=profile_highlight") ||
      (html && html.includes("StoryHighlightContainer"))
    ) {
      return {
        type: "highlight",
        contentId,
      };
    }
    return {
      type: "story",
      contentId,
    };
  }

  // group content handler
  if (html) {
    const match = html.match(/"permalink_url":"([^"]+)"/);
    if (match) {
      const permalink = decodeURIComponent(
        match[1].replace(/\\u0025/g, "%"),
      ).replace(/\\/g, "");
      return getContentFbId({ url: permalink });
    }
  }

  // special case for video
  for (const key of facebookVideoIdStoredKeys) {
    const newUrl = new URL(url);
    const match = newUrl.searchParams.get(key);

    if (match) {
      return {
        type: "video",
        contentId: match,
      };
    }

    const nextUrl = newUrl.searchParams.get("next");
    if (nextUrl) {
      return getContentFbId({
        url: decodeURIComponent(nextUrl),
      });
    }
  }

  throw new BadRequest(t("private_or_not_exist"), 404);
};

export const fetchFBContentJson = async (
  url: string,
  timeout: number = 5000,
) => {
  const env = await redenv.load();
  const t = await getTranslations("errors");
  try {
    const commonHeaders = {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.8",
      Host: "www.facebook.com",
      referrer: "https://www.facebook.com/",
    };

    // Try resolving WITHOUT a cookie first (avoids checkpoints for public share URLs)
    let { url: resolvedUrl, html } = await resolveRedirectUrl({
      url,
      headers: commonHeaders,
    });

    // If it hits a login wall/checkpoint, and we have a cookie, retry WITH the cookie (for private videos)
    if (
      env.FB_COOKIE &&
      (resolvedUrl.includes("/login") || resolvedUrl.includes("/checkpoint"))
    ) {
      const withCookieRes = await resolveRedirectUrl({
        url,
        headers: { ...commonHeaders, cookie: env.FB_COOKIE },
      });
      resolvedUrl = withCookieRes.url;
      html = withCookieRes.html;
    }

    const orgUrl = extractFacebookRedirectedUrl(resolvedUrl);
    const urlDet = await getContentFbId({ url: orgUrl, html });

    const contentJson = await fetchFromFbGraphQL(
      urlDet.type,
      urlDet.contentId,
      orgUrl,
      timeout,
    );

    if (contentJson) return contentJson;

    throw new BadRequest(t("private_or_not_exist"), 404);
  } catch (error: any) {
    throw new BadRequest(error.message || t("an_error_occurred"));
  }
};
