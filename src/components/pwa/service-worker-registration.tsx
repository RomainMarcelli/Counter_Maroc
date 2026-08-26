"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_PWA === "true" || navigator.webdriver;
    if (enabled && process.env.NEXT_PUBLIC_DISABLE_PWA !== "true") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      return;
    }
    void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
    if ("caches" in window) void caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("marrakech-crew-")).map((key) => caches.delete(key))));
  }, []);
  return null;
}
