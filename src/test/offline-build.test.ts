import { describe, expect, it } from "vitest";
import { resolveConfig } from "vite";
import { offlineEntryPlugin } from "../../config/offline-entry";

describe("offline production entry", () => {
  it("never adds a second client entry, which TanStack's client-manifest capture forbids", async () => {
    const config = await resolveConfig({
      configFile: false,
      plugins: [{
        name: "framework-input",
        enforce: "pre",
        config: () => ({ environments: {
          client: { build: { rolldownOptions: { input: { index: "framework-client" } } } },
          ssr: { build: { rolldownOptions: { input: "framework-server" } } },
        } }),
      }, offlineEntryPlugin()],
    }, "build");
    expect(config.environments["client"]?.build.rolldownOptions.input).toEqual({
      index: "framework-client",
    });
    expect(config.environments["ssr"]?.build.rolldownOptions.input).toBe("framework-server");
  });

  it("builds the fallback only after the client bundle, via a client-scoped closeBundle hook", () => {
    const plugin = offlineEntryPlugin();
    expect(plugin.apply).toBe("build");
    expect(typeof plugin.closeBundle).toBe("function");
    expect("config" in plugin).toBe(false);
    expect("options" in plugin).toBe(false);
  });
});
