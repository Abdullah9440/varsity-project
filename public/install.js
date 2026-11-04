// Custom "Install our app" banner.
// Chrome fires "beforeinstallprompt" when the app can be installed. We keep that
// event and show our own banner; clicking the button opens Chrome's install dialog.
// No "dismissed" flag is stored, so the banner comes back on every visit until
// the app is installed.

(function () {
  const banner = document.getElementById("install-banner");
  const installBtn = document.getElementById("install-btn");
  let deferredPrompt = null;

  // True when the page is already running as the installed app
  function isRunningStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      navigator.standalone === true;
  }

  function showBanner() {
    if (!isRunningStandalone()) {
      banner.classList.remove("hidden");
    }
  }

  function hideBanner() {
    banner.classList.add("hidden");
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    // Stop Chrome's own mini-infobar and keep the event for our button
    event.preventDefault();
    deferredPrompt = event;
    showBanner();
  });

  installBtn.addEventListener("click", async function () {
    if (!deferredPrompt) {
      hideBanner();
      return;
    }
    const promptEvent = deferredPrompt;
    // A prompt event can only be used once
    deferredPrompt = null;
    hideBanner();
    promptEvent.prompt();
    try {
      const choice = await promptEvent.userChoice;
      console.log("Install prompt result:", choice.outcome);
    } catch (e) {
      console.warn("Install prompt failed", e);
    }
    // If the user said "Cancel", Chrome fires "beforeinstallprompt" again later
    // (usually on the next visit) and the banner is shown again.
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    hideBanner();
  });

  // Hide the banner if the app switches into standalone mode
  window.matchMedia("(display-mode: standalone)").addEventListener("change", function (event) {
    if (event.matches) {
      hideBanner();
    }
  });

  if (isRunningStandalone()) {
    hideBanner();
  }
})();
