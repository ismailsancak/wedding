import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "./core";

// Export routes for Next App Routers
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  // config: {},
});
