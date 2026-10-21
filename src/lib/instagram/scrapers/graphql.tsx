import querystring from "querystring";

import { HttpRequest } from "@/utils";
import { handleScraperError } from "./helpers";
import { formatGraphqlJson, formatWebInfoMedia } from "./formatters";
import { IG_SEMI_PRIVATE_REEL_FETCH_API } from "@/constants";
import {
  InstagramResponse,
  InstagramContentType,
} from "@/types/api/downloader";
import axios from "axios";
import { BadRequest } from "@/lib/exceptions";
import { redenv } from "@/lib/redenv";

const encodePostRequestData = (postId: string, type: InstagramContentType) => {
  const isPostOrReel = ["post", "reel"].includes(type);
  const docId = isPostOrReel ? "27128499623469141" : "31842794902034649";
  const variables = isPostOrReel
    ? {
        shortcode: postId,
        "__relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider": false,
      }
    : type === "story"
      ? {
          initial_reel_id: postId,
          reel_ids: [postId],
          first: 1,
        }
      : {
          initial_reel_id: `highlight:${postId}`,
          reel_ids: [`highlight:${postId}`],
          first: 1,
        };

  const requestData = isPostOrReel
    ? {
        doc_id: docId,
        variables: JSON.stringify(variables),
      }
    : {
        av: "17854477105113577",
        __d: "www",
        __user: 0,
        __a: 1,
        __req: "b",
        __hs: "20747.HYP:instagram_web_pkg.2.1...0",
        dpr: 1,
        __ccg: "GOOD",
        __rev: 1051144468,
        __s: "gx238d:cul40h:zbuf8d",
        __hsi: "7658983823372492036",
        __comet_req: 7,
        fb_dtsg:
          "NAfw4GdtVXaJHlGgOGWtV9hdVXsdlqvY6nX_qD8qruYlTeoC48_Andw:17854477105113577:1792596994",
        jazoest: 26332,
        lsd: "Hi-Ku9fJhgO0Onw-dvdGaM",
        __spin_r: 1051144468,
        __spin_b: "trunk",
        __spin_t: 1792596994,
        __crn: "comet.igweb.PolarisClipsTabDesktopProfiledContentRoute",
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "PolarisPostActionLoadPostQueryQuery",
        server_timestamps: true,
        variables: JSON.stringify(variables),
        doc_id: docId,
      };

  const encoded = querystring.stringify(requestData);
  return encoded;
};

export const fetchFromGraphQL = async (
  postId: string,
  requestedUrl: string,
  timeout: number = 0,
  type: InstagramContentType,
) => {
  if (!postId) return null;
  const env = await redenv.load();

  const API_URL = "https://www.instagram.com/graphql/query";

  const csrfMatch = env.IG_COOKIE?.match(/csrftoken=([^;]+)/);
  const csrf = csrfMatch ? csrfMatch[1] : "G7hFiIknIPZGjEy26ig58NYV2F6D6D8E";

  const isPostOrReel = ["post", "reel"].includes(type);

  const headers: Record<string, string> = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.5",
    "Content-Type": "application/x-www-form-urlencoded",
    "X-FB-Friendly-Name": isPostOrReel
      ? "PolarisPostRootQuery"
      : "PolarisPostActionLoadPostQueryQuery",
    "X-CSRFToken": csrf,
    "X-IG-App-ID": "936619743392459",
    "X-FB-LSD": "Hi-Ku9fJhgO0Onw-dvdGaM",
    "X-ASBD-ID": "359341",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    cookie: env.IG_COOKIE || `csrftoken=${csrf};`,
  };

  const encodedData = encodePostRequestData(postId, type);

  let json: any = null;

  try {
    const response = await HttpRequest({
      url: API_URL,
      method: "POST",
      headers,
      data: encodedData,
      timeout,
    });

    if (response && response.statusText !== "error") {
      if (response.data?.data) {
        json = formatGraphqlJson(response.data, type);
      } else if (typeof response.data === "string") {
        json = extractWebInfoFromHtml(response.data);
      }
    }
  } catch (e) {
    console.error("Instagram GraphQL scraper error:", (e as Error).message);
  }

  // Fallback 1: Web Info HTML parser directly for post/reel
  if (!json && (type === "reel" || type === "post")) {
    try {
      json = await fetchFromWebInfoHtml(postId, type, timeout || 8000);
    } catch (e) {
      console.error("fetchFromWebInfoHtml fallback error:", (e as Error).message);
    }
  }

  // Fallback 2: If GraphQL and Web Info failed, fallback to CDN parser
  if (!json && (type === "reel" || type === "post")) {
    try {
      const cdnJson = await fetchIGSemiPrivateReel(requestedUrl, timeout);
      if (cdnJson && cdnJson.resources?.[0]?.baseURL) {
        json = cdnJson;
        json.type = type;
      }
    } catch (e) {
      console.error("IG semi-private reel fallback error:", (e as Error).message);
    }
  }

  return json;
};

export const extractWebInfoFromHtml = (
  html: string,
): InstagramResponse | null => {
  if (!html || typeof html !== "string") return null;
  const scripts = [
    ...html.matchAll(
      /<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ];
  for (const s of scripts) {
    if (s[1].includes("xdt_api__v1__media__shortcode__web_info")) {
      try {
        const parsed = JSON.parse(s[1]);
        const findKey = (obj: any): any => {
          if (!obj || typeof obj !== "object") return null;
          if (obj.xdt_api__v1__media__shortcode__web_info)
            return obj.xdt_api__v1__media__shortcode__web_info;
          for (const k of Object.keys(obj)) {
            const r = findKey(obj[k]);
            if (r) return r;
          }
          return null;
        };
        const webInfo = findKey(parsed);
        if (webInfo?.items?.[0]) {
          return formatWebInfoMedia(webInfo.items[0]);
        }
      } catch {}
    }
  }
  return null;
};

export const fetchFromWebInfoHtml = async (
  postId: string,
  type: InstagramContentType,
  timeout: number = 8000,
): Promise<InstagramResponse | null> => {
  if (!postId) return null;
  try {
    const env = await redenv.load();
    const url =
      type === "reel"
        ? `https://www.instagram.com/reel/${postId}/`
        : `https://www.instagram.com/p/${postId}/`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "sec-ch-ua":
          '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Linux"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        Cookie: env.IG_COOKIE,
      },
      signal: timeout > 0 ? AbortSignal.timeout(timeout) : undefined,
    });
    const html = await res.text();
    return extractWebInfoFromHtml(html);
  } catch (err: any) {
    console.error("fetchFromWebInfoHtml error:", err?.message);
    return null;
  }
};

export const fetchIGSemiPrivateReel = async (
  url: string,
  timeout: number = 5000,
): Promise<InstagramResponse | null> => {
  if (!url) return null;
  try {
    const env = await redenv.load();
    const api = new URL(IG_SEMI_PRIVATE_REEL_FETCH_API);
    const response = await axios.get(
      `${IG_SEMI_PRIVATE_REEL_FETCH_API}${url}`,
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
          Cookie: env.IG_COOKIE,
          Host: api.host,
        },
        timeout,
      },
    );
    // it will return formated json so no need to format it again
    return response.data;
  } catch (e: any) {
    console.error("fetchIGSemiPrivateReel error:", e?.message);
    return null;
  }
};
