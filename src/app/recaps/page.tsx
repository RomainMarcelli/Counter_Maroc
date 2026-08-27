import type { Metadata } from "next";
import { RecapsPage } from "@/components/recaps/recaps-page";

export const metadata: Metadata = { title: "Récaps" };
export default function Page() { return <RecapsPage />; }
