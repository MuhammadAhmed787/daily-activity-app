import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task, { ITask } from "@/models/Task";
import { Types } from "mongoose";

// Define the raw task type from MongoDB
type RawTask = {
  _id: Types.ObjectId;
  code: string;
  company: {
    id: Types.ObjectId;
    name: string;
    city: string;
    address: string;
  };
  contact: {
    name: string;
    phone: string;
  };
  working: string;
  dateTime: Date;
  status: "pending" | "assigned" | "approved" | "completed" | "on-hold" | "unposted"; // Updated 
  createdAt: Date;
  createdBy: string;
  assignedTo?: {
    id: string;
    username: string;
    name: string;
    role: { name: string };
  };
  assignedDate?: Date;
  assignmentRemarks?: string;
  assignmentAttachment?: string;
  approved: boolean;
  approvedAt?: Date;
  TaskRemarks?: string; // Add TaskRemarks
  TasksAttachment?: string; // Add TasksAttachment
  developer_remarks?: string; // Added developer_remarks
  developer_attachment?: string; // Added developer_attachment
};

export async function GET() {
  await dbConnect();

  try {
    // Fetch approved tasks with assignment details
    const approvedTasks = await Task.find({
      approved: true,
      status: { $ne: "unposted" }, // Exclude unposted tasks
    })
      .select(
        `code 
        company 
        contact 
        working 
        dateTime 
        createdAt 
        createdBy 
        status 
        assignedTo 
        assignedDate 
        assignmentRemarks 
        assignmentAttachment 
        approved 
        approvedAt 
        TaskRemarks 
        TasksAttachment // Add TaskRemarks and TasksAttachment
        developer_remarks 
        developer_attachment` // Added developer_remarks and developer_attachment
      )
      .sort({ approvedAt: -1 }) // Most recent first
      .lean() as unknown as RawTask[];

// Convert to frontend-safe format
    const formattedTasks: ITask[] = approvedTasks.map((task) => ({
      ...task,
      _id: task._id.toString(),
      dateTime: task.dateTime.toISOString(),
      createdAt: task.createdAt.toISOString(),
      approvedAt: task.approvedAt?.toISOString(),
      assignedDate: task.assignedDate?.toISOString(),
      company: {
        ...task.company,
        id: task.company.id.toString(),
      },
      developer_remarks: task.developer_remarks, // Include in formatted output
      developer_attachment: task.developer_attachment, // Include in formatted output
    }));

    return NextResponse.json(formattedTasks);
  } catch (error) {
    console.error("Error fetching approved tasks:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        message: "Failed to fetch approved tasks",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}