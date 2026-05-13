/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The SDK package is a workspace symlink. Next needs to know to compile it
  // through the same TS pipeline rather than treating it as pre-built node_modules.
  transpilePackages: ["@wageshield/sdk"],

  webpack: (config, { isServer }) => {
    // The CoFHE SDK uses WebAssembly + dynamic imports for its TFHE backend.
    config.experiments = { ...config.experiments, asyncWebAssembly: true };

    // Wagmi pulls in @metamask/sdk + WalletConnect transitively. Both declare
    // optional peer deps for React-Native (`@react-native-async-storage/async-storage`)
    // and Node-only logging (`pino-pretty`) that don't exist in a browser bundle.
    // Tell webpack to resolve them as no-ops; this matches the wagmi docs:
    // https://wagmi.sh/react/guides/nextjs#fix-modules-not-found-error
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
      // Node-only modules that occasionally get pulled in by deep deps:
      fs: false,
      net: false,
      tls: false,
    };

    // Externalise these on the server side too — Next's server bundler doesn't need
    // to resolve React-Native shims either.
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "@react-native-async-storage/async-storage",
        "pino-pretty",
      ];
    }

    return config;
  },
};

module.exports = nextConfig;
