// app/api/tasks/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
// ensure CompanyInformation model is registered
import "@/models/CompanyInformation";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { getGridFS } from "@/lib/gridfs";

export async function GET(req: Request) {
  await dbConnect();

  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("id");
    const fileId = url.searchParams.get("fileId"); // used to download files directly

    // ------------- File download via GridFS -------------
    if (fileId) {
      // Validate fileId
      if (!mongoose.Types.ObjectId.isValid(fileId)) {
        return NextResponse.json({ message: "Invalid fileId" }, { status: 400 });
      }

      const gfs = await getGridFS();

      // Find file metadata
      const files = await gfs.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
      if (!files || files.length === 0) {
        return NextResponse.json({ message: "File not found" }, { status: 404 });
      }

      const fileDoc = files[0];
      const downloadStream = gfs.openDownloadStream(new mongoose.Types.ObjectId(fileId));

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        downloadStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        downloadStream.on("end", () => resolve());
        downloadStream.on("error", (err) => reject(err));
      });

      const buffer = Buffer.concat(chunks);
      const headers = new Headers();
      headers.set("Content-Type", fileDoc.contentType || "application/octet-stream");
      // Attachment header so browser will download; use original filename if present
      headers.set(
        "Content-Disposition",
        `attachment; filename="${fileDoc.filename?.replace(/"/g, "") || "file"}"`
      );

      return new Response(buffer, { status: 200, headers });
    }

    // ------------- Task single fetch by id -------------
    if (taskId) {
      if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return NextResponse.json({ message: "Invalid task id" }, { status: 400 });
      }

      const task = await Task.findById(taskId)
        .populate({ path: "company.id", model: "CompanyInformation" })
        .populate("createdBy", "username")
        .exec();

      if (!task) {
        return NextResponse.json({ message: "Task not found" }, { status: 404 });
      }

      const taskWithUsername = {
        ...task.toObject(),
        createdByUsername: task.createdBy?.username || "N/A",
      };

      return NextResponse.json([taskWithUsername]);
    }

    // ------------- List all tasks -------------
    const tasks = await Task.find({})
      .populate({ path: "company.id", model: "CompanyInformation" })
      .populate("createdBy", "username")
      .exec();

    const tasksWithUsername = tasks.map((task) => ({
      ...task.toObject(),
      createdByUsername: task.createdBy?.username || "N/A",
    }));

    return NextResponse.json(tasksWithUsername);
  } catch (error) {
    console.error("Error fetching tasks/files:", error);
    return NextResponse.json(
      {
        message: "Failed to fetch tasks or file",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  await dbConnect();

  try {
    const formData = await req.formData();
    console.log("POST FormData entries:", Array.from(formData.entries()));

    // Parse fields
    const code = (formData.get("code") as string) || "";
    const companyRaw = formData.get("company") as string | null;
    const contactRaw = formData.get("contact") as string | null;
    const working = (formData.get("working") as string) || "";
    const dateTimeRaw = formData.get("dateTime") as string | null;
    const priority = (formData.get("priority") as string) || "";
    const status = (formData.get("status") as string) || "";
    const createdAtRaw = formData.get("createdAt") as string | null;
    const createdBy = (formData.get("createdBy") as string) || "";
    const assigned = (formData.get("assigned") as string) === "true";
    const approved = (formData.get("approved") as string) === "true";
    const unposted = (formData.get("unposted") as string) === "true";
    const TaskRemarks = (formData.get("TaskRemarks") as string) || "";

    // Parse JSON fields safely
    let company = null;
    let contact = null;
    try {
      company = companyRaw ? JSON.parse(companyRaw) : null;
    } catch (e) {
      return NextResponse.json({ message: "Invalid JSON for company" }, { status: 400 });
    }
    try {
      contact = contactRaw ? JSON.parse(contactRaw) : null;
    } catch (e) {
      return NextResponse.json({ message: "Invalid JSON for contact" }, { status: 400 });
    }

    const dateTime = dateTimeRaw ? new Date(dateTimeRaw) : null;
    const createdAt = createdAtRaw ? new Date(createdAtRaw) : new Date();

    // Validate required fields
    if (!code || !company || !contact || !working || !dateTime || !createdBy) {
      console.log("Missing required fields:", {
        code,
        company,
        contact,
        working,
        dateTime,
        createdBy,
      });
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    // Files handling -> GridFS
    const filesCount = parseInt((formData.get("TasksAttachmentCount") as string) || "0", 10) || 0;
    const attachmentIds: string[] = [];

    const gfs = await getGridFS();

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    for (let i = 0; i < filesCount; i++) {
      const file = formData.get(`TasksAttachment_${i}`) as File | null;
      if (!file) continue;

      // basic extension fallback and size check
      const name = file.name || `file_${Date.now()}_${i}`;
      const ext = name.split(".").pop()?.toLowerCase() || "";

      const allowedByExt = ["pdf", "jpg", "jpeg", "png", "gif", "xlsx", "xls", "doc", "docx"].includes(ext);

      if (!allowedTypes.includes(file.type) && !allowedByExt) {
        return NextResponse.json({ message: "Only PDF, image, Excel, and Word files are allowed" }, { status: 400 });
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ message: "File size exceeds 10MB" }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // open upload stream and write buffer
      const uploadStream = gfs.openUploadStream(name, {
        contentType: file.type || undefined,
        metadata: {
          originalName: name,
          uploadedAt: new Date(),
        },
      });

      // Write buffer and wait for finish
      await new Promise<void>((resolve, reject) => {
        uploadStream.end(buffer);
        uploadStream.on("finish", () => resolve());
        uploadStream.on("error", (err) => reject(err));
      });

      // push the GridFS file id (string)
      attachmentIds.push(uploadStream.id.toString());
    }

    // Create and save task
    const taskData = {
      code,
      company,
      contact,
      working,
      dateTime,
      priority,
      status,
      createdAt,
      createdBy,
      assigned,
      approved,
      unposted,
      TaskRemarks,
      TasksAttachment: attachmentIds, // store file ids from GridFS
    };

    const newTask = new Task(taskData);
    await newTask.save();

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { message: "Failed to create task", error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  await dbConnect();
  try {
    const { taskIds } = await req.json();

    // Validate taskIds
    if (!taskIds || (Array.isArray(taskIds) && taskIds.length === 0) || (!Array.isArray(taskIds) && !taskIds)) {
      return NextResponse.json({ message: "Invalid or empty taskIds" }, { status: 400 });
    }

    // Convert to array
    const ids = Array.isArray(taskIds) ? taskIds : [taskIds];

    // Verify user permissions
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized: Missing or invalid Authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "your-default-secret");
    } catch (error) {
      return NextResponse.json({ message: "Unauthorized: Invalid token" }, { status: 401 });
    }

    if (!decoded?.role?.permissions?.includes("tasks.unpost")) {
      return NextResponse.json({ message: "Unauthorized: Missing or insufficient permissions" }, { status: 403 });
    }

    // Bulk update - preserve original status
    const updatedTasks = await Task.updateMany(
      { _id: { $in: ids } },
      {
        unposted: true,
        unpostedAt: new Date().toISOString(),
        UnpostStatus: "unposted", // Set UnpostStatus
      }
    );

    return NextResponse.json({
      message: "Tasks unposted successfully",
      modifiedCount: updatedTasks.modifiedCount,
    });
  } catch (error) {
    console.error("Error unposting tasks:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ message: "Failed to unpost tasks", error: errorMessage }, { status: 500 });
  }
}
