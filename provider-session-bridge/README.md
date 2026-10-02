# 3Dstreaming Provider Session Bridge

Optional Chrome/Chromium extension for **user-confirmed provider sessions**.

This is not OAuth and it does not inspect provider cookies, passwords, access tokens, DRM keys, or video frames.

## Flow

1. Install this folder as an unpacked extension.
2. Open Netflix, Disney+, HBO Max, or Prime Video and sign in normally.
3. On the provider page, click **Confirm <Provider> for 3Dstreaming**.
4. The extension stores only the provider id, confirmation timestamp, and page URL.
5. Put the extension id in 3Dstreaming:

```
VITE_PROVIDER_BRIDGE_EXTENSION_ID=<chrome-extension-id>
```

6. In 3Dstreaming Account, choose **Check confirmation**.

The web app can then mark the service as **VERIFIED BY BRIDGE**.

## Development origins

The manifest currently allows external messages from:

- `http://localhost/*`
- `https://localhost/*`
- `https://*.app.github.dev/*`

Add your production 3Dstreaming origin to `externally_connectable.matches` before publishing the extension.

## Important boundary

This confirms that the user explicitly confirmed a provider browser session while on that provider's page. It does **not** independently validate subscription entitlement. The provider still decides whether a title can actually play.
