import { JournalView } from "@/components/journal/JournalView";

export const dynamic = "force-dynamic";

export default function JournalPage() {
  return (
    <div className="px-5 py-5">
      <JournalView />
    </div>
  );
}
