/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Transpile Three.js packages for proper ESM handling
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  // Excluir discord.js del bundling de webpack (Next.js 13.5.1)
  experimental: {
    serverComponentsExternalPackages: [
      'discord.js',
      '@discordjs/ws',
      '@discordjs/rest',
      '@discordjs/voice',
      '@discordjs/collection',
      'undici',
      'zlib-sync',
      'bufferutil',
      'utf-8-validate',
      'erlpack',
      '@discordjs/opus',
      'opusscript',
      'sodium',
      'libsodium-wrappers',
      // PDF processing - server only
      'pdf-parse',
      'pdfjs-dist',
      'pdf-to-img',
      'canvas',
      // AI SDKs
      'openai',
      '@anthropic-ai/sdk',
    ],
  },
  webpack: (config, { isServer }) => {
    // Ignorar módulos nativos opcionales de discord.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'zlib-sync': false,
      'bufferutil': false,
      'utf-8-validate': false,
      'erlpack': false,
      '@discordjs/opus': false,
      'opusscript': false,
      'sodium': false,
      'libsodium-wrappers': false,
    };

    // Marcar estos módulos como externos en el servidor
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'zlib-sync': 'commonjs zlib-sync',
        'bufferutil': 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
      });
    }

    // Fix for pdf-parse ESM issues
    if (!isServer) {
      // Don't bundle PDF libraries on client side
      config.resolve.alias = {
        ...config.resolve.alias,
        'pdf-parse': false,
        'pdfjs-dist': false,
        'pdf-to-img': false,
        'canvas': false,
      };
    }

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'mawir-bucket.s3.us-east-2.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.us-east-2.amazonaws.com',
        pathname: '/**',
      },
    ],
    unoptimized: false, // Habilitar optimización de imágenes
  },
  // Forzar renderizado dinámico para todas las rutas API
  // Las páginas individuales deben tener 'export const dynamic = "force-dynamic"'
};

module.exports = nextConfig;


// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(
  module.exports,
  {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options

    org: "orvit",
    project: "javascript-nextjs",

    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    tunnelRoute: "/monitoring",

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  }
);
