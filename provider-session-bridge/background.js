const PROVIDERS = new Set([
  "netflix",
  "disney-plus",
  "max",
  "prime-video"
]);

function storageKey(providerId) {
  return `3dstreaming.provider.${providerId}`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "confirm-provider-session") return;

  const providerId = message.providerId;
  if (!PROVIDERS.has(providerId)) {
    sendResponse({ ok: false, error: "Unknown provider." });
    return;
  }

  const status = {
    providerId,
    confirmedAt: new Date().toISOString(),
    pageUrl: sender.tab?.url || undefined
  };

  chrome.storage.local.set(
    {
      [storageKey(providerId)]: status
    },
    () => sendResponse({ ok: true, status })
  );

  return true;
});

chrome.runtime.onMessageExternal.addListener(
  (message, _sender, sendResponse) => {
    const providerId = message?.providerId;

    if (!PROVIDERS.has(providerId)) {
      sendResponse({ ok: false, error: "Unknown provider." });
      return;
    }

    if (message.type === "get-provider-status") {
      chrome.storage.local.get(storageKey(providerId), (values) => {
        sendResponse({
          ok: true,
          status: values[storageKey(providerId)] || null
        });
      });
      return true;
    }

    if (message.type === "clear-provider-status") {
      chrome.storage.local.remove(storageKey(providerId), () => {
        sendResponse({ ok: true });
      });
      return true;
    }

    sendResponse({ ok: false, error: "Unsupported bridge request." });
  }
);
