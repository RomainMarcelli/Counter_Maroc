"use client";

import { TripProvider } from "./trip-provider";
import { ToastProvider } from "./toast-provider";
import { AppFrame } from "@/components/shell/app-frame";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { ActionDialogProvider } from "./action-dialog-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TripProvider>
      <ActionDialogProvider>
        <ToastProvider>
          <ServiceWorkerRegistration />
          <AppFrame>{children}</AppFrame>
        </ToastProvider>
      </ActionDialogProvider>
    </TripProvider>
  );
}
