import nextConfig from "eslint-config-next";

const config = [
  { ignores: [".next/**", "node_modules/**", "coverage/**", ".lighthouseci/**", "playwright-report/**", "test-results/**"] },
  ...nextConfig,
];

export default config;
