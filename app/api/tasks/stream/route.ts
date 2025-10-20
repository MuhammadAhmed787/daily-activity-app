import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";

export async function GET() {
  await dbConnect();

  let isConnected = true;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let pollingInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendData = async () => {
        try {
          const tasks = await Task.find({}).lean();
          const data = `data: ${JSON.stringify(tasks)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (error) {
          console.error("Error fetching tasks:", error);
          const errorData = `data: ${JSON.stringify({ error: "Failed to fetch tasks" })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        }
      };

      // Send initial data
      await sendData();

      // Set up polling as fallback
      pollingInterval = setInterval(async () => {
        if (isConnected) {
          await sendData();
        }
      }, 3000);

      // Heartbeat to keep connection alive
      heartbeatInterval = setInterval(() => {
        if (isConnected) {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }
      }, 15000);
    },
    cancel() {
      console.log("Stream canceled by client.");
      isConnected = false;

      // Clear intervals
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }

      // No need to call controller.close() here, as the stream is already being canceled
      console.log("Client disconnected, intervals cleared.");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}