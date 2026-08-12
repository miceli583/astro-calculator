"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

/**
 * Load apidom's refractor registration BEFORE swagger-ui-react.
 *
 * `@swagger-api/apidom-ns-openapi-3-1` assigns every `<X>Element.refract`
 * static inside the side-effect module `src/refractor/registration.mjs`, and
 * its `index.mjs` re-exports the element classes *from that module* so any
 * import forces the assignment to run. The bundler optimizes that re-export
 * back to the definition site (`src/elements/OpenApi3-1.mjs`) and never
 * evaluates registration.mjs — so `OpenApi3_1Element.refract` is undefined,
 * swagger-client's `resolveSubtree` throws, and every operation renders as an
 * empty shell: no parameters, no request body, no responses. Confirmed broken
 * in production, not just dev.
 *
 * A dynamic import() is a runtime call, so it survives tree-shaking. The
 * element classes are module singletons, so registering them here is what
 * swagger-client later sees.
 */
const SwaggerUI = dynamic(
  async () => {
    await import("@swagger-api/apidom-ns-openapi-3-1");
    return (await import("swagger-ui-react")).default;
  },
  { ssr: false },
);

export default function DocsPage() {
  return (
    <div className="docs-shell">
      <SwaggerUI url="/api/openapi.json" docExpansion="list" defaultModelsExpandDepth={-1} />
      <style>{`
        .docs-shell {
          min-height: 100vh;
          background: #fafafa;
        }
        .swagger-ui .topbar { display: none; }
      `}</style>
    </div>
  );
}
