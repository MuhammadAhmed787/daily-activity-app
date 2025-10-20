import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Task from "@/models/Task"

export async function POST(req: Request) {
  await dbConnect()

  try {
    const { taskId, remarks } = await req.json()
    console.log("Test API received:", { taskId, remarks })

    if (!taskId || remarks === undefined) {
      return NextResponse.json({ message: "taskId and remarks are required" }, { status: 400 })
    }

    // Find task to verify it exists
    const task = await Task.findById(taskId)
    if (!task) {
      console.error("Task not found:", taskId)
      return NextResponse.json({ message: "Task not found" }, { status: 404 })
    }
    console.log("Existing task:", task)

    // Update only assignmentRemarks
    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { $set: { assignmentRemarks: remarks || "" } },
      { new: true, runValidators: true }
    ).lean()

    console.log("Updated task:", updatedTask)

    return NextResponse.json(updatedTask)
  } catch (error: any) {
    console.error("Error updating remarks:", error)
    return NextResponse.json(
      { message: "Failed to update remarks", error: error.message },
      { status: 500 }
    )
  }
}