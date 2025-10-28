// app/api/tasks/assign/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import "@/models/CompanyInformation";
import CompanyInformation from "@/models/CompanyInformation";
import { getGridFS } from "@/lib/gridfs";
import mongoose from "mongoose";

/**
 * Minimal interfaces
 */
interface CompanyDoc {
  _id?: string;
  softwareInformation?: { softwareType?: string }[];
}

interface TaskDoc {
  _id?: string;
  code?: string;
  company?: { id?: string } | null;
  TasksAttachment?: string[];
  assignmentAttachment?: string[];
}

/**
 * PUT - assign task and upload files to GridFS
 */
export async function PUT(req: Request) {
  await dbConnect();

  try {
    const formData = await req.formData();

    const taskId = (formData.get("taskId") as string) || "";
    const userId = (formData.get("userId") as string) || "";
    const username = (formData.get("username") as string) || "";
    const name = (formData.get("name") as string) || "";
    const roleName = (formData.get("roleName") as string) || "";
    const assignedDateRaw = (formData.get("assignedDate") as string) || "";
    const remarks = (formData.get("remarks") as string) || "";

    if (!taskId || !userId) {
      return NextResponse.json({ message: "taskId and userId are required" }, { status: 400 });
    }

    const files = formData.getAll("files") as File[];

    const task = await Task.findById(taskId).lean<TaskDoc | null>();
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    let softwareType = "N/A";
    if (task.company?.id) {
      try {
        const companyInfo = await CompanyInformation.findById(String(task.company.id)).lean<CompanyDoc | null>();
        softwareType = companyInfo?.softwareInformation?.[0]?.softwareType ?? "N/A";
      } catch (err) {
        console.warn("Company lookup failed:", err);
      }
    }

    const gfs = await getGridFS();
    const uploadedIds: string[] = [];

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
    const allowedExts = ["pdf", "jpg", "jpeg", "png", "gif", "xlsx", "xls", "doc", "docx"];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file || file.size === 0) continue;

      const name = file.name || `file_${Date.now()}_${i}`;
      const ext = name.split(".").pop()?.toLowerCase() || "";
      const allowedByExt = allowedExts.includes(ext);

      if (!allowedTypes.includes(file.type) && !allowedByExt) {
        console.warn("Blocked file (disallowed type):", name, file.type);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        console.warn("Skipped file (too large):", name, file.size);
        continue;
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadStream = (gfs as any).openUploadStream
        ? (gfs as any).openUploadStream(name, {
            contentType: file.type || undefined,
            metadata: {
              originalName: name,
              uploadedAt: new Date(),
              uploadedBy: userId,
              relatedTask: taskId,
            },
          })
        : null;

      if (!uploadStream) {
        throw new Error("GridFS upload not available");
      }

      await new Promise<void>((resolve, reject) => {
        uploadStream.end(buffer);
        uploadStream.on("finish", () => resolve());
        uploadStream.on("error", (err: any) => reject(err));
      });

      uploadedIds.push(String(uploadStream.id));
    }

    const updateData: any = {
      assigned: true,
      approved: true,
      assignedTo: {
        id: userId,
        username,
        name,
        role: { name: roleName },
      },
      assignedDate: assignedDateRaw ? new Date(assignedDateRaw) : new Date(),
      assignmentRemarks: remarks || "",
      assignmentAttachment: uploadedIds,
      status: "assigned",
      approvedAt: new Date(),
      softwareType,
    };

    const updatedTask = await Task.findByIdAndUpdate(taskId, { $set: updateData }, { new: true, runValidators: true }).lean();

    return NextResponse.json(updatedTask);
  } catch (error: any) {
    console.error("Error assigning task:", error);
    return NextResponse.json({ message: "Failed to assign task", error: error?.message ?? String(error) }, { status: 500 });
  }
}

/**
 * GET - Stream individual files instead of creating ZIP (Vercel-compatible)
 */
export async function GET(req: Request) {
  await dbConnect();

  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const fileId = searchParams.get("fileId"); // For direct file download
    const downloadAll = searchParams.get("downloadAll"); // For downloading all files

    if (!taskId) {
      return NextResponse.json({ message: "taskId is required" }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return NextResponse.json({ message: "Invalid taskId" }, { status: 400 });
    }

    const task = await Task.findById(taskId).lean<TaskDoc | null>();
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    // If specific file ID is provided, download that single file
    if (fileId) {
      return await downloadSingleFile(fileId);
    }

    // If downloadAll is requested, provide a list of files with download links
    if (downloadAll) {
      return await getFileListResponse(task);
    }

    // Default behavior: download the first available file or return file list
    return await getFileListResponse(task);
  } catch (error: any) {
    console.error("Error handling file download:", error);
    return NextResponse.json({ message: "Failed to handle file download", error: error?.message ?? String(error) }, { status: 500 });
  }
}

/**
 * Download a single file by GridFS ID
 */
async function downloadSingleFile(fileId: string) {
  try {
    const gfs = await getGridFS();
    
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return NextResponse.json({ message: "Invalid file ID" }, { status: 400 });
    }

    const objId = new mongoose.Types.ObjectId(fileId);
    let fileDoc: any = null;

    // Find file metadata
    if (!mongoose.connection.db) {
      throw new Error("No mongoose DB connection available");
    }
    const db = mongoose.connection.db;

    try {
      if (typeof (gfs as any).find === "function") {
        const files = await (gfs as any).find({ _id: objId }).toArray();
        fileDoc = files && files.length > 0 ? files[0] : null;
      } else {
        const files = await db.collection("fs.files").find({ _id: objId }).toArray();
        fileDoc = files && files.length > 0 ? files[0] : null;
      }
    } catch (err) {
      console.warn("Failed to lookup GridFS metadata:", err);
    }

    if (!fileDoc) {
      return NextResponse.json({ message: "File not found" }, { status: 404 });
    }

    // Create download stream
    const downloadStream = (gfs as any).openDownloadStream
      ? (gfs as any).openDownloadStream(objId)
      : null;

    if (!downloadStream) {
      return NextResponse.json({ message: "File stream not available" }, { status: 500 });
    }

    // Collect stream data
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      downloadStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      downloadStream.on("end", () => resolve());
      downloadStream.on("error", (err: any) => reject(err));
    });

    const fileBuffer = Buffer.concat(chunks);
    const fileName = fileDoc.filename || `file-${fileId}`;

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": fileDoc.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error downloading single file:", error);
    return NextResponse.json({ message: "Failed to download file" }, { status: 500 });
  }
}

/**
 * Get a list of all files with download links
 */
async function getFileListResponse(task: TaskDoc) {
  try {
    const gfs = await getGridFS(); // Add this line to fix the error

    const attachments: string[] = [
      ...(task.TasksAttachment ?? []),
      ...(task.assignmentAttachment ?? []),
    ];

    if (attachments.length === 0) {
      return NextResponse.json({ 
        message: "No attachments available",
        files: []
      });
    }

    if (!mongoose.connection.db) {
      throw new Error("No mongoose DB connection available");
    }
    const db = mongoose.connection.db;

    // Get file information for each attachment
    const filesInfo = await Promise.all(
      attachments.map(async (attachment) => {
        if (!mongoose.Types.ObjectId.isValid(String(attachment))) {
          return {
            id: attachment,
            name: `file-${attachment}`,
            type: "unknown",
            size: 0,
            downloadUrl: `/api/tasks/assign?taskId=${task._id}&fileId=${attachment}`
          };
        }

        try {
          const objId = new mongoose.Types.ObjectId(String(attachment));
          let fileDoc: any = null;

          if (typeof (gfs as any).find === "function") {
            const files = await (gfs as any).find({ _id: objId }).toArray();
            fileDoc = files && files.length > 0 ? files[0] : null;
          } else {
            const files = await db.collection("fs.files").find({ _id: objId }).toArray();
            fileDoc = files && files.length > 0 ? files[0] : null;
          }

          return {
            id: String(attachment),
            name: fileDoc?.filename || `file-${attachment}`,
            type: fileDoc?.contentType || "unknown",
            size: fileDoc?.length || 0,
            downloadUrl: `/api/tasks/assign?taskId=${task._id}&fileId=${attachment}`
          };
        } catch (error) {
          console.error("Error getting file info:", error);
          return {
            id: String(attachment),
            name: `file-${attachment}`,
            type: "unknown",
            size: 0,
            downloadUrl: `/api/tasks/assign?taskId=${task._id}&fileId=${attachment}`
          };
        }
      })
    );

    return NextResponse.json({
      message: "Files retrieved successfully",
      taskCode: task.code,
      files: filesInfo
    });
  } catch (error: any) {
    console.error("Error in getFileListResponse:", error);
    return NextResponse.json({ 
      message: "Failed to get file list", 
      error: error?.message ?? String(error) 
    }, { status: 500 });
  }
}