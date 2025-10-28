import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import "@/models/CompanyInformation";
import CompanyInformation from "@/models/CompanyInformation";
import { getGridFS } from "@/lib/gridfs";
import mongoose from "mongoose";
import { Writable } from "stream";
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
 * GET - Download files (single or ZIP) with timeout protection
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

    // If specific file ID is provided, download that single file
    if (fileId) {
      return await downloadSingleFile(fileId);
    }

    // Otherwise, create ZIP of all attachments with timeout protection
    return await createZipDownloadWithTimeout(task);
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
 * Create ZIP file with timeout protection
 */
async function createZipDownloadWithTimeout(task: TaskDoc) {
  // Set timeout based on Vercel plan (8 seconds for Hobby, 55 seconds for Pro)
  const timeoutMs = 8000; // 8 seconds to be safe
  
  const timeoutPromise = new Promise<NextResponse>((resolve) => {
    setTimeout(() => {
      resolve(NextResponse.json({ 
        message: "ZIP creation timeout - files are too large or too many. Please download files individually.",
        fallback: true
      }, { status: 408 })); // 408 Request Timeout
    }, timeoutMs);
  });

  const zipPromise = createZipDownload(task);

  try {
    // Race between ZIP creation and timeout
    return await Promise.race([zipPromise, timeoutPromise]);
  } catch (error: any) {
    console.error("Error in ZIP creation:", error);
    return NextResponse.json({ 
      message: "Failed to create ZIP file", 
      error: error?.message ?? String(error)
    }, { status: 500 });
  }
}

/**
 * Create ZIP file in memory for all task attachments (optimized version)
 */
async function createZipDownload(task: TaskDoc) {
  try {
    console.log(`Starting optimized ZIP creation for task: ${task._id}`);
    const gfs = await getGridFS();
    
    if (!mongoose.connection.db) {
      console.error("No mongoose DB connection available");
      throw new Error("No mongoose DB connection available");
    }
    const db = mongoose.connection.db;

    // Collect all attachments
    const attachments: string[] = [
      ...(task.TasksAttachment ?? []),
      ...(task.assignmentAttachment ?? []),
    ];

    console.log(`Found ${attachments.length} attachments for task ${task._id}`);

    if (attachments.length === 0) {
      console.log("No attachments available for ZIP");
      return NextResponse.json({ message: "No attachments available" }, { status: 404 });
    }

    // Check total size before processing (quick size check)
    let totalEstimatedSize = 0;
    const validAttachments = [];
    
    for (const attachment of attachments) {
      if (!mongoose.Types.ObjectId.isValid(String(attachment))) {
        continue;
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

        if (fileDoc && fileDoc.length) {
          totalEstimatedSize += fileDoc.length;
          validAttachments.push({ attachment, fileDoc });
          
          // If total size exceeds 20MB, stop early
          if (totalEstimatedSize > 20 * 1024 * 1024) {
            console.log("Total file size exceeds 20MB, returning fallback");
            return NextResponse.json({ 
              message: "Total file size too large for ZIP download (over 20MB). Please download files individually.",
              fallback: true
            }, { status: 413 });
          }
        }
      } catch (error) {
        console.warn(`Error checking file size for ${attachment}:`, error);
      }
    }

    if (validAttachments.length === 0) {
      console.log("No valid attachments found");
      return NextResponse.json({ message: "No downloadable files found" }, { status: 404 });
    }

    console.log(`Processing ${validAttachments.length} files, estimated size: ${(totalEstimatedSize / 1024 / 1024).toFixed(2)} MB`);

    // Create archiver with faster compression
    const archive = archiver('zip', {
      zlib: { level: 1 } // Faster compression
    });

    const chunks: Buffer[] = [];
    
    // Create a writable stream to collect the ZIP data
    const writable = new Writable({
      write(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
        chunks.push(chunk);
        callback();
      }
    });

    archive.pipe(writable);

    // Handle archive events
    archive.on('warning', (err) => {
      console.warn('Archive warning:', err);
    });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      throw err;
    });

    let fileCount = 0;
    let processedSize = 0;

    // Process files with progress monitoring
    for (const { attachment, fileDoc } of validAttachments) {
      try {
        console.log(`Processing file ${fileCount + 1}/${validAttachments.length}: ${fileDoc.filename}`);
        
        const objId = new mongoose.Types.ObjectId(String(attachment));
        const downloadStream = (gfs as any).openDownloadStream
          ? (gfs as any).openDownloadStream(objId)
          : null;

        if (!downloadStream) {
          console.warn(`Download stream not available for: ${attachment}`);
          continue;
        }

        // Read stream into buffer with progress
        const fileChunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          downloadStream.on("data", (chunk: Buffer) => fileChunks.push(chunk));
          downloadStream.on("end", () => resolve());
          downloadStream.on("error", (err: any) => {
            console.error(`Stream error for ${fileDoc.filename}:`, err);
            reject(err);
          });
        });

        const fileBuffer = Buffer.concat(fileChunks);
        const fileName = fileDoc.filename || `file-${String(attachment)}`;
        
        // Add file to archive
        archive.append(fileBuffer, { name: fileName });
        fileCount++;
        processedSize += fileBuffer.length;

        console.log(`Added file to ZIP: ${fileName}, size: ${(fileBuffer.length / 1024).toFixed(1)} KB`);

        // Check if we're approaching memory limits
        if (processedSize > 15 * 1024 * 1024) { // 15MB
          console.log("Approaching memory limits, finalizing early");
          break;
        }

      } catch (error) {
        console.error(`Error processing file ${fileDoc.filename}:`, error);
        continue;
      }
    }

    if (fileCount === 0) {
      console.log("No files were successfully added to the ZIP");
      return NextResponse.json({ message: "No downloadable files found" }, { status: 404 });
    }

    console.log(`Finalizing archive with ${fileCount} files, total size: ${(processedSize / 1024 / 1024).toFixed(2)} MB`);

    // Finalize the archive
    await archive.finalize();

    // Wait for all data to be written
    await new Promise<void>((resolve, reject) => {
      writable.on('finish', () => {
        console.log("Writable stream finished");
        resolve();
      });
      writable.on('error', (err) => {
        console.error("Writable stream error:", err);
        reject(err);
      });
    });

    // Combine all chunks into single buffer
    const zipBuffer = Buffer.concat(chunks);
    const zipFileName = `task-${task.code || task._id}-attachments.zip`;

    console.log(`Created ZIP file: ${zipFileName} with ${fileCount} files, ZIP size: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error creating ZIP file:", error);
    return NextResponse.json({ 
      message: "Failed to create ZIP file", 
      error: error?.message ?? String(error)
    }, { status: 500 });
  }
}