"use client";

import { AuthProvider } from "./auth-provider";
import { TripProvider } from "./trip-provider";
import { BacProvider } from "./bac-provider";
import { ToastProvider } from "./toast-provider";
import { AppFrame } from "@/components/shell/app-frame";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { InviteCapture } from "@/components/onboarding/invite-capture";
import { ActionDialogProvider } from "./action-dialog-provider";
import { PhotoQueueProcessor } from "@/components/photos/photo-queue-processor";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TripProvider>
        <BacProvider>
          <ActionDialogProvider>
            <ToastProvider>
              <ServiceWorkerRegistration />
              <InviteCapture />
              <PhotoQueueProcessor />
              <AppFrame>{children}</AppFrame>
            </ToastProvider>
          </ActionDialogProvider>
        </BacProvider>
      </TripProvider>
    </AuthProvider>
  );
}
