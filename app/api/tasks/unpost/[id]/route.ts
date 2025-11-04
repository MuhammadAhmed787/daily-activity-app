import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";


// Define the context type for dynamic route parameters
interface RouteContext {
  params: Promise<{ id: string }>;
}

// Helper function to normalize arrays
const normalizeArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
  }
  if (typeof value === "string" && value.trim() !== "") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
      }
      return [value].filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    } catch {
      return [value].filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    }
  }
  return [];
};

// Helper function to upload files to GridFS
const uploadToGridFS = async (file: File): Promise<string> => {
  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection failed");
    }

    const bucket = new GridFSBucket(db, { bucketName: "uploads" });
    
    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(file.name, {
        contentType: file.type,
      });

      uploadStream.on("finish", () => {
        resolve(uploadStream.id.toString());
      });

      uploadStream.on("error", (error) => {
        reject(error);
      });

      uploadStream.end(buffer);
    });
  } catch (error) {
    console.error("Error uploading to GridFS:", error);
    throw error;
  }
};

// Helper function to handle file uploads (both local and GridFS)
const handleFileUploads = async (files: File[]): Promise<{ filePaths: string[]; errors: string[] }> => {
  const filePaths: string[] = [];
  const errors: string[] = [];

  // Define allowed file types and extensions
  const allowedTypes = [
    "application/pdf", 
    "image/jpeg", 
    "image/png", 
    "image/gif",
    "image/bmp",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "application/rtf",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation"
  ];

  const allowedExtensions = [
    '.txt', '.doc', '.docx', '.xls', '.xlsx', '.pdf', 
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.csv', 
    '.rtf', '.odt', '.ods', '.odp'
  ];

  for (const file of files) {
    if (file.size > 0) {
      try {
        // Get file extension
        const ext = path.extname(file.name).toLowerCase();
        
        // Check if file type is allowed
        const isTypeAllowed = allowedTypes.includes(file.type);
        const isExtensionAllowed = allowedExtensions.includes(ext);
        
        if (!isTypeAllowed && !isExtensionAllowed) {
          errors.push(`File type not allowed: ${file.name}. Allowed types: ${allowedExtensions.join(', ')}`);
          continue;
        }

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          errors.push(`File size exceeds 10MB limit: ${file.name}`);
          continue;
        }

        // Try to upload to GridFS first
        try {
          const fileId = await uploadToGridFS(file);
          filePaths.push(fileId);
        } catch (gridFSError) {
          console.warn(`GridFS upload failed for ${file.name}, falling back to local storage:`, gridFSError);
          
          // Fallback to local file system
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const filename = `${uuidv4()}${ext}`;
          const filePath = `/uploads/tasks/${filename}`;
          const fullPath = path.join(process.cwd(), "public", filePath);

          await mkdir(path.dirname(fullPath), { recursive: true });
          await writeFile(fullPath, buffer);

          filePaths.push(filePath);
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        errors.push(`Failed to process file: ${file.name}`);
      }
    }
  }

  return { filePaths, errors };
};

// Helper function to get existing attachments from form data
const getExistingAttachments = (formData: FormData, fieldName: string): string[] => {
  const attachments: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(fieldName) && typeof value === 'string') {
      attachments.push(value);
    }
  }
  return attachments.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
};

export async function PUT(req: Request, context: RouteContext) {
  await dbConnect();
  const { id: taskId } = await context.params;

  try {
    const formData = await req.formData();

    // Extract fields from form data
    const code = formData.get("code") as string | null;
    const company = formData.get("company") as string | null;
    const contact = formData.get("contact") as string | null;
    const working = formData.get("working") as string | null;
    const dateTime = formData.get("dateTime") as string | null;
    const status = formData.get("status") as string | null;
    const UnpostStatus = formData.get("UnpostStatus") as string | null;
    const assigned = formData.get("assigned") as string | null;
    const assignedTo = formData.get("assignedTo") as string | null;
    const approved = formData.get("approved") as string | null;
    const completionApproved = formData.get("completionApproved") as string | null;
    const unposted = formData.get("unposted") as string | null;
    const TaskRemarks = formData.get("TaskRemarks") as string | null;
    const assignmentRemarks = formData.get("assignmentRemarks") as string | null;
    const completionRemarks = formData.get("completionRemarks") as string | null;
    const developer_remarks = formData.get("developerRemarks") as string | null;
    const developer_status = formData.get("developerStatus") as string | null;
    const approvedAt = formData.get("approvedAt") as string | null;
    const assignedDate = formData.get("assignedDate") as string | null;

    if (!taskId) {
      return NextResponse.json({ message: "Missing taskId" }, { status: 400 });
    }

    // Find existing task
    const existingTask = await Task.findById(taskId);
    if (!existingTask) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    // Process file uploads
    const taskFiles = formData.getAll("TasksAttachment") as File[];
    const assignmentFiles = formData.getAll("assignmentAttachment") as File[];
    const completionFiles = formData.getAll("completionAttachment") as File[];
    const developerFiles = formData.getAll("developerAttachment") as File[];

    // Get existing attachments from form data
    const existingTasksAttachments = getExistingAttachments(formData, 'existingTasksAttachment');
    const existingAssignmentAttachments = getExistingAttachments(formData, 'existingAssignmentAttachment');
    const existingCompletionAttachments = getExistingAttachments(formData, 'existingCompletionAttachment');
    const existingDeveloperAttachments = getExistingAttachments(formData, 'existingDeveloperAttachment');

    // Handle file uploads with existing attachments
    const tasksAttachmentResult = await handleFileUploads(taskFiles);
    if (tasksAttachmentResult.errors.length > 0) {
      return NextResponse.json(
        { message: `File upload errors: ${tasksAttachmentResult.errors.join(', ')}` },
        { status: 400 }
      );
    }

    const assignmentAttachmentResult = await handleFileUploads(assignmentFiles);
    if (assignmentAttachmentResult.errors.length > 0) {
      return NextResponse.json(
        { message: `File upload errors: ${assignmentAttachmentResult.errors.join(', ')}` },
        { status: 400 }
      );
    }

    const completionAttachmentResult = await handleFileUploads(completionFiles);
    if (completionAttachmentResult.errors.length > 0) {
      return NextResponse.json(
        { message: `File upload errors: ${completionAttachmentResult.errors.join(', ')}` },
        { status: 400 }
      );
    }

    const developerAttachmentResult = await handleFileUploads(developerFiles);
    if (developerAttachmentResult.errors.length > 0) {
      return NextResponse.json(
        { message: `File upload errors: ${developerAttachmentResult.errors.join(', ')}` },
        { status: 400 }
      );
    }

    // Combine existing and new attachments
    const finalTaskAttachments = [...existingTasksAttachments, ...tasksAttachmentResult.filePaths];
    const finalAssignmentAttachments = [...existingAssignmentAttachments, ...assignmentAttachmentResult.filePaths];
    const finalCompletionAttachments = [...existingCompletionAttachments, ...completionAttachmentResult.filePaths];
    const finalDeveloperAttachments = [...existingDeveloperAttachments, ...developerAttachmentResult.filePaths];

    // Validate required fields
    if (!code && !existingTask.code) {
      return NextResponse.json({ message: "Code is required" }, { status: 400 });
    }
    if (!working && !existingTask.working) {
      return NextResponse.json({ message: "Work description is required" }, { status: 400 });
    }
    if (!dateTime && !existingTask.dateTime) {
      return NextResponse.json({ message: "Date and time is required" }, { status: 400 });
    }

    // Parse company data
    let companyData = existingTask.company;
    if (company) {
      try {
        const parsedCompany = JSON.parse(company);
        companyData = {
          id: parsedCompany.id ? new mongoose.Types.ObjectId(parsedCompany.id) : existingTask.company.id,
          name: parsedCompany.name || existingTask.company.name,
          city: parsedCompany.city || existingTask.company.city,
          address: parsedCompany.address || existingTask.company.address,
          companyRepresentative: parsedCompany.companyRepresentative || existingTask.company.companyRepresentative || "",
          support: parsedCompany.support || existingTask.company.support || "",
        };
      } catch (e) {
        console.error("Error parsing company data:", e);
        // Keep existing company data if parsing fails
      }
    }

    // Parse contact data
    let contactData = existingTask.contact;
    if (contact) {
      try {
        const parsedContact = JSON.parse(contact);
        contactData = {
          name: parsedContact.name || existingTask.contact.name,
          phone: parsedContact.phone || existingTask.contact.phone,
        };
      } catch (e) {
        console.error("Error parsing contact data:", e);
        // Keep existing contact data if parsing fails
      }
    }

    // Parse assignedTo data
    let assignedToData = existingTask.assignedTo;
    if (assignedTo && assignedTo !== "null" && assignedTo !== "" && assignedTo !== "unassigned") {
      try {
        if (typeof assignedTo === "string") {
          if (assignedTo.trim() && (assignedTo.startsWith("{") || assignedTo.startsWith("["))) {
            // It's a JSON string
            assignedToData = JSON.parse(assignedTo);
          } else {
            // It's a user ID, try to find the user
            const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({}, { strict: false }));

// Use lean() to get a plain object, then defensively check its shape.
// Some mongoose typings or older model definitions can cause the result
// to be typed as `T | T[]`, so we check for arrays and the presence of `_id`.
const maybeUser = await User.findById(assignedTo).lean();

if (maybeUser && !Array.isArray(maybeUser) && typeof maybeUser === "object" && "_id" in maybeUser) {
  // Narrowed at runtime, safe to access properties
  const userObj = maybeUser as { _id: { toString(): string }; username?: string; name?: string; role?: { name?: string } };

  assignedToData = {
    id: userObj._id.toString(),
    username: userObj.username || "unknown",
    name: userObj.name || "Unknown",
    role: { name: userObj.role?.name || "user" },
  };
} else {
  // If not found, or unexpected shape, clear assignedToData
  assignedToData = undefined;
}
          }
        }
      } catch (e) {
        console.error("Error parsing assignedTo data:", e);
        // Keep existing assignedTo data if parsing fails
      }
    } else {
      // Clear assignedTo if unassigned or empty
      assignedToData = undefined;
    }

    // Prepare update data
    const updateData: any = {
      code: code || existingTask.code,
      company: companyData,
      contact: contactData,
      working: working || existingTask.working,
      dateTime: dateTime ? new Date(dateTime) : existingTask.dateTime,
      status: status || "unposted",
      assigned: assigned === "true",
      approved: approved === "true",
      completionApproved: completionApproved === "true",
      unposted: unposted === "true",
      UnpostStatus: UnpostStatus || "unposted",
      TaskRemarks: TaskRemarks || existingTask.TaskRemarks || "",
      TasksAttachment: finalTaskAttachments,
      assignmentRemarks: assignmentRemarks || existingTask.assignmentRemarks || "",
      assignmentAttachment: finalAssignmentAttachments,
      completionRemarks: completionRemarks || existingTask.completionRemarks || "",
      completionAttachment: finalCompletionAttachments,
      developer_remarks: developer_remarks || existingTask.developer_remarks || "",
      developer_status: developer_status || existingTask.developer_status || "pending",
      developer_attachment: finalDeveloperAttachments,
      updatedAt: new Date(),
    };

    // Add optional fields if they exist
    if (assignedToData) updateData.assignedTo = assignedToData;
    if (approvedAt) updateData.approvedAt = new Date(approvedAt);
    if (assignedDate) updateData.assignedDate = new Date(assignedDate);
    if (unposted === "true") {
      updateData.unpostedAt = new Date();
      updateData.finalStatus = "unposted";
    }

    // Validate status and developer_status
    const validStatuses = ["pending", "assigned", "approved", "completed", "on-hold", "unposted", "in-progress", "rejected"];
    if (updateData.status && !validStatuses.includes(updateData.status)) {
      return NextResponse.json(
        { message: `Invalid status: must be one of ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const validDeveloperStatuses = ["pending", "done", "not-done", "on-hold"];
    if (updateData.developer_status && !validDeveloperStatuses.includes(updateData.developer_status)) {
      return NextResponse.json(
        { message: `Invalid developer_status: must be one of ${validDeveloperStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Update the task
    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedTask) {
      return NextResponse.json({ message: "Failed to update task" }, { status: 500 });
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Error updating unpost task:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: "Failed to update task", error: errorMessage },
      { status: 500 }
    );
  }
}

// Also add GET method to fetch a single task
export async function GET(req: Request, context: RouteContext) {
  await dbConnect();
  const { id: taskId } = await context.params;

  try {
    if (!taskId) {
      return NextResponse.json({ message: "Missing taskId" }, { status: 400 });
    }

    const task = await Task.findById(taskId).lean();
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: "Failed to fetch task", error: errorMessage },
      { status: 500 }
    );
  }
}