/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Invitation links carry a one-time token in the path: never leak it via the Referer header.
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Microphone only for this site itself (in-browser recording, slice 2).
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig = {
  poweredByHeader: false,
  // Send <title> and other metadata in the initial <head> for every visitor instead of streaming it in
  // later: screen readers announce the page title on arrival (WCAG 2.4.2), and pages are small.
  htmlLimitedBots: /.*/,
  serverExternalPackages: ["pg"],
  // Recordings up to 25 MB (MAX_BYTES in src/domain/media-type.ts) plus form overhead. Local development only:
  // hosted uploads will go directly to storage with signed URLs (Vercel caps request bodies at 4.5 MB).
  experimental: { serverActions: { bodySizeLimit: "26mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
