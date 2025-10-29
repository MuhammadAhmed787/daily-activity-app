import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

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
      developer_attachments: developer_attachments.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      })),
      developer_rejection_solve_attachments: developer_rejection_solve_attachments.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      }))
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

    // Handle multiple file uploads for developer attachments
    if (developer_attachments && developer_attachments.length > 0) {
      console.log("Processing developer attachment uploads...");
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

      // Ensure uploads directory exists
      const uploadDir = join(process.cwd(), "public", "uploads");
      try {
        if (!existsSync(uploadDir)) {
          console.log("Creating uploads directory:", uploadDir);
          mkdirSync(uploadDir, { recursive: true });
        }
      } catch (dirError) {
        console.error("Error creating uploads directory:", dirError);
        return NextResponse.json(
          { message: "Failed to create uploads directory", error: dirError instanceof Error ? dirError.message : String(dirError) },
          { status: 500 }
        );
      }

      // Delete old attachments if they exist
      if (existingTask.developer_attachment && existingTask.developer_attachment.length > 0) {
        for (const oldAttachment of existingTask.developer_attachment) {
          const oldFilePath = join(process.cwd(), "public", oldAttachment);
          if (existsSync(oldFilePath)) {
            await unlink(oldFilePath);
            console.log("Deleted old file:", oldFilePath);
          }
        }
      }

      // Process and save new files
      const newAttachmentPaths: string[] = [];
      
      for (const file of developer_attachments) {
        if (file.size === 0) {
          console.log("Skipping empty file");
          continue;
        }

        if (!allowedTypes.includes(file.type)) {
          console.log("Invalid file type:", file.type);
          return NextResponse.json(
            { message: "Invalid file type. Allowed types: PDF, Word, Excel, JPEG, PNG, GIF, TXT" },
            { status: 400 }
          );
        }

        if (file.size > 5 * 1024 * 1024) {
          console.log("File size too large:", file.size);
          return NextResponse.json(
            { message: "File size exceeds 5MB limit" },
            { status: 400 }
          );
        }

        // Save file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = file.name.split(".").pop();
        const filename = `${uniqueSuffix}.${ext}`;
        const path = join(uploadDir, filename);

        console.log("Saving file to:", path);
        await writeFile(path, buffer);
        newAttachmentPaths.push(`/uploads/${filename}`);
      }

      updateData.developer_attachment = newAttachmentPaths;
      console.log("Files saved, attachment paths:", newAttachmentPaths);
    }

    // Handle multiple file uploads for rejection solve attachments
    if (developer_rejection_solve_attachments && developer_rejection_solve_attachments.length > 0) {
      console.log("Processing rejection solve attachment uploads...");
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

      // Ensure uploads directory exists
      const uploadDir = join(process.cwd(), "public", "uploads");
      try {
        if (!existsSync(uploadDir)) {
          console.log("Creating uploads directory:", uploadDir);
          mkdirSync(uploadDir, { recursive: true });
        }
      } catch (dirError) {
        console.error("Error creating uploads directory:", dirError);
        return NextResponse.json(
          { message: "Failed to create uploads directory", error: dirError instanceof Error ? dirError.message : String(dirError) },
          { status: 500 }
        );
      }

      // Delete old attachments if they exist
      if (existingTask.developer_rejection_solve_attachment && existingTask.developer_rejection_solve_attachment.length > 0) {
        for (const oldAttachment of existingTask.developer_rejection_solve_attachment) {
          const oldFilePath = join(process.cwd(), "public", oldAttachment);
          if (existsSync(oldFilePath)) {
            await unlink(oldFilePath);
            console.log("Deleted old rejection solve file:", oldFilePath);
          }
        }
      }

      // Process and save new files
      const newRejectionSolveAttachmentPaths: string[] = [];
      
      for (const file of developer_rejection_solve_attachments) {
        if (file.size === 0) {
          console.log("Skipping empty rejection solve file");
          continue;
        }

        if (!allowedTypes.includes(file.type)) {
          console.log("Invalid rejection solve file type:", file.type);
          return NextResponse.json(
            { message: "Invalid file type. Allowed types: PDF, Word, Excel, JPEG, PNG, GIF, TXT" },
            { status: 400 }
          );
        }

        if (file.size > 5 * 1024 * 1024) {
          console.log("Rejection solve file size too large:", file.size);
          return NextResponse.json(
            { message: "File size exceeds 5MB limit" },
            { status: 400 }
          );
        }

        // Save file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = file.name.split(".").pop();
        const filename = `rejection-solve-${uniqueSuffix}.${ext}`;
        const path = join(uploadDir, filename);

        console.log("Saving rejection solve file to:", path);
        await writeFile(path, buffer);
        newRejectionSolveAttachmentPaths.push(`/uploads/${filename}`);
      }

      updateData.developer_rejection_solve_attachment = newRejectionSolveAttachmentPaths;
      console.log("Rejection solve files saved, attachment paths:", newRejectionSolveAttachmentPaths);
    }

    console.log("Updating task with data:", updateData);

    // Update task
    const updatedTask = await Task.findOneAndUpdate(
      { _id: taskId },
      { $set: updateData },
      {
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
        upsert: false,
      }
    );

    if (!updatedTask) {
      console.log("Task not found for ID:", taskId);
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    // Convert to plain object
    const taskObject = updatedTask.toObject();

    console.log("Task updated successfully:", {
      taskId,
      developer_attachment: taskObject.developer_attachment,
      developer_rejection_solve_attachment: taskObject.developer_rejection_solve_attachment,
      developer_remarks,
      developer_rejection_remarks,
      developer_status,
      developer_done_date: taskObject.developer_done_date,
      developer_status_rejection: taskObject.developer_status_rejection,
    });

    return NextResponse.json({
      message: "Task status updated successfully",
      task: taskObject,
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