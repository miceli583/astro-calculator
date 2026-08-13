// Single source of truth for the API version.
//
// Two public surfaces report it — `/api/health` and the OpenAPI `info` block
// behind `/api/openapi.json` and `/docs` — and they drifted apart once already:
// the spec sat at 0.1.0 through the 0.2.0 and 0.3.0 releases while health
// reported the real number, so the docs page advertised a version that had not
// existed for two releases.
//
// Import this rather than hardcoding a version string. `tests/version.test.ts`
// asserts every surface matches package.json and that no literal creeps back.
//
// NOTE: `env.npm_package_version` is not a substitute. npm sets it only for
// processes it spawns, so it is absent in the Vercel runtime and any `?? "x"`
// fallback becomes the value that ships. That was the original bug (f78f231).
import { version } from "../../package.json";

export const API_VERSION: string = version;
