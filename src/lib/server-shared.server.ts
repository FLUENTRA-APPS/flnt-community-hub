export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomCode(digits: number): string {
  const max = 10 ** digits;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0]! % max).toString().padStart(digits, "0");
}

export function siteOrigin(fallback = "https://flnt.dpdns.org"): string {
  return process.env["SITE_URL"] ?? fallback;
}
