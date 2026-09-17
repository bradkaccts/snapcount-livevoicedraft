import { useEffect, useRef, useState } from "react";

const HEARTBEAT_MS = 2000;
const STALE_MS = 5500;

function channelName(code: string) {
  return `snapcount-bigboard-${code}`;
}

/** Big board windows announce themselves so the console can stay heads-down. */
export function useBigBoardBeacon(code: string) {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(channelName(code));
    const ping = () => channel.postMessage({ type: "bigboard-alive", at: Date.now() });
    ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    const onRequest = (event: MessageEvent) => {
      if (event.data?.type === "bigboard-who") ping();
    };
    channel.addEventListener("message", onRequest);
    return () => {
      clearInterval(id);
      channel.removeEventListener("message", onRequest);
      channel.close();
    };
  }, [code]);
}

/** True while a big board window for this draft is open somewhere. */
export function useBigBoardOpen(code: string) {
  const [open, setOpen] = useState(false);
  const lastSeen = useRef(0);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(channelName(code));
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "bigboard-alive") return;
      lastSeen.current = Date.now();
      setOpen(true);
    };
    channel.addEventListener("message", onMessage);
    channel.postMessage({ type: "bigboard-who" });
    const id = setInterval(() => {
      if (Date.now() - lastSeen.current > STALE_MS) setOpen(false);
    }, 1000);
    return () => {
      clearInterval(id);
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, [code]);

  return open;
}
