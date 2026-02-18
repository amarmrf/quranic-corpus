import { NextRequest } from "next/server";

const DEFAULT_API_BASE = "http://localhost:6382";

function normalizeBaseUrl(raw: string) {
  const normalized = raw.trim();
  const parsed = new URL(normalized);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed;
}

function getApiBaseUrl() {
  const raw =
    process.env.QURANIC_API_BASE ??
    process.env.NEXT_PUBLIC_QURANIC_API_BASE ??
    DEFAULT_API_BASE;

  return normalizeBaseUrl(raw);
}

function toUpstreamUrl(path: string[], request: NextRequest) {
  const base = getApiBaseUrl();
  const upstreamPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  base.pathname = `${base.pathname}/${upstreamPath}`.replace(/\/{2,}/g, "/");
  base.search = request.nextUrl.search;
  return base;
}

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;

  if (!path || path.length === 0) {
    return Response.json({ error: "Missing API path." }, { status: 400 });
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = toUpstreamUrl(path, request);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected API configuration error.";

    return Response.json(
      {
        error: "Invalid Quranic API base URL configuration.",
        details: message,
      },
      { status: 500 },
    );
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: {
        accept: request.headers.get("accept") ?? "application/json",
      },
    });

    const body = await upstreamResponse.arrayBuffer();
    const headers = new Headers();
    const contentType = upstreamResponse.headers.get("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }

    return new Response(body, {
      status: upstreamResponse.status,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected upstream error.";

    return Response.json(
      {
        error: `Unable to reach Quranic API upstream at ${upstreamUrl.origin}.`,
        details: message,
      },
      { status: 502 },
    );
  }
}
