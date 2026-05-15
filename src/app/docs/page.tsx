"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

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
