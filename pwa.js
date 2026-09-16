/* PWA bootstrap kept separate from the business logic. */
(() => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "./service-worker.js",
        { scope: "./", updateViaCache: "none" }
      );

      if (document.visibilityState === "visible") {
        registration.update().catch(() => {});
      }
    } catch (error) {
      console.warn("La instalación PWA no está disponible:", error);
    }
  });
})();
