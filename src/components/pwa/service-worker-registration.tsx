"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_PWA === "true" || navigator.webdriver;
    if (enabled && process.env.NEXT_PUBLIC_DISABLE_PWA !== "true") {
      let registration: ServiceWorkerRegistration | null = null;
      let reloading = false;
      const hadController = Boolean(navigator.serviceWorker.controller);
      const update = () => {
        if (document.visibilityState === "visible" && registration) void registration.update().catch(() => undefined);
      };
      const onControllerChange = () => {
        // Au premier contrôle de la page, recharger serait inutile. En revanche une
        // PWA déjà installée doit prendre immédiatement le nouveau bundle cohérent.
        if (!hadController || reloading) return;
        reloading = true;
        window.location.reload();
      };
      const onVisibilityChange = () => update();

      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      window.addEventListener("pageshow", update);
      document.addEventListener("visibilitychange", onVisibilityChange);
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((result) => {
          registration = result;
          update();
        })
        .catch(() => undefined);
      return () => {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        window.removeEventListener("pageshow", update);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    }
    void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
    if ("caches" in window) void caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("marrakech-crew-")).map((key) => caches.delete(key))));
  }, []);
  return null;
}
