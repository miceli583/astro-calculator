import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    // .hermes/.playwright-mcp are gitignored ops working dirs, not app source.
    ignores: ["ephemeris/**", "scripts/**", ".hermes/**", ".playwright-mcp/**"],
  },
];

export default config;
