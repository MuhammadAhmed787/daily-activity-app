import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import { getGridFS } from "@/lib/gridfs";

export async function GET(req: Request) {
  await dbConnect();
  try {
    const url = new URL(req.url);
    const username = url.searchParams.get("username");

    if (!username) {
      return NextResponse.json({ message: "Username is required" }, { status: 400 });
    }

    // Get both assigned tasks and rejected tasks assigned to this user
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
      .populate("company.id")
      .populate("createdBy", "username");

    const tasksWithUsername = tasks.map((task) => ({
      ...task.toObject(),
      createdByUsername: task.createdBy?.username || "N/A",
    }));

    return NextResponse.json(tasksWithUsername);
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

    console.log("FormData received:", {
      taskId,
      developer_status,
      developer_remarks,
      developer_done_date,
      developer_status_rejection,
      developer_rejection_remarks,
      developer_attachments: developer_attachments.length,
      developer_rejection_solve_attachments: developer_rejection_solve_attachments.length
    });

    if (!taskId || !developer_status || !developer_remarks) {
      return NextResponse.json(
        { message: "Task ID, developer status, and remarks are required" },
        { status: 400 }
      );
    }

    if (!mongoose.isValidObjectId(taskId)) {
      console.log("Invalid taskId:", taskId);
      return NextResponse.json({ message: "Invalid task ID" }, { status: 400 });
    }

    const validStatuses = ["pending", "done", "not-done", "on-hold"];
    if (!validStatuses.includes(developer_status)) {
      return NextResponse.json(
        { message: `Invalid developer status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Check if task exists
    const existingTask = await Task.findById(taskId);
    if (!existingTask) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    // Get GridFS instance
    const gfs = await getGridFS();
    if (!gfs) {
      return NextResponse.json({ message: "File storage unavailable" }, { status: 500 });
    }

    // Prepare update data
    const updateData: any = {
      developer_status,
      developer_remarks,
      updatedAt: new Date(),
    };

    // Add developer completion date if provided
    if (developer_done_date) {
      updateData.developer_done_date = new Date(developer_done_date);
    }

    // Handle rejection status if provided
    if (developer_status_rejection) {
      updateData.developer_status_rejection = developer_status_rejection;
      
      // If it's a rejected task being fixed, update finalStatus
      if (developer_status_rejection === "fixed" && existingTask.finalStatus === "rejected") {
        updateData.finalStatus = "in-progress";
      }
    }

    // Handle rejection remarks if provided
    if (developer_rejection_remarks) {
      updateData.developer_rejection_remarks = developer_rejection_remarks;
    }

    // Allowed file types
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
      "application/json",
    ];

    const allowedExts = ["pdf", "jpg", "jpeg", "png", "gif", "xlsx", "xls", "doc", "docx", "txt", "csv", "json"];

    // Helper function to upload files to GridFS
    const uploadFilesToGridFS = async (files: File[], attachmentType: string) => {
      const uploadedIds: string[] = [];

      for (const file of files) {
        if (file.size === 0) {
          console.log("Skipping empty file");
          continue;
        }

        const name = file.name || `file_${Date.now()}`;
        const ext = name.split(".").pop()?.toLowerCase() || "";
        const allowedByExt = allowedExts.includes(ext);

        console.log(`Processing ${attachmentType} file:`, {
          name: file.name,
          type: file.type,
          size: file.size,
          ext: ext,
          allowedByType: allowedTypes.includes(file.type),
          allowedByExt: allowedByExt
        });

        if (!allowedTypes.includes(file.type) && !allowedByExt) {
          console.warn("Blocked file (disallowed type):", name, file.type);
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          console.warn("Skipped file (too large):", name, file.size);
          continue;
        }

        try {
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);

          const uploadStream = (gfs as any).openUploadStream
            ? (gfs as any).openUploadStream(name, {
                contentType: file.type || undefined,
                metadata: {
                  originalName: name,
                  uploadedAt: new Date(),
                  relatedTask: taskId,
                  attachmentType: attachmentType
                },
              })
            : null;

          if (!uploadStream) {
            throw new Error("GridFS upload not available");
          }

          await new Promise<void>((resolve, reject) => {
            uploadStream.end(buffer);
            uploadStream.on("finish", () => {
              console.log(`File uploaded to GridFS: ${uploadStream.id}, ${name}`);
              resolve();
            });
            uploadStream.on("error", (err: any) => {
              console.error(`Upload error for file ${name}:`, err);
              reject(err);
            });
          });

          uploadedIds.push(String(uploadStream.id));
        } catch (fileError) {
          console.error(`Error uploading file ${name}:`, fileError);
          continue;
        }
      }

      return uploadedIds;
    };

    // Handle multiple file uploads for developer attachments
    if (developer_attachments && developer_attachments.length > 0) {
      console.log(`Processing ${developer_attachments.length} developer attachment uploads...`);
      const uploadedIds = await uploadFilesToGridFS(developer_attachments, "developer");
      updateData.developer_attachment = uploadedIds;
      console.log(`Developer files uploaded: ${uploadedIds.length} files`);
    }

    // Handle multiple file uploads for rejection solve attachments
    if (developer_rejection_solve_attachments && developer_rejection_solve_attachments.length > 0) {
      console.log(`Processing ${developer_rejection_solve_attachments.length} rejection solve attachment uploads...`);
      const uploadedIds = await uploadFilesToGridFS(developer_rejection_solve_attachments, "developer_rejection_solve");
      updateData.developer_rejection_solve_attachment = uploadedIds;
      console.log(`Rejection solve files uploaded: ${uploadedIds.length} files`);
    }

    console.log("Updating task with data:", updateData);

    // Update task
    const updatedTask = await Task.findOneAndUpdate(
      { _id: taskId },
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedTask) {
      console.log("Task not found for ID:", taskId);
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    console.log("Task updated successfully:", {
      taskId: updatedTask._id,
      developer_status: updatedTask.developer_status,
      developer_attachment_count: updatedTask.developer_attachment?.length || 0,
      developer_rejection_solve_attachment_count: updatedTask.developer_rejection_solve_attachment?.length || 0,
    });

    return NextResponse.json({
      message: "Task status updated successfully",
      task: updatedTask,
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