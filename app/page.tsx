import { AlgoStatusBar } from "@/components/dashboard/AlgoStatusBar";
import { HeartbeatStream } from "@/components/dashboard/HeartbeatStream";
import { ActiveTrades } from "@/components/dashboard/ActiveTrades";
import { EquityMini } from "@/components/dashboard/EquityMini";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="px-5 py-5 space-y-5">
      <AlgoStatusBar />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <HeartbeatStream />
          <EquityMini />
        </div>
        <div className="space-y-5">
          <ActiveTrades />
        </div>
      </div>
    </div>
  );
}
