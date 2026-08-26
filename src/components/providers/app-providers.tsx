"use client";

import { TripProvider } from "./trip-provider";
import { ToastProvider } from "./toast-provider";
import { AppFrame } from "@/components/shell/app-frame";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TripProvider>
      <ToastProvider>
        <ServiceWorkerRegistration />
        <AppFrame>{children}</AppFrame>
      </ToastProvider>
    </TripProvider>
  );
}
