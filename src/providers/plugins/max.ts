import { ExternalStreamingPlugin } from "../ExternalStreamingPlugin";
import { providersById } from "../manifests";

export const maxPlugin = new ExternalStreamingPlugin({
  provider: providersById.max,
  authUrl: "https://auth.max.com/login",
  browseUrl: "https://www.max.com/"
});
