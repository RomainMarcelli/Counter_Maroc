import type { Metadata } from "next";
import { JournalList } from "@/components/journal/journal-list";

export const metadata: Metadata = { title: "Journal" };
export default function JournalPage() { return <JournalList />; }
