import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Task from "@/models/Task"
import CompanyInformation from "@/models/CompanyInformation"
import { writeFile, mkdir, readFile } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import archiver from "archiver"
import { createWriteStream, existsSync } from "fs"

export async function PUT(req: Request) {
  await dbConnect()

  try {
    const formData = await req.formData()
    console.log("Received form data fields:")
    for (const [key, value] of formData.entries()) {
      console.log(`${key}: ${value instanceof File ? `File (${value.name}, ${value.size} bytes)` : value}`)
    }

    const taskId = formData.get("taskId") as string
    const userId = formData.get("userId") as string
    const username = formData.get("username") as string
    const name = formData.get("name") as string
    const roleName = formData.get("roleName") as string
    const assignedDate = formData.get("assignedDate") as string
    const remarks = formData.get("remarks") as string
    const files = formData.getAll("files") as File[]

    // Validate required fields
    if (!taskId || !userId) {
      return NextResponse.json({ message: "taskId and userId are required" }, { status: 400 })
    }

    // Process multiple files
    const filePaths: string[] = []
    for (const file of files) {
      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const ext = path.extname(file.name)
        const filename = `${uuidv4()}${ext}`
        const filePath = `/uploads/tasks/${filename}`
        const fullPath = path.join(process.cwd(), "public", filePath)
        
        await mkdir(path.dirname(fullPath), { recursive: true })
        await writeFile(fullPath, buffer)
        filePaths.push(filePath)
        console.log("File saved at:", fullPath)
      }
    }

    // Find task to verify it exists and get company info
    const task = await Task.findById(taskId)
    if (!task) {
      console.error("Task not found:", taskId)
      return NextResponse.json({ message: "Task not found" }, { status: 404 })
    }

    // Get company information to extract software type
    let softwareType = "N/A"
    if (task.company && task.company.id) {
      const companyInfo = await CompanyInformation.findById(task.company.id)
      if (companyInfo && companyInfo.softwareInformation && companyInfo.softwareInformation.length > 0) {
        softwareType = companyInfo.softwareInformation[0].softwareType || "N/A"
      }
    }

    // Update data
    const updateData = {
      assigned: true,
      approved: true,
      assignedTo: {
        id: userId,
        username,
        name,
        role: { name: roleName },
      },
      assignedDate: new Date(assignedDate),
      assignmentRemarks: remarks || "",
      assignmentAttachment: filePaths,
      status: "assigned",
      approvedAt: new Date(),
      softwareType: softwareType // Add software type to task
    }

    console.log("Updating task with data:", updateData)

    // Perform update
    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean()

    console.log("Task after update:", updatedTask)

    return NextResponse.json(updatedTask)
  } catch (error: any) {
    console.error("Error assigning task:", error)
    return NextResponse.json(
      { message: "Failed to assign task", error: error.message },
      { status: 500 }
    )
  }
}

// New endpoint to download all attachments as zip
export async function GET(req: Request) {
  await dbConnect()
  
  try {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')
    
    if (!taskId) {
      return NextResponse.json({ message: "taskId is required" }, { status: 400 })
    }
    
    const task = await Task.findById(taskId)
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 })
    }
    
    // Create a zip file containing all attachments
    const zipFileName = `task-${task.code}-attachments.zip`
    const zipFilePath = path.join(process.cwd(), 'tmp', zipFileName)
    
    // Ensure tmp directory exists
    await mkdir(path.dirname(zipFilePath), { recursive: true })
    
    const output = createWriteStream(zipFilePath)
    const archive = archiver('zip', {
      zlib: { level: 9 }
    })
    
    archive.pipe(output)
    
    // Add all task attachments to the zip
    if (task.TasksAttachment && task.TasksAttachment.length > 0) {
      for (const attachment of task.TasksAttachment) {
        const filePath = path.join(process.cwd(), 'public', attachment)
        if (existsSync(filePath)) {
          archive.file(filePath, { name: path.basename(attachment) })
        }
      }
    }
    
    await archive.finalize()
    
    // Wait for the file to be completely written
    await new Promise<void>((resolve) => {
      output.on('close', () => resolve());
    });
    
    // Read the zip file into a buffer
    const zipBuffer = await readFile(zipFilePath)
    
    // Convert the buffer to a Uint8Array which is compatible with Blob
    const uint8Array = new Uint8Array(zipBuffer)
    
    // Return the blob as a response
    return new Response(uint8Array, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Content-Length': uint8Array.length.toString(),
      }
    })
  } catch (error: any) {
    console.error("Error creating zip file:", error)
    return NextResponse.json(
      { message: "Failed to create zip file", error: error.message },
      { status: 500 }
    )
  }
}