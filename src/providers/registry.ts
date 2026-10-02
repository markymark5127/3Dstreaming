import { localMediaPlugin } from "./LocalMediaPlugin";
import { providerPlugins } from "./providers";
import type {
  PluginResult,
  PluginSearchResult,
  StreamingPluginId,
  StreamingProviderPlugin
} from "./pluginTypes";

export class ProviderPluginRegistry {
  private readonly plugins = new Map<StreamingPluginId, StreamingProviderPlugin>();

  constructor(items: StreamingProviderPlugin[]) {
    for (const plugin of items) this.plugins.set(plugin.id, plugin);
  }

  list(): StreamingProviderPlugin[] {
    return [...this.plugins.values()];
  }

  get(id: StreamingPluginId): StreamingProviderPlugin {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Unknown streaming plugin: ${id}`);
    return plugin;
  }

  async searchSupported(query: string): Promise<PluginSearchResult[]> {
    const results: PluginSearchResult[] = [];

    for (const plugin of this.plugins.values()) {
      const result: PluginResult<PluginSearchResult[]> = await plugin.search(query);
      if (result.ok) results.push(...result.value);
    }

    return results;
  }
}

export const providerPluginRegistry = new ProviderPluginRegistry([
  localMediaPlugin,
  ...providerPlugins
]);
