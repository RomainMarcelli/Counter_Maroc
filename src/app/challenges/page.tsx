import type { Metadata } from "next";
import { ChallengesPage } from "@/components/challenges/challenges-page";

export const metadata: Metadata = { title: "Challenges" };
export default function Page() { return <ChallengesPage />; }
