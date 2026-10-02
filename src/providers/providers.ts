import { providerManifests, providersById } from "./manifests";
import { disneyPlusPlugin } from "./plugins/disneyPlus";
import { maxPlugin } from "./plugins/max";
import { netflixPlugin } from "./plugins/netflix";
import { primeVideoPlugin } from "./plugins/primeVideo";

export const providers = providerManifests;
export { providersById };

export const providerPlugins = [
  netflixPlugin,
  disneyPlusPlugin,
  maxPlugin,
  primeVideoPlugin
];
