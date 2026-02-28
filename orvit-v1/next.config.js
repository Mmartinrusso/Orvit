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
