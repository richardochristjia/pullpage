export function isHttpsProductPreview(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Single source for next.config.ts `images.remotePatterns` and `isOptimizablePreview`.
export const PREVIEW_IMAGE_PATTERNS = [
  { protocol: "https", hostname: "pullpage-images.pullpage.workers.dev" },
  { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
  { protocol: "https", hostname: "res.cloudinary.com" },
] as const;

// `next/image` rejects hosts outside the patterns, so only these may go through the optimizer.
export function isOptimizablePreview(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.port && PREVIEW_IMAGE_PATTERNS.some((pattern) => {
      const hostOk = pattern.hostname.startsWith("*.")
        ? url.hostname.endsWith(pattern.hostname.slice(1)) && !url.hostname.slice(0, -(pattern.hostname.length - 1)).includes(".")
        : url.hostname === pattern.hostname;
      const prefix = "pathname" in pattern ? pattern.pathname.replace("**", "") : "";
      return hostOk && url.pathname.startsWith(prefix);
    });
  } catch {
    return false;
  }
}
