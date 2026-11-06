import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Next.js handles global CSS and CSS Modules natively. Do not route
  // *.module.css files through the Tailwind Turbopack loader: doing so
  // turns CSS Modules into plain CSS and leaves imported class maps empty.
};

export default nextConfig;
