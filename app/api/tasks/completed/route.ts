import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Task from "@/models/Task"

export async function GET() {
  await dbConnect()
  try {
    const completedTasks = await Task.find({
      completionApproved: true,
      finalStatus: "done",
      unposted: { $ne: true },
    })
    return NextResponse.json(completedTasks)
  } catch (error) {
    console.error("Error fetching completed tasks:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ message: "Failed to fetch completed tasks", error: errorMessage }, { status: 500 })
  }
}