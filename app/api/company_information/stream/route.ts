import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import CompanyInformation from "@/models/CompanyInformation";

export async function GET(req: Request) {
  await dbConnect();

  let isClosed = false; // Track stream state
  let interval: NodeJS.Timeout; // Polling interval
  let heartbeatInterval: NodeJS.Timeout; // Keep-alive interval

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const safeEnqueue = (chunk: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch (err) {
          console.error("enqueue failed, closing stream:", err);
          cleanup();
        }
      };

      const sendEvent = (data: any) => {
        safeEnqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      const sendHeartbeat = () => {
        safeEnqueue(": keep-alive\n\n");
      };

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(interval);
        clearInterval(heartbeatInterval);

        try {
          controller.close();
        } catch (err) {
          // ignore if already closed
        }
      };

      // Initial data
      try {
        const companies = await CompanyInformation.find({}).lean();
        sendEvent(companies);
      } catch (err) {
        console.error("Error fetching initial companies:", err);
        cleanup();
        return;
      }

      // Poll DB every 5 seconds for updates
      interval = setInterval(async () => {
        if (isClosed) return;
        try {
          const companies = await CompanyInformation.find({}).lean();
          sendEvent(companies);
        } catch (err) {
          console.error("Error in polling handler:", err);
        }
      }, 5000);

      // Heartbeat every 15s
      heartbeatInterval = setInterval(() => {
        if (!isClosed) sendHeartbeat();
      }, 15000);

      // Client disconnect
      if ((req as any).signal) {
        (req as any).signal.addEventListener("abort", () => {
          console.log("Client disconnected.");
          cleanup();
        });
      }
    },
    cancel() {
      console.log("Stream canceled by client.");
      isClosed = true;
      clearInterval(interval);
      clearInterval(heartbeatInterval);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}