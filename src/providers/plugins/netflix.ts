import { ExternalStreamingPlugin } from "../ExternalStreamingPlugin";
import { providersById } from "../providers";

export const netflixPlugin = new ExternalStreamingPlugin({
  provider: providersById.netflix,
  authUrl: "https://www.netflix.com/login",
  browseUrl: "https://www.netflix.com/browse",
  searchUrl: (query) =>
    `https://www.netflix.com/search?q=${encodeURIComponent(query.trim())}`
});
