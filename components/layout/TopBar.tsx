"use client";

import { useEffect, useState } from "react";
import { useStream } from "@/hooks/useStream";

export function TopBar() {
  const [time, setTime] = useState<string>("");
  const { connected, lastEventAt } = useStream();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    setTime(new Date().toLocaleTimeString());
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex items-center gap-3 text-xs text-zinc-400">
      <span className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500" : "bg-zinc-600"}`}
        />
        {connected ? "Stream live" : "Stream offline"}
      </span>
      {lastEventAt ? (
        <span className="text-zinc-600">
          Last event {new Date(lastEventAt).toLocaleTimeString()}
        </span>
      ) : null}
      <span className="num text-zinc-500">{time}</span>
    </div>
  );
}
