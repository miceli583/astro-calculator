import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    // .hermes/.playwright-mcp are gitignored ops working dirs, not app source.
    // .worktrees holds git worktrees of this same repo. Their source is already
    // linted from its own checkout, and once a worktree has been built its
    // .next/ output lands here too — the Next preset's `.next/**` ignore is
    // root-anchored, so it does not match `.worktrees/*/.next/**` and a built
    // worktree turns `npm run lint` red with thousands of generated-file errors.
    ignores: ["ephemeris/**", "scripts/**", ".hermes/**", ".playwright-mcp/**", ".worktrees/**"],
  },
];

export default config;
