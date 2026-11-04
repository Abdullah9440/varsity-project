// Slim "Get it as an app" install bar, fixed at the top of the screen.
// Chrome fires "beforeinstallprompt" when the app can be installed. We keep that
// event and show our own bar; clicking "Install" opens Chrome's install dialog.
// The close (x) button only hides the bar for the current page view. No
// "dismissed" flag is stored, so the bar comes back on the next visit until
// the app is installed.

(function () {
  const banner = document.getElementById("install-banner");
  const installBtn = document.getElementById("install-btn");
  const closeBtn = document.getElementById("install-close");
  let deferredPrompt = null;
  // Closed with the "x" during this page view only (kept in memory, never saved)
  let closedThisView = false;

  // True when the page is already running as the installed app
  function isRunningStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      navigator.standalone === true;
  }

  function showBanner() {
    if (isRunningStandalone() || closedThisView) {
      return;
    }
    banner.classList.remove("hidden");
    // Adds top padding to the page so the bar never covers the header
    document.body.classList.add("has-install-bar");
  }

  function hideBanner() {
    banner.classList.add("hidden");
    document.body.classList.remove("has-install-bar");
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
    // (usually on the next visit) and the bar is shown again.
  });

  closeBtn.addEventListener("click", function () {
    closedThisView = true;
    hideBanner();
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    hideBanner();
  });

  // Hide the bar if the app switches into standalone mode
  window.matchMedia("(display-mode: standalone)").addEventListener("change", function (event) {
    if (event.matches) {
      hideBanner();
    }
  });

  if (isRunningStandalone()) {
    hideBanner();
  }
})();
