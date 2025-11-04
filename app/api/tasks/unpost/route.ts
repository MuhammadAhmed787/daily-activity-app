import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Task from "@/models/Task"
import jwt from "jsonwebtoken"

export async function PUT(req: Request) {
  await dbConnect()
  
  try {
    const { taskIds } = await req.json()

    // Validate taskIds
    if (!taskIds || (Array.isArray(taskIds) && taskIds.length === 0) || (!Array.isArray(taskIds) && !taskIds)) {
      return NextResponse.json({ message: "Invalid or empty taskIds" }, { status: 400 })
    }

    // Convert single taskId to array for consistent processing
    const ids = Array.isArray(taskIds) ? taskIds : [taskIds]

    // Verify user permissions
    const authHeader = req.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized: Missing or invalid Authorization header" },
        { status: 401 }
      )
    }

    const token = authHeader.replace("Bearer ", "")
    let decoded: any
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "your-default-secret")
    } catch (error) {
      return NextResponse.json(
        { message: "Unauthorized: Invalid token" },
        { status: 401 }
      )
    }

    if (!decoded?.role?.permissions?.includes("tasks.unpost")) {
      return NextResponse.json(
        { message: "Unauthorized: Missing or insufficient permissions" },
        { status: 403 }
      )
    }

    // Update tasks
    const updatedTasks = await Task.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          unposted: true,
          unpostedAt: new Date(),
          status: "unposted",
          finalStatus: "unposted",
          updatedAt: new Date(),
        }
      }
    )

    return NextResponse.json({
      message: "Tasks unposted successfully",
      modifiedCount: updatedTasks.modifiedCount,
    })
  } catch (error) {
    console.error("Error unposting tasks:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ message: "Failed to unpost tasks", error: errorMessage }, { status: 500 })
  }
}

// Also add a GET method to fetch unposted tasks if needed
export async function GET(req: Request) {
  await dbConnect()
  
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || "completed"

    // Verify user permissions
    const authHeader = req.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized: Missing or invalid Authorization header" },
        { status: 401 }
      )
    }

    const token = authHeader.replace("Bearer ", "")
    let decoded: any
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "your-default-secret")
    } catch (error) {
      return NextResponse.json(
        { message: "Unauthorized: Invalid token" },
        { status: 401 }
      )
    }

    if (!decoded?.role?.permissions?.includes("tasks.unpost")) {
      return NextResponse.json(
        { message: "Unauthorized: Missing or insufficient permissions" },
        { status: 403 }
      )
    }

    const tasks = await Task.find({ status })
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Error fetching tasks:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ message: "Failed to fetch tasks", error: errorMessage }, { status: 500 })
  }
}