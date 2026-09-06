import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` иначе дописывает свой блок в CLAUDE.md, который ведётся руками.
  agentRules: false,
};

export default nextConfig;
