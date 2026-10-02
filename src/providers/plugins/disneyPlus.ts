import { ExternalStreamingPlugin } from "../ExternalStreamingPlugin";
import { providersById } from "../manifests";

export const disneyPlusPlugin = new ExternalStreamingPlugin({
  provider: providersById["disney-plus"],
  authUrl: "https://www.disneyplus.com/login",
  browseUrl: "https://www.disneyplus.com/"
});
