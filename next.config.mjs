/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',  // Required for electron-builder
    distDir: 'out',    // Change the output directory if desired
    images: {
      unoptimized: true, // This is necessary for static exports
    },
};

export default nextConfig;
