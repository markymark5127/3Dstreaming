(() => {
  const host = location.hostname.toLowerCase();

  const providerId =
    host.includes("netflix.com")
      ? "netflix"
      : host.includes("disneyplus.com")
        ? "disney-plus"
        : host.includes("hbomax.com") || host.includes("max.com")
          ? "max"
          : host.includes("primevideo.com")
            ? "prime-video"
            : null;

  if (!providerId || document.getElementById("3dstreaming-confirm-session")) {
    return;
  }

  const names = {
    netflix: "Netflix",
    "disney-plus": "Disney+",
    max: "HBO Max",
    "prime-video": "Prime Video"
  };

  const button = document.createElement("button");
  button.id = "3dstreaming-confirm-session";
  button.textContent = `✓ I’m signed in — confirm ${names[providerId]}`;

  Object.assign(button.style, {
    position: "fixed",
    right: "18px",
    bottom: "18px",
    zIndex: "2147483647",
    border: "1px solid rgba(255,255,255,.2)",
    borderRadius: "999px",
    background: "rgba(12,15,19,.94)",
    color: "#fff",
    padding: "10px 14px",
    font: "600 13px system-ui, sans-serif",
    boxShadow: "0 10px 30px rgba(0,0,0,.35)",
    cursor: "pointer"
  });

  button.addEventListener("click", () => {
    chrome.runtime.sendMessage(
      {
        type: "confirm-provider-session",
        providerId
      },
      (response) => {
        if (response?.ok) {
          button.textContent = "✓ Confirmed for 3Dstreaming";
          button.style.background = "rgba(35,112,70,.95)";
        } else {
          button.textContent = "Could not confirm session";
          button.style.background = "rgba(130,45,45,.95)";
        }
      }
    );
  });

  document.documentElement.appendChild(button);
})();
