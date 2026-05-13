/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The SDK package is a workspace symlink. Next needs to know to compile it
  // through the same TS pipeline rather than treating it as pre-built node_modules.
  transpilePackages: ["@wageshield/sdk"],
  // The CoFHE SDK uses WebAssembly + dynamic imports for its TFHE backend; allow it.
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

module.exports = nextConfig;
