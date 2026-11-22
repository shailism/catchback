import type { CapacitorConfig } from "@capacitor/cli";

// appId must be confirmed by the owner before the first store upload; it cannot change later.
const config: CapacitorConfig = {
  appId: "app.catchback.journal",
  appName: "CatchBack",
  webDir: "dist-native",
};

export default config;
