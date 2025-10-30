import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import { getGridFS } from "@/lib/gridfs";

// Define proper types
interface MinimalTask {
  _id: mongoose.Types.ObjectId;
  finalStatus?: string;
}

export async function GET(req: Request) {
  await dbConnect();
  try {
    const url = new URL(req.url);
    const username = url.searchParams.get("username");

    if (!username) {
      return NextResponse.json({ message: "Username is required" }, { status: 400 });
    }

    // Optimized query with proper typing
    const tasks = await Task.find({
      "assignedTo.username": username,
      $or: [
        {
          status: "assigned",
          developer_status: { $ne: "done" },
          finalStatus: { $ne: "done" }
        },
        {
          finalStatus: "rejected",
          developer_status_rejection: { $ne: "fixed" }
        }
      ]
    })
      .populate("company.id", "name city address")
      .populate("createdBy", "username")
      .select("code company working priority status developer_status finalStatus assignedTo createdAt assignedDate TasksAttachment assignmentAttachment developer_attachment developer_rejection_solve_attachment developer_remarks developer_rejection_remarks developer_done_date developer_status_rejection rejectionRemarks rejectionAttachment")
      .lean();

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching developer tasks:", error);
    return NextResponse.json(
      {
        message: "Failed to fetch tasks",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Fixed upload function with proper typing
const uploadFilesToGridFS = async (files: File[], taskId: string, type: string): Promise<string[]> => {
  if (!files.length) return [];

  const gfs = await getGridFS();
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "image/gif",
    "text/plain",
  ];

  const uploadedIds: string[] = [];
  const concurrencyLimit = 4;
  
  for (let i = 0; i < files.length; i += concurrencyLimit) {
    const batch = files.slice(i, i + concurrencyLimit);
    
    const batchPromises = batch.map(async (file): Promise<string | null> => {
      try {
        // Quick validation
        if (file.size === 0 || file.size > 5 * 1024 * 1024) return null;
        if (!allowedTypes.includes(file.type)) return null;

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadStream = (gfs as any).openUploadStream
          ? (gfs as any).openUploadStream(file.name, {
              contentType: file.type,
              metadata: {
                originalName: file.name,
                uploadedAt: new Date(),
                relatedTask: taskId,
                attachmentType: type
              },
            })
          : null;

        if (!uploadStream) return null;

        return new Promise<string>((resolve, reject) => {
          uploadStream.end(buffer);
          uploadStream.on("finish", () => resolve(String(uploadStream.id)));
          uploadStream.on("error", (err: any) => reject(err));
        });
      } catch {
        return null;
      }
    });

    const batchResults = await Promise.allSettled(batchPromises);
    
    // Type-safe result handling
    const successfulUploads = batchResults
      .filter((result): result is PromiseFulfilledResult<string | null> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter((id): id is string => id !== null);
    
    uploadedIds.push(...successfulUploads);
  }

  return uploadedIds;
};

export async function PUT(req: Request) {
  await dbConnect();
  
  try {
    const formData = await req.formData();
    const taskId = formData.get("taskId") as string;
    const developer_status = formData.get("developer_status") as string;
    const developer_remarks = formData.get("developer_remarks") as string;
    const developer_done_date = formData.get("developer_done_date") as string;
    const developer_status_rejection = formData.get("developer_status_rejection") as string;
    const developer_rejection_remarks = formData.get("developer_rejection_remarks") as string || '';
    const developer_attachments = formData.getAll("developer_attachments") as File[];
    const developer_rejection_solve_attachments = formData.getAll("developer_rejection_solve_attachments") as File[];

    // Quick validation
    if (!taskId || !developer_status || !developer_remarks) {
      return NextResponse.json(
        { message: "Task ID, developer status, and remarks are required" },
        { status: 400 }
      );
    }

    if (!mongoose.isValidObjectId(taskId)) {
      return NextResponse.json({ message: "Invalid task ID" }, { status: 400 });
    }

    // Check if task exists quickly with proper typing
    const existingTask = await Task.findById(taskId).select("_id finalStatus").lean() as MinimalTask | null;
    if (!existingTask) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    // Upload files in parallel for maximum speed
    const [developerAttachmentIds, developerRejectionSolveAttachmentIds] = await Promise.all([
      uploadFilesToGridFS(developer_attachments, taskId, 'developer'),
      uploadFilesToGridFS(developer_rejection_solve_attachments, taskId, 'developer_rejection_solve')
    ]);

    // Prepare update data
    const updateData: any = {
      developer_status,
      developer_remarks,
      updatedAt: new Date(),
    };

    // Add optional fields if provided
    if (developer_done_date) updateData.developer_done_date = new Date(developer_done_date);
    if (developer_status_rejection) {
      updateData.developer_status_rejection = developer_status_rejection;
      // Fixed: Use optional chaining and type-safe check
      if (developer_status_rejection === "fixed" && existingTask.finalStatus === "rejected") {
        updateData.finalStatus = "in-progress";
      }
    }
    if (developer_rejection_remarks) updateData.developer_rejection_remarks = developer_rejection_remarks;
    if (developerAttachmentIds.length > 0) updateData.developer_attachment = developerAttachmentIds;
    if (developerRejectionSolveAttachmentIds.length > 0) updateData.developer_rejection_solve_attachment = developerRejectionSolveAttachmentIds;

    // Fast update without returning full document
    const updateResult = await Task.updateOne(
      { _id: taskId },
      { $set: updateData }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Task status updated successfully",
      taskId: taskId,
      success: true
    });

  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      {
        message: "Failed to update task",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}