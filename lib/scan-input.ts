/**
 * Normalise what a student pastes into the manual fallback: either the full
 * scan URL shown under the QR (`https://…/scan?t=<jwt>`) or the raw token.
 * Returns null for anything that cannot be a signed QR token, so the caller
 * can show one clear error instead of sending junk to the API.
 */
export function extractScanToken(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  let candidate = value;
  try {
    const url = new URL(value, "https://hudoor.invalid");
    const fromQuery = url.searchParams.get("t");
    if (fromQuery) candidate = fromQuery;
  } catch {
    // Not a URL — treat the input itself as the candidate below.
  }
  candidate = candidate.trim();

  // A compact JWS has exactly three base64url segments.
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(candidate)) return null;
  if (candidate.length < 20 || candidate.length > 4096) return null;
  return candidate;
}
