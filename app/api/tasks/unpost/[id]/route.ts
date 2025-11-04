import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task, { ITask } from "@/models/Task";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, context: RouteContext) {
  await dbConnect();
  const { id: taskId } = await context.params;

  try {
    const formData = await req.formData();

    // Extract fields
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

    const existingTask = await Task.findById(taskId);
    if (!existingTask) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    // Normalize array for attachments
    const normalizeArray = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
      if (typeof value === "string" && value.trim() !== "") {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
          return [value].filter((item): item is string => typeof item === 'string' && item.trim() !== '');
        } catch {
          return [value].filter((item): item is string => typeof item === 'string' && item.trim() !== '');
        }
      }
      return [];
    };

    // Handle multiple file attachments
    const handleMultipleAttachments = async (
      newFiles: File[],
      existingFilePaths: unknown,
      fieldName: string
    ): Promise<{ filePaths: string[]; error?: string }> => {
      let filePaths: string[] = normalizeArray(existingFilePaths);

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

      for (const newFile of newFiles) {
        if (newFile.size > 0) {
          // Get file extension
          const ext = path.extname(newFile.name).toLowerCase();
          
          // Check if file type is allowed
          const isTypeAllowed = allowedTypes.includes(newFile.type);
          const isExtensionAllowed = allowedExtensions.includes(ext);
          
          if (!isTypeAllowed && !isExtensionAllowed) {
            return {
              filePaths,
              error: `File type not allowed for ${fieldName}. Allowed types: ${allowedExtensions.join(', ')}`,
            };
          }

          // Check file size (10MB limit)
          if (newFile.size > 10 * 1024 * 1024) {
            return {
              filePaths,
              error: `File size exceeds 10MB limit for ${fieldName}`,
            };
          }

          const bytes = await newFile.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const filename = `${uuidv4()}${ext}`;
          const filePath = `/uploads/tasks/${filename}`;
          const fullPath = path.join(process.cwd(), "public", filePath);

          await mkdir(path.dirname(fullPath), { recursive: true });
          await writeFile(fullPath, buffer);

          filePaths = [...filePaths, filePath];
        }
      }

      return { filePaths };
    };

    // Process file uploads
    const taskFiles = formData.getAll("TasksAttachment") as File[];
    const assignmentFiles = formData.getAll("assignmentAttachment") as File[];
    const completionFiles = formData.getAll("completionAttachment") as File[];
    const developerFiles = formData.getAll("developerAttachment") as File[];

    // Get existing attachments from form data
    const getExistingAttachments = (formData: FormData, fieldName: string): string[] => {
      const attachments: string[] = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith(fieldName) && typeof value === 'string') {
          attachments.push(value);
        }
      }
      return attachments.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    };

    const existingTasksAttachments = getExistingAttachments(formData, 'existingTasksAttachment');
    const existingAssignmentAttachments = getExistingAttachments(formData, 'existingAssignmentAttachment');
    const existingCompletionAttachments = getExistingAttachments(formData, 'existingCompletionAttachment');
    const existingDeveloperAttachments = getExistingAttachments(formData, 'existingDeveloperAttachment');

    // Handle file uploads with existing attachments
    const tasksAttachmentResult = await handleMultipleAttachments(
      taskFiles,
      existingTasksAttachments,
      "TasksAttachment"
    );
    if (tasksAttachmentResult.error)
      return NextResponse.json(
        { message: tasksAttachmentResult.error },
        { status: 400 }
      );

    const assignmentAttachmentResult = await handleMultipleAttachments(
      assignmentFiles,
      existingAssignmentAttachments,
      "assignmentAttachment"
    );
    if (assignmentAttachmentResult.error)
      return NextResponse.json(
        { message: assignmentAttachmentResult.error },
        { status: 400 }
      );

    const completionAttachmentResult = await handleMultipleAttachments(
      completionFiles,
      existingCompletionAttachments,
      "completionAttachment"
    );
    if (completionAttachmentResult.error)
      return NextResponse.json(
        { message: completionAttachmentResult.error },
        { status: 400 }
      );

    const developerAttachmentResult = await handleMultipleAttachments(
      developerFiles,
      existingDeveloperAttachments,
      "developer_attachment"
    );
    if (developerAttachmentResult.error)
      return NextResponse.json(
        { message: developerAttachmentResult.error },
        { status: 400 }
      );

    // Delete removed attachments from server
    const deleteRemovedAttachments = async (currentAttachments: string[], newAttachments: string[]) => {
      const attachmentsToDelete = currentAttachments.filter(attachment => !newAttachments.includes(attachment));
      
      for (const attachment of attachmentsToDelete) {
        try {
          // Only delete local files, not GridFS files
          if (attachment.startsWith('/uploads/')) {
            const fullPath = path.join(process.cwd(), "public", attachment);
            await unlink(fullPath);
            console.log(`Deleted attachment: ${attachment}`);
          }
        } catch (error) {
          console.error(`Error deleting attachment ${attachment}:`, error);
        }
      }
    };

    // Delete removed attachments for each type
    await deleteRemovedAttachments(
      normalizeArray(existingTask.TasksAttachment),
      tasksAttachmentResult.filePaths
    );
    
    await deleteRemovedAttachments(
      normalizeArray(existingTask.assignmentAttachment),
      assignmentAttachmentResult.filePaths
    );
    
    await deleteRemovedAttachments(
      normalizeArray(existingTask.completionAttachment),
      completionAttachmentResult.filePaths
    );
    
    await deleteRemovedAttachments(
      normalizeArray(existingTask.developer_attachment),
      developerAttachmentResult.filePaths
    );

    // Validate required fields
    if (!code && !existingTask.code) {
      return NextResponse.json({ message: "Code is required" }, { status: 400 });
    }
    if (!working && !existingTask.working) {
      return NextResponse.json({ message: "Working is required" }, { status: 400 });
    }
    if (!dateTime && !existingTask.dateTime) {
      return NextResponse.json({ message: "DateTime is required" }, { status: 400 });
    }

    // Parse company
    let companyData = existingTask.company;
    if (company) {
      try {
        const parsed = JSON.parse(company);
        companyData = {
          id: parsed.id ? new mongoose.Types.ObjectId(parsed.id) : existingTask.company.id,
          name: parsed.name || existingTask.company.name,
          city: parsed.city || existingTask.company.city,
          address: parsed.address || existingTask.company.address,
          companyRepresentative: parsed.companyRepresentative || existingTask.company.companyRepresentative || "",
          support: parsed.support || existingTask.company.support || "",
        };
      } catch (e) {
        console.error("Error parsing company:", e);
        // Keep existing company data if parsing fails
      }
    }

    // Parse contact
    let contactData = existingTask.contact;
    if (contact) {
      try {
        const parsed = JSON.parse(contact);
        contactData = {
          name: parsed.name || existingTask.contact.name,
          phone: parsed.phone || existingTask.contact.phone,
        };
      } catch (e) {
        console.error("Error parsing contact:", e);
        // Keep existing contact data if parsing fails
      }
    }

    // Parse assignedTo
    let assignedToData = existingTask.assignedTo;
    if (assignedTo && assignedTo !== "null" && assignedTo !== "") {
      try {
        if (typeof assignedTo === "string") {
          if (assignedTo.trim() && (assignedTo.startsWith("{") || assignedTo.startsWith("["))) {
            assignedToData = JSON.parse(assignedTo);
          } else {
            // If it's just an ID, find the developer
            const db = mongoose.connection.db;
if (!db) {
  // This means dbConnect() didn't produce a usable db — handle gracefully
  console.warn("mongoose.connection.db is not available when resolving assignedTo. Skipping assignedTo lookup.");
  assignedToData = undefined;
} else {
  const developer = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(assignedTo) });
  if (developer) {
    assignedToData = {
      id: developer._id.toString(),
      username: developer.username,
      name: developer.name,
      role: { name: developer.role?.name || "developer" },
    };
  } else {
    assignedToData = undefined;
  }
}
          }
        }
      } catch (e) {
        console.error("Error parsing assignedTo:", e, "Input:", assignedTo);
        // Keep existing assignedTo data if parsing fails
      }
    } else {
      assignedToData = undefined;
    }

    // Prepare update object
    const updateData: any = {
      code: code || existingTask.code,
      company: companyData,
      contact: contactData,
      working: working || existingTask.working,
      dateTime: dateTime ? new Date(dateTime) : existingTask.dateTime,
      status: status || existingTask.status,
      assigned: assigned === "true",
      approved: approved === "true",
      completionApproved: completionApproved === "true",
      unposted: unposted === "true",
      UnpostStatus: UnpostStatus || existingTask.UnpostStatus || "",
      TaskRemarks: TaskRemarks || existingTask.TaskRemarks || "",
      TasksAttachment: tasksAttachmentResult.filePaths,
      assignmentRemarks: assignmentRemarks || existingTask.assignmentRemarks || "",
      assignmentAttachment: assignmentAttachmentResult.filePaths,
      completionRemarks: completionRemarks || existingTask.completionRemarks || "",
      completionAttachment: completionAttachmentResult.filePaths,
      developer_remarks: developer_remarks || existingTask.developer_remarks || "",
      developer_status: developer_status || existingTask.developer_status || "pending",
      developer_attachment: developerAttachmentResult.filePaths,
      updatedAt: new Date(),
    };

    // Add optional fields if they exist
    if (assignedToData) updateData.assignedTo = assignedToData;
    if (approvedAt) updateData.approvedAt = new Date(approvedAt);
    if (assignedDate) updateData.assignedDate = new Date(assignedDate);
    if (unposted === "true") updateData.unpostedAt = new Date();

    // Update task
    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return NextResponse.json({ message: "Failed to update task" }, { status: 500 });
    }

    return NextResponse.json(updatedTask.toObject());
  } catch (error) {
    console.error("Error updating unpost task:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: "Failed to update task", error: errorMessage },
      { status: 500 }
    );
  }
}