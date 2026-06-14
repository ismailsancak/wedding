import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "./core";

// V6 SDK uyumluluğu için UPLOADTHING_TOKEN'ı çözüp SECRET ve APP_ID olarak set edelim
if (process.env.UPLOADTHING_TOKEN && !process.env.UPLOADTHING_SECRET) {
  try {
    const decoded = JSON.parse(Buffer.from(process.env.UPLOADTHING_TOKEN, 'base64').toString('utf-8'));
    if (decoded.apiKey) {
      process.env.UPLOADTHING_SECRET = decoded.apiKey;
    }
    if (decoded.appId) {
      process.env.UPLOADTHING_APP_ID = decoded.appId;
    }
  } catch (e) {
    console.error("UploadThing token parse hatası:", e);
  }
}

// Export routes for Next App Routers
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  // config: {},
});
