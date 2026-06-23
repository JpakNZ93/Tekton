/** @type {import('next').NextConfig} */
const nextConfig = {
  // Scaffold Quoter uses App Router API routes; keep Next in server output mode.
  // Bundle project data + artifacts into serverless functions (Vercel read-only FS).
  outputFileTracingIncludes: {
    "/api/projects": ["./data/**/*", "./artifacts/projects/**/*"],
    "/api/projects/*": ["./data/**/*", "./artifacts/projects/**/*"],
    "/projects/*": ["./data/**/*", "./artifacts/projects/**/*"],
  },
};

export default nextConfig;
