/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  webpack: (config) => {
    config.module.rules.push({
      test: /\.mjs$/,
      type: "javascript/auto",
      resolve: { fullySpecified: false },
    });
    return config;
  },
};

export default nextConfig;
