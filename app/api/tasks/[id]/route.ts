// app/api/tasks/[id]/route.ts
import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Task from "@/models/Task"
import { writeFile, mkdir, unlink, rm } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import mongoose from "mongoose"
import { getGridFS } from "@/lib/gridfs"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const taskId = id;

  try {
    const contentType = req.headers.get("content-type") || "";
    
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { message: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await req.formData();

    console.log("Received form data fields:");
    for (const [key, value] of formData.entries()) {
      console.log(`${key}: ${value instanceof File ? `File (${value.name}, ${value.size} bytes)` : value}`);
    }

    // Determine update type
    const isCompletionUpdate = formData.has("completionApproved");
    
    if (isCompletionUpdate) {
      return handleCompletionUpdate(taskId, formData);
    } else {
      return handleGeneralUpdate(taskId, formData);
    }
  } catch (error: any) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { message: "Failed to update task", error: error.message },
      { status: 500 }
    );
  }
}

// Handle general task updates
async function handleGeneralUpdate(taskId: string, formData: FormData) {
  // Parse form data
  const code = formData.get("code") as string;
  const company = formData.get("company") as string;
  const contact = formData.get("contact") as string;
  const working = formData.get("working") as string;
  const dateTime = formData.get("dateTime") as string;
  const priority = formData.get("priority") as string;
  const status = formData.get("status") as string;
  const assigned = formData.get("assigned") as string;
  const assignedTo = formData.get("assignedTo") as string | null;
  const approved = formData.get("approved") as string;
  const unposted = formData.get("unposted") as string;
  const TaskRemarks = formData.get("TaskRemarks") as string | null;
  const existingAttachments = formData.getAll("existingAttachments") as string[];
  const newAttachmentsCount = parseInt(formData.get("newAttachmentsCount") as string) || 0;

  // Validate required fields
  if (!taskId || !code || !company || !contact || !working || !dateTime || !status) {
    return NextResponse.json(
      { message: "Missing required fields" },
      { status: 400 }
    );
  }

  // Find existing task to handle file deletion
  const existingTask = await Task.findById(taskId);
  if (!existingTask) {
    return NextResponse.json({ message: "Task not found" }, { status: 404 });
  }

  let filePaths = existingAttachments || [];

  // Handle new file uploads
  if (newAttachmentsCount > 0) {
    // Get the task folder path from existing attachments
    let taskFolder = "";
    if (existingTask.TasksAttachment && existingTask.TasksAttachment.length > 0) {
      const firstAttachment = existingTask.TasksAttachment[0];
      taskFolder = firstAttachment.split('/').slice(0, -1).join('/');
    } else {
      // Create a new folder for this task
      taskFolder = `/uploads/task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    
    const uploadDir = path.join(process.cwd(), "public", taskFolder);
    
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      console.error("Error creating directory:", error);
      return NextResponse.json({ message: "Failed to create upload directory" }, { status: 500 });
    }

    for (let i = 0; i < newAttachmentsCount; i++) {
      const file = formData.get(`newAttachments_${i}`) as File | null;
      
      if (file && file.size > 0) {
        // Validate file type
        const allowedTypes = [
          "application/pdf", 
          "image/jpeg", 
          "image/png", 
          "image/gif",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain"
        ];
        
        if (!allowedTypes.includes(file.type) && 
            !file.name.endsWith('.xlsx') && 
            !file.name.endsWith('.xls') && 
            !file.name.endsWith('.doc') && 
            !file.name.endsWith('.docx') &&
            !file.name.endsWith('.txt')) {
          return NextResponse.json({ message: "Only PDF, image, Excel, Word, and text files are allowed" }, { status: 400 });
        }

        // Check file size
        if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json({ message: "File size exceeds 10MB" }, { status: 400 });
        }

        // Write to uploads directory
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const fullPath = path.join(uploadDir, filename);
        
        await writeFile(fullPath, buffer);
        filePaths.push(`${taskFolder}/${filename}`);
      }
    }
  }

  // Prepare update data
  const updateData = {
    code,
    company: JSON.parse(company),
    contact: JSON.parse(contact),
    working,
    dateTime,
    priority,
    status,
    assigned: assigned === "true",
    assignedTo: assignedTo ? JSON.parse(assignedTo) : null,
    approved: approved === "true",
    unposted: unposted === "true",
    TaskRemarks: TaskRemarks || "",
    TasksAttachment: filePaths,
  };

  console.log("Updating task with data:", updateData);

  const updatedTask = await Task.findByIdAndUpdate(
    taskId,
    updateData,
    { new: true, runValidators: true }
  ).lean();

  console.log("Task after update:", updatedTask);
  return NextResponse.json(updatedTask);
}

// Handle completion approval updates
async function handleCompletionUpdate(taskId: string, formData: FormData) {
  const completionApproved = formData.get("completionApproved") === "true";
  const completionApprovedAt = formData.get("completionApprovedAt") as string;
  const finalStatus = formData.get("finalStatus") as string;
  const status = formData.get("status") as string;
  const completionRemarks = formData.get("completionRemarks") as string;
  const rejectionRemarks = formData.get("rejectionRemarks") as string;
  const timeTaken = formData.get("timeTaken") as string;
  
  // Get all attachment files (multiple files with same field name)
  const completionAttachmentFiles: File[] = [];
  const rejectionAttachmentFiles: File[] = [];
  
  // Extract all files from form data
  for (const [key, value] of formData.entries()) {
    if (value instanceof File && value.size > 0) {
      if (key === "completionAttachment") {
        completionAttachmentFiles.push(value);
      } else if (key === "rejectionAttachment") {
        rejectionAttachmentFiles.push(value);
      }
    }
  }

  // Validate required fields
  if (!taskId || !finalStatus || !status) {
    return NextResponse.json(
      { message: "Missing required fields for completion approval" },
      { status: 400 }
    );
  }

  // Find existing task to handle file deletion
  const existingTask = await Task.findById(taskId);
  if (!existingTask) {
    return NextResponse.json({ message: "Task not found" }, { status: 404 });
  }

  let completionAttachmentPaths: string[] = existingTask.completionAttachment || [];
  let rejectionAttachmentPaths: string[] = existingTask.rejectionAttachment || [];

  // Handle new completion files - USE GRIDFS FOR CONSISTENCY
  if (completionAttachmentFiles.length > 0) {
    completionAttachmentPaths = [];
    const gfs = await getGridFS();

    for (const file of completionAttachmentFiles) {
      // Validate file type
      const allowedTypes = [
        "application/pdf", 
        "image/jpeg", 
        "image/png", 
        "image/gif",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
      ];
      
      if (!allowedTypes.includes(file.type) && 
          !file.name.endsWith('.xlsx') && 
          !file.name.endsWith('.xls') && 
          !file.name.endsWith('.doc') && 
          !file.name.endsWith('.docx') &&
          !file.name.endsWith('.txt')) {
        return NextResponse.json({ message: "Only PDF, image, Excel, Word, and text files are allowed" }, { status: 400 });
      }

      // Check file size
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ message: "File size exceeds 10MB" }, { status: 400 });
      }

      // Use GridFS for consistency with other file uploads
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadStream = gfs.openUploadStream(file.name, {
        contentType: file.type || "application/octet-stream",
        metadata: {
          originalName: file.name,
          uploadedAt: new Date(),
          taskId: taskId,
          attachmentType: 'completion'
        },
      });

      await new Promise<void>((resolve, reject) => {
        uploadStream.end(buffer);
        uploadStream.on("finish", () => resolve());
        uploadStream.on("error", (err) => reject(err));
      });

      completionAttachmentPaths.push(uploadStream.id.toString());
    }
  }

  // Handle new rejection files - USE GRIDFS FOR CONSISTENCY
  if (rejectionAttachmentFiles.length > 0) {
    rejectionAttachmentPaths = [];
    const gfs = await getGridFS();

    for (const file of rejectionAttachmentFiles) {
      // Validate file type
      const allowedTypes = [
        "application/pdf", 
        "image/jpeg", 
        "image/png", 
        "image/gif",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
      ];
      
      if (!allowedTypes.includes(file.type) && 
          !file.name.endsWith('.xlsx') && 
          !file.name.endsWith('.xls') && 
          !file.name.endsWith('.doc') && 
          !file.name.endsWith('.docx') &&
          !file.name.endsWith('.txt')) {
        return NextResponse.json({ message: "Only PDF, image, Excel, Word, and text files are allowed" }, { status: 400 });
      }

      // Check file size
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ message: "File size exceeds 10MB" }, { status: 400 });
      }

      // Use GridFS for consistency
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadStream = gfs.openUploadStream(file.name, {
        contentType: file.type || "application/octet-stream",
        metadata: {
          originalName: file.name,
          uploadedAt: new Date(),
          taskId: taskId,
          attachmentType: 'rejection'
        },
      });

      await new Promise<void>((resolve, reject) => {
        uploadStream.end(buffer);
        uploadStream.on("finish", () => resolve());
        uploadStream.on("error", (err) => reject(err));
      });

      rejectionAttachmentPaths.push(uploadStream.id.toString());
    }
  }

  // Prepare update data
  const updateData: any = {
    completionApproved,
    completionApprovedAt: completionApprovedAt ? new Date(completionApprovedAt) : new Date(),
    finalStatus,
    status,
  };

  // Add appropriate remarks and attachments based on status
  if (finalStatus === "rejected") {
    updateData.rejectionRemarks = rejectionRemarks || "";
    updateData.rejectionAttachment = rejectionAttachmentPaths;
  } else {
    updateData.completionRemarks = completionRemarks || "";
    updateData.completionAttachment = completionAttachmentPaths;
  }

  // Add time taken if provided
  if (timeTaken) {
    updateData.timeTaken = parseInt(timeTaken);
  }

  console.log("Updating task completion with data:", updateData);

  const updatedTask = await Task.findByIdAndUpdate(
    taskId,
    { $set: updateData },
    { new: true, runValidators: true }
  ).lean();

  console.log("Task after completion approval:", updatedTask);
  return NextResponse.json(updatedTask);
}

// ... rest of your DELETE and GET methods remain the same
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  try {
    const { id } = await params;
    const task = await Task.findById(id);
    
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }
    
    // Delete attachments folder
    if (task.TasksAttachment && task.TasksAttachment.length > 0) {
      const firstAttachment = task.TasksAttachment[0];
      const folderPath = path.join(
        process.cwd(),
        "public",
        firstAttachment.split('/').slice(0, -1).join('/')
      );
      
      try {
        await rm(folderPath, { recursive: true, force: true });
        console.log("Deleted attachments folder:", folderPath);
      } catch (error) {
        console.error("Error deleting attachments folder:", error);
      }
    }
    
    // Handle completion attachment (could be string or array)
    if (task.completionAttachment) {
      // Normalize to array
      const attachments = Array.isArray(task.completionAttachment)
        ? task.completionAttachment
        : [task.completionAttachment];

      // Delete all completion attachments
      for (const attachment of attachments) {
        if (typeof attachment === 'string') {
          const filePath = path.join(process.cwd(), "public", attachment);
          await unlink(filePath).catch(error => 
            console.error(`Error deleting file ${filePath}:`, error)
          );
        }
      }
    }

    // Handle rejection attachment (could be string or array)
    if (task.rejectionAttachment) {
      // Normalize to array
      const attachments = Array.isArray(task.rejectionAttachment)
        ? task.rejectionAttachment
        : [task.rejectionAttachment];

      // Delete all rejection attachments
      for (const attachment of attachments) {
        if (typeof attachment === 'string') {
          const filePath = path.join(process.cwd(), "public", attachment);
          await unlink(filePath).catch(error => 
            console.error(`Error deleting file ${filePath}:`, error)
          );
        }
      }
    }
    
    await Task.findByIdAndDelete(id);
    
    return NextResponse.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { 
        message: "Failed to delete task", 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  try {
    const { id } = await params;
    
    const task = await Task.findById(id);
    
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }
    
    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { 
        message: "Failed to fetch task", 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}