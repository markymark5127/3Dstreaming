import { ExternalStreamingPlugin } from "../ExternalStreamingPlugin";
import { providersById } from "../manifests";

export const maxPlugin = new ExternalStreamingPlugin({
  provider: providersById.max,
  authUrl: "https://www.hbomax.com/",
  browseUrl: "https://www.hbomax.com/",
  searchUrl: () => "https://www.hbomax.com/search"
});
