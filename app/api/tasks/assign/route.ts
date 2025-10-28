// app/api/tasks/assign/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import "@/models/CompanyInformation";
import CompanyInformation from "@/models/CompanyInformation";
import { mkdir, readFile } from "fs/promises";
import { createWriteStream, existsSync } from "fs";
import path from "path";
import archiver from "archiver";
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
  TasksAttachment?: string[]; // legacy saved file paths or GridFS ids
  assignmentAttachment?: string[]; // GridFS ids saved by this endpoint
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
        // getGridFS didn't supply openUploadStream — fatal for uploads
        throw new Error("GridFS upload not available (getGridFS returned unexpected object).");
      }

      await new Promise<void>((resolve, reject) => {
        uploadStream.end(buffer);
        uploadStream.on("finish", () => resolve());
        uploadStream.on("error", (err: any) => reject(err));
      });

      uploadedIds.push(String(uploadStream.id));
      console.log("Uploaded to GridFS:", uploadStream.id?.toString?.() ?? uploadStream.id, name);
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
 * GET - create a ZIP of all attachments for a given taskId
 */
export async function GET(req: Request) {
  await dbConnect();

  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

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

    const zipFileName = `task-${task.code ?? taskId}-attachments.zip`;
    const tmpDir = path.join(process.cwd(), "tmp");
    const zipFilePath = path.join(tmpDir, zipFileName);

    await mkdir(tmpDir, { recursive: true });

    const output = createWriteStream(zipFilePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);

    const gfs = await getGridFS();

    // --- SAFETY: ensure mongoose.connection.db exists before using ---
    if (!mongoose.connection.db) {
      // This should not happen if dbConnect() resolved successfully, but guard to satisfy TS and runtime safety
      throw new Error("No mongoose DB connection available (mongoose.connection.db is undefined).");
    }
    const db = mongoose.connection.db; // after guard, TS knows this is defined

    // Collect attachments from legacy and new fields
    const attachments: string[] = [
      ...(task.TasksAttachment ?? []),
      ...(task.assignmentAttachment ?? []),
    ];

    if (attachments.length === 0) {
      archive.append("No attachments available", { name: "README.txt" });
    } else {
      for (const attachment of attachments) {
        if (!attachment) continue;

        if (mongoose.Types.ObjectId.isValid(String(attachment))) {
          const objId = new mongoose.Types.ObjectId(String(attachment));
          let fileDoc: any = null;

          try {
            if (typeof (gfs as any).find === "function") {
              const files = await (gfs as any).find({ _id: objId }).toArray();
              if (files && files.length > 0) fileDoc = files[0];
            } else {
              // Use db.collection('fs.files') safely — db is not undefined thanks to guard above
              const files = await db.collection("fs.files").find({ _id: objId }).toArray();
              if (files && files.length > 0) fileDoc = files[0];
            }
          } catch (err) {
            console.warn("Failed to lookup GridFS metadata:", err);
          }

          try {
            const downloadStream = (gfs as any).openDownloadStream
              ? (gfs as any).openDownloadStream(objId)
              : null;

            if (!downloadStream) {
              console.warn("GridFS download stream not available for id:", String(attachment));
              continue;
            }

            const safeName = fileDoc?.filename ? path.basename(fileDoc.filename) : `file-${String(attachment)}`;
            archive.append(downloadStream, { name: safeName });
            console.log("Added GridFS file to archive:", safeName);
          } catch (err) {
            console.warn("Failed to append GridFS file to archive:", attachment, err);
          }
        } else {
          const relative = String(attachment).replace(/^\/+/, "");
          const filePath = path.join(process.cwd(), "public", relative);
          if (existsSync(filePath)) {
            archive.file(filePath, { name: path.basename(filePath) });
            console.log("Added public file to archive:", filePath);
          } else {
            console.warn("Public attachment not found, skipping:", filePath);
          }
        }
      }
    }

    await archive.finalize();

    await new Promise<void>((resolve, reject) => {
      output.on("close", () => resolve());
      output.on("end", () => resolve());
      output.on("error", (err) => reject(err));
    });

    const zipBuffer = await readFile(zipFilePath);
    const uint8Array = new Uint8Array(zipBuffer);

    return new Response(uint8Array, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
        "Content-Length": uint8Array.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error creating zip file:", error);
    return NextResponse.json({ message: "Failed to create zip file", error: error?.message ?? String(error) }, { status: 500 });
  }
}
