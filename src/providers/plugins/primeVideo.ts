import { ExternalStreamingPlugin } from "../ExternalStreamingPlugin";
import { providersById } from "../providers";

export const primeVideoPlugin = new ExternalStreamingPlugin({
  provider: providersById["prime-video"],
  authUrl: "https://www.primevideo.com/",
  browseUrl: "https://www.primevideo.com/",
  searchUrl: (query) =>
    `https://www.primevideo.com/search?phrase=${encodeURIComponent(query.trim())}`
});
