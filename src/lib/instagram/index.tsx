import { BadRequest } from "@/lib/exceptions";
import { fetchFromGraphQL } from "./scrapers/graphql";
import { getTranslations } from "next-intl/server";
import { redenv } from "@/lib/redenv";
import { AxiosError } from "axios";
import { IG_URL_RESOLVE_API } from "@/constants";

export const getPostId = async (url: string) => {
  const t = await getTranslations("errors");

  const postRegex =
    /^https:\/\/(?:www\.)?instagram\.com\/(?:[a-zA-Z0-9._-]+\/)?p\/([a-zA-Z0-9_-]+)\/?/;
  const reelRegex =
    /^https:\/\/(?:www\.)?instagram\.com\/(?:[a-zA-Z0-9._-]+\/)?(?:reel|reels)\/([a-zA-Z0-9_-]+)\/?/;
  const storyRegex =
    /^https:\/\/(?:www\.)?instagram\.com\/stories\/([a-zA-Z0-9._-]+)\/?/;
  const highlightRegex =
    /^https:\/\/(?:www\.)?instagram\.com\/stories\/highlights\/([0-9]+)\/?/;

  if (!url) {
    throw new BadRequest(t("invalid_url"), 400);
  }

  let postId: string | undefined;
  let type: "post" | "reel" | "story" | "highlight" | undefined;

  const postCheck = url.match(postRegex);
  const reelCheck = url.match(reelRegex);
  const highlightCheck = url.match(highlightRegex);
  const storyCheck = url.match(storyRegex);

  if (postCheck) {
    postId = postCheck.at(-1);
    type = "post";
  } else if (reelCheck) {
    postId = reelCheck.at(-1);
    type = "reel";
  } else if (highlightCheck) {
    postId = highlightCheck.at(-1);
    type = "highlight";
  } else if (storyCheck) {
    type = "story";
    const username = storyCheck[1]; // using index 1 is safer than at(-1)

    // If username is already a numeric ID
    if (/^\d+$/.test(username)) {
      postId = username;
    } else {
      const KNOWN_USERS: Record<string, string> = {
        enews: "12996727",
      };

      if (KNOWN_USERS[username]) {
        postId = KNOWN_USERS[username];
      } else {
        try {
          const { default: axios } = await import("axios");
          const env = await redenv.load();
          const res = await axios.get(
            `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
                "X-IG-App-ID": "936619743392459",
                Cookie: env.IG_COOKIE,
              },
            },
          );
          postId = res.data?.data?.user?.id || username;
        } catch (err) {
          postId = username;
        }
      }
    }
  }

  if (!postId || !type) {
    throw new BadRequest(t("invalid_url"), 400);
  }

  return { id: postId, type };
};

export const resolveInstaRedirectUrl = async (url: string) => {
  let finalUrl = url;
  const env = await redenv.load();
  const { default: axios } = await import("axios");

  try {
    const res = await axios.post(
      IG_URL_RESOLVE_API,
      { url },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": env.CDN_API_KEY,
        },
      },
    );
    finalUrl = res.data.url || url;
  } catch (err) {
    throw new BadRequest(
      ((err as AxiosError)?.response?.data as any)?.error || "Internal Error",
      400,
    );
  }

  return finalUrl;
};

export const fetchInstaContentJson = async (
  url: string,
  timeout: number = 0,
) => {
  const t = await getTranslations("errors");

  let finalUrl = url;

  const isStory = url.match(
    /^https:\/\/(?:www\.)?instagram\.com\/stories\/([a-zA-Z0-9._-]+)\/?/,
  );

  if (!isStory) {
    finalUrl = await resolveInstaRedirectUrl(url);
  }

  const { id: postId, type } = await getPostId(finalUrl);
  const apiJson = await fetchFromGraphQL(postId, finalUrl, timeout, type);
  if (apiJson) return apiJson;

  throw new BadRequest(t("private_or_not_exist"), 404);
};
