import { NextRequest, NextResponse } from "next/server";
import { tools as toolsSource } from "./lib/tools/source";
import { geolocation, ipAddress } from "@vercel/functions";
import { COLLAB_OPPORTUNITIES, collabMessage } from "./middleware/collab";
import { BANNED_SCRAPPERS } from "./middleware/ban";
import { isStaticPath } from "./middleware/isStatic";
import { TokenManager } from "./lib/security";
import { FETCHY_GITHUB } from "./constants";
import { STAGE } from "./constants/env";
import { routing } from "./i18n/routing";
import createMiddleware from "next-intl/middleware";
import { LOCALES_INFO, resolveLocale } from "./constants/locales";
import { redenv } from "./lib/redenv";

const encodeBtoa = (data: Record<string, any>) => {
  const json = JSON.stringify(data);
  return btoa(encodeURIComponent(json));
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = ipAddress(request);
  const {
    flag,
    country,
    city,
    countryRegion,
    latitude,
    longitude,
    postalCode,
    region,
  } = geolocation(request);
  const securityManager = new TokenManager();
  const headers = new Headers(request.headers);

  // =============================
  // next-intl setup
  // =============================
  const matchedLocale = LOCALES_INFO.find((loc) =>
    loc.countries.includes(country ?? "")
  );
  const defaultLocale = matchedLocale?.locale ?? "en";

  // Read
  const localeFromCookie = request.cookies.get("locale")?.value;
  const acceptLanguage = (request.headers.get("accept-language") ?? "")
    .split(/[;,]/)[0]
    ?.trim();

  // If cookie missing and accept-language not supported, replace accept-lang header
  if (
    !resolveLocale(localeFromCookie ?? "") &&
    !resolveLocale(acceptLanguage ?? "")
  ) {
    request.headers.set("accept-language", `${defaultLocale};q=1.0`);
  }

  // Call Next-Intl middleware
  const intlMiddleware = createMiddleware({ ...routing, defaultLocale });
  const response = intlMiddleware(request);

  const geo = {
    country,
    flag,
    city,
    countryRegion,
    latitude,
    longitude,
    postalCode,
    region,
  };
  response.cookies.set("_g", encodeBtoa(geo), {
    path: "/",
    maxAge: 15,
  });

  // =============================
  const locale = response.headers.get(
    "x-middleware-request-x-next-intl-locale"
  );

  const tools = toolsSource.getTools().sortBy("isNew");

  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  headers.set("x-current-url", request.nextUrl.href);
  headers.set("x-current-path", pathname);

  if (
    COLLAB_OPPORTUNITIES.includes(request.headers.get("x-requested-with") ?? "")
  ) {
    return NextResponse.json({ ...collabMessage() }, { status: 401 });
  }

  if (
    BANNED_SCRAPPERS.includes(request?.headers?.get("x-requested-with") ?? "")
  ) {
    return NextResponse.json(
      { error: "Your scraper is currently banned from using our API." },
      { status: 401 }
    );
  }

  if (pathname === "/github") {
    return NextResponse.redirect(new URL(FETCHY_GITHUB, request.url));
  }

  if (
    (pathname === `/tools` ||
      pathname === `/tool` ||
      pathname === `/${locale}/tools` ||
      pathname === `/${locale}/tool`) &&
    tools.length > 0 &&
    tools[0].url
  ) {
    return NextResponse.redirect(
      new URL(tools[0].url.replace("/:locale", ""), request.url)
    );
  }

  if (pathname === "/home" || pathname === `/${locale}/home`) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (STAGE === "production") {
    if (isStaticPath(pathname)) {
      return NextResponse.next({ headers });
    }

    if (pathname.startsWith("/api")) {
      const env = await redenv.load();
      const authHeader = request.headers.get("authorization");
      let isApiAuthorized = false;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        if (env.FETCHY_API_KEY && token === env.FETCHY_API_KEY) {
          isApiAuthorized = true;
        }
      }

      if (!isApiAuthorized) {
        const session = request.cookies.get("d_session")?.value;
        if (session) {
          try {
            if (!securityManager.isTokenValid(session)) {
              return NextResponse.json(
                { error: "Session expired" },
                { status: 401 }
              );
            }
          } catch (err) {
            return NextResponse.json(
              { error: "Invalid session format" },
              { status: 401 }
            );
          }
        } else {
          return NextResponse.json(
            { error: "Invalid session" },
            { status: 401 }
          );
        }
      }
    }

    if (!isStaticPath(pathname)) {
      console.log(`${request.method} ${ip} (${country}${flag}) -> ${pathname}`);
    }
  }

  // then apply our custom headers/cookies on the resulting response.
  headers.forEach((value, key) => response.headers.set(key, value));

  if (pathname.includes("/tool/")) {
    const resp = await securityManager.createToken({
      ip: ip ?? "",
      userAgent: request.headers.get("user-agent") ?? "",
    });

    response.cookies.set("d_session", resp, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60,
    });
  }

  return response;
}

export const config = {
  matcher: "/((?!security|api|trpc|_next|_vercel|.*\\..*).*)",
};
