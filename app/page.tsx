import { AlgoStatusBar } from "@/components/dashboard/AlgoStatusBar";
import { HeartbeatStream } from "@/components/dashboard/HeartbeatStream";
import { ActiveTrades } from "@/components/dashboard/ActiveTrades";
import { EquityMini } from "@/components/dashboard/EquityMini";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="px-6 py-[18px] flex flex-col gap-3.5">
      <AlgoStatusBar />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3.5">
        <div className="flex flex-col gap-3.5 min-w-0">
          <HeartbeatStream />
          <EquityMini />
        </div>
        <ActiveTrades />
      </div>
    </div>
  );
}
