import querystring from "querystring";

import { HttpRequest } from "@/utils";
import { handleScraperError } from "./helpers";
import { formatGraphqlJson } from "./formatters";
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
  const docId = isPostOrReel ? "10015901848480474" : "31842794902034649";
  const variables = isPostOrReel
    ? {
        shortcode: postId,
        fetch_comment_count: 40,
        fetch_related_profile_media_count: 3,
        parent_comment_count: 24,
        child_comment_count: 3,
        fetch_like_count: 10,
        fetch_tagged_user_count: null,
        fetch_preview_comment_count: 2,
        has_threaded_comments: true,
        hoist_extract_wni_from_comments: false,
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
  const requestData = {
    av: "17841454066911119",
    __d: "www",
    __user: 0,
    __a: 1,
    __req: "b",
    __hs: "20639.HYP:instagram_web_pkg.2.1...0",
    dpr: 1,
    __ccg: "GOOD",
    __rev: 1042641721,
    __s: "gx238d:cul40h:zbuf8d",
    __hsi: "7658983823372492036",
    __dyn:
      "7xeUjG1mxu1syUbFp41twpUnwgU7SbzEdF8aUco2qwJxS0k24o0B-q1ew6ywaq0yE462mcw5Mx62G5UswoEcE7O2l0Fwqo5W1yw9O1lwlE-U2zxe2GewGw9a361qw8Xxm16wa-0oa2-azo7u3C2u2J0bS1LyUaUbGwmk0zU8oC1Iwqo5p389oed6goK10xKi2K7E5y4U158KmUhw5nyEcE4y16wAwj83KwRzk",
    __csr:
      "gCwshQILWNv6QPFqHnsX6BZiOdoFamtmykXnRcGhqjW8GJ9pGGGhox4Gpp9khfAFqizV9tiC9jSykz48oJavCBF2emZ2Vqz8S8BJ7QmiECeHWyp98OmuiEx5K5UsyoCaVd9BgCh3EKnzpEixiVEjAxm4oGbAB-S8AGAuEOq548yEFt_y8SFbgS5EGfyEmgCEC78rBCBAKexq8KcyomCyeCi18yE06aS02T600UIE8odE0S3w19Oq2nc0deKmcw2HE1l84bw3GU45wSw7FwDo2jwce1Wg6m6E1BVi05Q503Ry398nycjwKDyu265E2Ba3Bw3qm0BU7u07t403h6040U0nSw3hU3Po3qw",
    __hsdp:
      "gbA5rNc5kmOea8Ixmy7EzaFbmEuFIEydUSl7BBwUxgk2izOo889C1roJwpQ34w8E5K1N8h5wEyE4S14wvEuwUwg8ox60GVEeUb84J0AwhrwGzF86i8wKx68y8d8a84x0JwjEow7bwdy08dw3UEG0JU0oTw4nU6q0hK7E0MyewiE13o0zN03hE1EU5au9AhE4e0aBG",
    __hblp:
      "0gWw8q3rxe584Wi8BAwi85Wmu64cz8e9EKlwm8x0SwyG1ty84K7pF42u8UjwIBCwNxa1IByaxW5U88fbxzzu1gwmFEgwGwIU4xwAwAzF8OUKm68Wi1Ay99U8ohy8y3i2y1TzXyEbUowyw5rzEW2W0BomwHw51wcK3O11w6Ww6EyE2Tw1zu0Z88K363i1fwyw8a2m7Epxe0bqzE4G0T8mxC1Mw7bg1UE1fo9o28wiUO0MqwjVUCh6g4a0ju782dG0LWw",
    __sjsp: "gbA5rOigD2Qkgzyyaaq8uycGAJqxWCOy8Tzpkdw86pCwhS",
    __comet_req: 7,
    fb_dtsg:
      "NAfw5y2nm2Z6Fg9eiiFegyLX6vrll3UgrxPx485ICe2OjqiQ6EPufrA:17843671327157124:1781330384",
    jazoest: 26332,
    lsd: "xM_vWMRLGLIM3KGo4T5iG9",
    __spin_r: 1042641721,
    __spin_b: "trunk",
    __spin_t: 1783246133,
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

  const headers = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.5",
    "Content-Type": "application/x-www-form-urlencoded",
    "X-FB-Friendly-Name": "PolarisPostActionLoadPostQueryQuery",
    "X-CSRFToken": "RVDUooU5MYsBbS1CNN3CzVAuEP8oHB52",
    "X-IG-App-ID": "936619743392459",
    "X-FB-LSD": "xM_vWMRLGLIM3KGo4T5iG9",
    "X-ASBD-ID": "359341",
    "X-Bloks-Version-Id":
      "9710744400aad993bd60d4784987ff111f0f5d8a9859069ba8ae7485ed483e3f",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    cookie: `${env.IG_COOKIE}`,
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

    if (response && response.statusText !== "error" && response.data?.data) {
      json = formatGraphqlJson(response.data, type);
    }
  } catch (e) {
    handleScraperError(e as Error);
  }

  // If GraphQL failed or returned null (rate-limited, blocked, or private/semi-private), fallback to CDN parser
  if (!json && (type === "reel" || type === "post")) {
    json = await fetchIGSemiPrivateReel(requestedUrl, timeout);
    if (json) {
      json.type = type;
    }
  }

  return json;
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
    handleScraperError(e);
    return null;
  }
};
