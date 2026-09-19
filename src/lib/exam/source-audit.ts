import type { AuditedSource, ResearchSource } from "./schemas";

const TRUSTED_EXACT_HOSTS = new Set([
  "kice.re.kr",
  "www.kice.re.kr",
  "moe.go.kr",
  "www.moe.go.kr",
  "ebsi.co.kr",
  "www.ebsi.co.kr",
  "ncic.go.kr",
  "www.ncic.go.kr",
  "law.go.kr",
  "www.law.go.kr",
  "data.go.kr",
  "www.data.go.kr",
  "who.int",
  "www.who.int",
  "unesco.org",
  "www.unesco.org",
  "oecd.org",
  "www.oecd.org",
]);

const TRUSTED_SUFFIXES = [
  ".go.kr",
  ".gov",
  ".gov.uk",
  ".ac.kr",
  ".edu",
  ".edu.au",
  ".gc.ca",
];

export function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function isTrustedHost(value: string): boolean {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const host = new URL(normalized).hostname;
  return (
    TRUSTED_EXACT_HOSTS.has(host) ||
    TRUSTED_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

function equivalentSearchUrl(sourceUrl: string, searchedUrls: Set<string>): boolean {
  const normalized = normalizeUrl(sourceUrl);
  if (!normalized) return false;
  if (searchedUrls.has(normalized)) return true;

  const candidate = new URL(normalized);
  for (const searched of searchedUrls) {
    const found = new URL(searched);
    if (
      found.hostname === candidate.hostname &&
      (found.pathname.startsWith(candidate.pathname) ||
        candidate.pathname.startsWith(found.pathname))
    ) {
      return true;
    }
  }
  return false;
}

export function scoreSource(
  source: ResearchSource,
  searchedUrls: Set<string>,
): AuditedSource {
  const normalizedUrl = normalizeUrl(source.url) ?? "";
  const searchedByTool = normalizedUrl
    ? equivalentSearchUrl(normalizedUrl, searchedUrls)
    : false;
  const trustedDomain = normalizedUrl ? isTrustedHost(normalizedUrl) : false;
  const https = normalizedUrl.startsWith("https://");

  let qualityScore = 0;
  if (searchedByTool) qualityScore += 35;
  if (trustedDomain) qualityScore += 25;
  if (https) qualityScore += 5;
  if (source.sourceType === "official_exam") qualityScore += 25;
  else if (source.sourceType === "government_or_public") qualityScore += 20;
  else if (source.sourceType === "academic") qualityScore += 15;
  else if (source.sourceType === "reputable_education") qualityScore += 10;
  if (source.verifiedClaims.length > 0) qualityScore += 5;
  if (source.publisher.trim().length > 0) qualityScore += 5;

  return {
    ...source,
    normalizedUrl,
    searchedByTool,
    trustedDomain,
    https,
    qualityScore: Math.min(100, qualityScore),
  };
}

export function auditSources(
  sources: ResearchSource[],
  searchedUrls: string[],
): AuditedSource[] {
  const normalizedSearched = new Set(
    searchedUrls
      .map(normalizeUrl)
      .filter((url): url is string => Boolean(url)),
  );
  return sources.map((source) => scoreSource(source, normalizedSearched));
}

export function sourceUrlWasSearched(url: string, searchedUrls: string[]): boolean {
  const normalized = new Set(
    searchedUrls
      .map(normalizeUrl)
      .filter((item): item is string => Boolean(item)),
  );
  return equivalentSearchUrl(url, normalized);
}
