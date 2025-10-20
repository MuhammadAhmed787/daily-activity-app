import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Task, { ITask } from "@/models/Task"
import { Types } from "mongoose"

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
  status: string;
  createdAt: Date;
  createdBy: string;
  TaskRemarks?: string;
  TasksAttachment?: string;
  approved: boolean;
};

export async function GET() {
  await dbConnect()
  
  try {
    // Fetch pending tasks with only necessary fields
    const pendingTasks = await Task.find({
      status: "pending",
      approved: false
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
      TaskRemarks 
      TasksAttachment
      approved`
    )
    .sort({ createdAt: -1 }) // Newest first
    .lean() as unknown as RawTask[];

    // Convert to frontend-safe format
    const formattedTasks: ITask[] = pendingTasks.map(task => ({
      ...task,
      _id: task._id.toString(),
      dateTime: task.dateTime.toISOString(),
      createdAt: task.createdAt.toISOString(),
      company: {
        ...task.company,
        id: task.company.id.toString()
      }
    }));

    return NextResponse.json(formattedTasks)
  } catch (error) {
    console.error("Error fetching pending tasks:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    
    return NextResponse.json(
      { 
        message: "Failed to fetch pending tasks", 
        error: errorMessage 
      }, 
      { status: 500 }
    )
  }
}