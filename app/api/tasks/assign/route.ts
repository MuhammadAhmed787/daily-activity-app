// app/api/tasks/assign/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import "@/models/CompanyInformation";
import CompanyInformation from "@/models/CompanyInformation";
import { getGridFS } from "@/lib/gridfs";
import mongoose from "mongoose";
import { PassThrough, Readable } from "stream";
import archiver from "archiver";

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
    const uploaderName = (formData.get("name") as string) || "";
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

      const fileName = file.name || `file_${Date.now()}_${i}`;
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const allowedByExt = allowedExts.includes(ext);

      if (!allowedTypes.includes(file.type) && !allowedByExt) {
        console.warn("Blocked file (disallowed type):", fileName, file.type);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        console.warn("Skipped file (too large):", fileName, file.size);
        continue;
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadStream = (gfs as any).openUploadStream
        ? (gfs as any).openUploadStream(fileName, {
            contentType: file.type || undefined,
            metadata: {
              originalName: fileName,
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
        name: uploaderName,
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
 * GET - Download single file or ZIP (streaming)
 */
export async function GET(req: Request) {
  await dbConnect();

  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const fileId = searchParams.get("fileId");

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

    if (fileId) {
      return await downloadSingleFile(fileId);
    }

    return await createZipDownloadStreaming(task);
  } catch (error: any) {
    console.error("Error handling file download:", error);
    return NextResponse.json({ message: "Failed to handle file download", error: error?.message ?? String(error) }, { status: 500 });
  }
}

/**
 * Stream a single file directly to the response (no full in-memory buffering)
 */
async function downloadSingleFile(fileId: string) {
  try {
    const gfs = await getGridFS();

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return NextResponse.json({ message: "Invalid file ID" }, { status: 400 });
    }

    const objId = new mongoose.Types.ObjectId(fileId);
    let fileDoc: any = null;

    if (!mongoose.connection.db) {
      throw new Error("No mongoose DB connection available");
    }
    const db = mongoose.connection.db;

    try {
      if (typeof (gfs as any).find === "function") {
        const files = await (gfs as any).find({ _id: objId }).toArray();
        fileDoc = files && files.length > 0 ? files[0] : null;
      } else {
        fileDoc = await db.collection("fs.files").findOne({ _id: objId });
      }
    } catch (err) {
      console.warn("Failed to lookup GridFS metadata:", err);
    }

    if (!fileDoc) {
      return NextResponse.json({ message: "File not found" }, { status: 404 });
    }

    const downloadStream = (gfs as any).openDownloadStream ? (gfs as any).openDownloadStream(objId) : null;
    if (!downloadStream) {
      return NextResponse.json({ message: "File stream not available" }, { status: 500 });
    }

    // Convert Node stream to Web ReadableStream before returning
    const webStream = Readable.toWeb(downloadStream as any) as unknown as ReadableStream;

    const fileName = fileDoc.filename || `file-${fileId}`;
    const headers: Record<string, string> = {
      "Content-Type": fileDoc.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    };
    // Content-Length is unknown for streamed response (unless you have fileDoc.length and want to set it)
    if (typeof fileDoc.length === "number") {
      headers["Content-Length"] = String(fileDoc.length);
    }

    return new Response(webStream, { headers });
  } catch (error: any) {
    console.error("Error downloading single file:", error);
    return NextResponse.json({ message: "Failed to download file" }, { status: 500 });
  }
}

/**
 * Streaming ZIP creation: streams GridFS files directly into archiver and pipes to response.
 * Converts Node streams to Web streams using Readable.toWeb so Response accepts them.
 */
async function createZipDownloadStreaming(task: TaskDoc) {
  try {
    const gfs = await getGridFS();

    if (!mongoose.connection.db) {
      console.error("No mongoose DB connection available");
      throw new Error("No mongoose DB connection available");
    }
    const db = mongoose.connection.db;

    // Conservative limits (tune to your environment)
    const MAX_TOTAL_SIZE_FOR_ZIP = 20 * 1024 * 1024; // 20 MB
    const MAX_FILES_FOR_ZIP = 50;

    const attachments: string[] = [
      ...(task.TasksAttachment ?? []),
      ...(task.assignmentAttachment ?? []),
    ];

    if (attachments.length === 0) {
      return NextResponse.json({ message: "No attachments available" }, { status: 404 });
    }

    // Preflight metadata check (only reading file metadata, not file contents)
    let totalEstimatedSize = 0;
    const validAttachments: { id: mongoose.Types.ObjectId; fileDoc: any }[] = [];

    for (const attachment of attachments) {
      if (!mongoose.Types.ObjectId.isValid(String(attachment))) continue;

      try {
        const objId = new mongoose.Types.ObjectId(String(attachment));
        let fileDoc: any = null;

        if (typeof (gfs as any).find === "function") {
          const files = await (gfs as any).find({ _id: objId }).toArray();
          fileDoc = files && files.length > 0 ? files[0] : null;
        } else {
          fileDoc = await db.collection("fs.files").findOne({ _id: objId });
        }

        if (fileDoc) {
          const len = typeof fileDoc.length === "number" ? fileDoc.length : 0;
          totalEstimatedSize += len;
          validAttachments.push({ id: objId, fileDoc });

          if (totalEstimatedSize > MAX_TOTAL_SIZE_FOR_ZIP) {
            return NextResponse.json({
              message: "Total file size too large for ZIP download (over 20MB). Please download files individually.",
              fallback: true,
            }, { status: 413 });
          }
          if (validAttachments.length > MAX_FILES_FOR_ZIP) {
            return NextResponse.json({
              message: "Too many files for ZIP download. Please download files individually.",
              fallback: true,
            }, { status: 413 });
          }
        }
      } catch (error) {
        console.warn(`Error checking file size for ${attachment}:`, error);
        continue;
      }
    }

    if (validAttachments.length === 0) {
      return NextResponse.json({ message: "No downloadable files found" }, { status: 404 });
    }

    // Node PassThrough that archiver writes into
    const passThrough = new PassThrough();

    // Create archiver and pipe into passThrough
    const archive = archiver("zip", { zlib: { level: 1 } });
    archive.on("error", (err) => {
      console.error("Archive error:", err);
      try { passThrough.destroy(err as any); } catch (_) {}
    });
    archive.on("warning", (err) => {
      console.warn("Archive warning:", err);
    });
    archive.pipe(passThrough);

    // Append streams asynchronously
    (async () => {
      try {
        for (const { id, fileDoc } of validAttachments) {
          try {
            const downloadStream = (gfs as any).openDownloadStream
              ? (gfs as any).openDownloadStream(id)
              : null;

            if (!downloadStream) {
              console.warn(`Download stream not available for: ${id.toString()}`);
              continue;
            }

            const fileName = fileDoc.filename || `file-${id.toString()}`;
            // Append the Node readable stream into archiver (archiver will read it)
            archive.append(downloadStream, { name: fileName });
          } catch (err) {
            console.error(`Error appending file ${String(id)}:`, err);
            continue;
          }
        }

        await archive.finalize();
      } catch (err) {
        console.error("Fatal error while building archive:", err);
        try { passThrough.destroy(err as any); } catch (_) {}
      }
    })();

    // Convert Node PassThrough to Web ReadableStream for the Response body
    const webStream = Readable.toWeb(passThrough) as unknown as ReadableStream;

    const zipFileName = `task-${task.code || task._id}-attachments.zip`;
    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
        // Content-Length is intentionally omitted (streaming/chunked)
      },
    });
  } catch (error: any) {
    console.error("Error creating streaming ZIP file:", error);
    return NextResponse.json({
      message: "Failed to create ZIP file",
      error: error?.message ?? String(error),
    }, { status: 500 });
  }
}
