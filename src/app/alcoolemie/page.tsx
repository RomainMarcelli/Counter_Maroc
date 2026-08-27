import type { Metadata } from "next";
import { BacPage } from "@/components/bac/bac-page";

export const metadata: Metadata = { title: "Alcoolémie" };

export default function AlcoolemiePage() {
  return <BacPage />;
}
