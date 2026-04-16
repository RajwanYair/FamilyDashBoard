/**
 * FamilyDashBoard Worker — Shared request validation helpers
 *
 * All helpers return a validated value or throw a ValidationError.
 * Route handlers catch ValidationError and return 400 responses.
 */

/** Structured validation error with a field name. */
export class ValidationError extends Error {
  constructor(
    public readonly param: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Build a 400 response from a ValidationError. */
export function validationErrorResponse(err: ValidationError): Response {
  return new Response(
    JSON.stringify({ error: err.message, param: err.param }),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

/**
 * Require a non-empty string parameter from URL search params.
 * @throws ValidationError if missing
 */
export function requireParam(url: URL, name: string): string {
  const v = url.searchParams.get(name);
  if (!v || v.trim() === "")
    throw new ValidationError(name, `Missing required parameter: ${name}`);
  return v.trim();
}

/**
 * Require a latitude value (-90..90).
 * @throws ValidationError if invalid
 */
export function requireLat(url: URL, name = "lat"): number {
  const raw = url.searchParams.get(name);
  const n = parseFloat(raw ?? "");
  if (isNaN(n) || n < -90 || n > 90)
    throw new ValidationError(name, `Invalid latitude: must be -90..90`);
  return n;
}

/**
 * Require a longitude value (-180..180).
 * @throws ValidationError if invalid
 */
export function requireLon(url: URL, name = "lon"): number {
  const raw = url.searchParams.get(name);
  const n = parseFloat(raw ?? "");
  if (isNaN(n) || n < -180 || n > 180)
    throw new ValidationError(name, `Invalid longitude: must be -180..180`);
  return n;
}

/**
 * Require a positive integer year (2000–2100).
 * @throws ValidationError if invalid
 */
export function requireYear(url: URL, name = "year"): number {
  const raw = url.searchParams.get(name);
  const n = raw ? parseInt(raw, 10) : new Date().getFullYear();
  if (isNaN(n) || n < 2000 || n > 2100)
    throw new ValidationError(name, `Invalid year: must be 2000..2100`);
  return n;
}

/**
 * Require a numeric-only geoname ID string.
 * @throws ValidationError if invalid
 */
export function requireGeoId(url: URL, name = "geonameid"): string {
  const v = url.searchParams.get(name) ?? "281184";
  if (!/^\d{1,10}$/.test(v))
    throw new ValidationError(name, `Invalid geonameid: digits only`);
  return v;
}

/**
 * Require a stock ticker symbol (1–20 chars, alphanumeric + .-^).
 * @throws ValidationError if invalid
 */
export function requireSymbol(url: URL, name = "sym"): string {
  const v = requireParam(url, name);
  if (!/^[\w.\-^]{1,20}$/.test(v))
    throw new ValidationError(name, `Invalid symbol: use A-Z 0-9 . - ^ only`);
  return v;
}

/**
 * Require a valid HTTPS URL from a parameter.
 * @throws ValidationError if missing, malformed, or not HTTPS
 */
export function requireHttpsUrl(url: URL, name: string): URL {
  const raw = requireParam(url, name);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError(name, `Invalid URL for parameter: ${name}`);
  }
  if (parsed.protocol !== "https:")
    throw new ValidationError(name, `Only HTTPS URLs are allowed`);
  return parsed;
}
