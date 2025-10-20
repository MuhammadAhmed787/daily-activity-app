import mongoose, { Schema, type Document, Types } from "mongoose";

// Define interfaces for nested objects
export interface ICompany {
  id: Types.ObjectId;
  name: string;
  city: string;
  address: string;
  companyRepresentative: string; // Added company representative field
  support: string; // Added support field
}

export interface IContact {
  name: string;
  phone: string;
}

export interface IAssignedTo {
  id: string;
  username: string;
  name: string;
  role: { name: string };
}

// Main Task interface
export interface ITask {
  _id: string;
  code: string;
  company: {
    id: string;
    name: string;
    city: string;
    address: string;
    companyRepresentative: string; // Added company representative field
    support: string; // Added support field
  };
  contact: {
    name: string;
    phone: string;
  };
  working: string;
  dateTime: string;
  priority: "Urgent" | "High" | "Normal"; // Added priority field with enum values
  status: "pending" | "assigned" | "approved" | "completed" | "on-hold" | "unposted" | "in-progress"  | "rejected";
  completionApproved?: boolean;
  completionApprovedAt?: string;
  finalStatus?: "done" | "pending" | "on-hold" | "not-done" | "unposted" | "in-progress"  | "rejected";
  completionRemarks?: string;
  completionAttachment?: string[];
  rejectionRemarks?: string;
  rejectionAttachment?: string[];
  timeTaken?: number;
  unposted?: boolean;
  unpostedAt?: string;
  createdAt: string;
  createdBy: string;
  assigned?: boolean;
  assignedTo?: IAssignedTo;
  assignedDate?: string;
  TaskRemarks?: string;
  TasksAttachment?: string[]; // Changed to array for multiple attachments
  assignmentRemarks?: string;
  assignmentAttachment?: string[];
  approved: boolean;
  approvedAt?: string;
  UnpostStatus?: string;
  developer_status?: "pending" | "done" | "not-done" | "on-hold";
  developer_remarks?: string;
  developer_attachment?: string[];
  updatedAt?: string;
  developer_status_rejection?: "pending" | "fixed";
  developer_done_date ?: string;
  developer_rejection_solve_attachment: string[];
  developer_rejection_remarks : string;
}

// Document interface for MongoDB
export interface ITaskDocument extends Document {
  code: string;
  company: ICompany;
  contact: IContact;
  working: string;
  dateTime: Date;
  priority: "Urgent" | "High" | "Normal"; // Added priority field with enum values
  status: "pending" | "assigned" | "approved" | "completed" | "on-hold" | "unposted" | "in-progress"  | "rejected";
  createdAt: Date;
  createdBy: string;
  assigned: boolean;
  assignedTo?: IAssignedTo;
  assignedDate?: Date;
  TaskRemarks?: string;
  TasksAttachment?: string[]; // Changed to array for multiple attachments
  assignmentRemarks?: string;
  assignmentAttachment?: string[];
  approved: boolean;
  approvedAt?: Date;
  completionApproved?: boolean;
  completionApprovedAt?: Date;
  finalStatus?: "done" | "pending" | "on-hold" | "not-done" | "unposted"  | "in-progress"  | "rejected";
  rejectionRemarks?: string;
  rejectionAttachment?: string[];
  timeTaken?: number;
  completionRemarks?: string;
  completionAttachment?: string[];
  unposted?: boolean;
  UnpostStatus?: string;
  unpostedAt?: Date;
  developer_status?: "pending" | "done" | "not-done" | "on-hold";
  developer_remarks?: string;
  developer_attachment?: string[];
  updatedAt?: Date;
  developer_status_rejection: {
  type: String,
  enum: ["pending", "fixed"],
  default: "pending"
}
  developer_done_date ?: Date;
  developer_rejection_solve_attachment: string[]
  developer_rejection_remarks ?: string;
}

const TaskSchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    company: {
      id: { type: Schema.Types.ObjectId, ref: "CompanyInformation", required: true },
      name: { type: String, required: true },
      city: { type: String, required: true },
      address: { type: String, required: true },
      companyRepresentative: { type: String, default: "" }, // Added company representative field
      support: { type: String, default: "" }, // Added support field
    },
    contact: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },
    working: { type: String, required: true },
    dateTime: { type: Date, required: true },
      priority: { // Added priority field
      type: String,
      enum: ["Urgent", "High", "Normal"],
      default: "Normal"
    },
    status: {
      type: String,
      enum: ["pending", "assigned", "approved", "completed", "on-hold", "unposted" , "in-progress" , "rejected"],
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, required: true },
    assigned: { type: Boolean, default: false },
    assignedTo: {
      id: String,
      username: String,
      name: String,
      role: { name: String },
    },
    assignedDate: { type: Date },
    TaskRemarks: { type: String, default: "" },
    TasksAttachment: [{ type: String }], // Changed to array for multiple attachments
    assignmentRemarks: { type: String, default: "" },
    assignmentAttachment: [{ type: String }],
    approved: { type: Boolean, default: false },
    approvedAt: { type: Date },
    completionApproved: { type: Boolean, default: false },
    completionApprovedAt: { type: Date },
    finalStatus: {
      type: String,
      enum: ["done", "pending", "on-hold", "not-done", "unposted", "in-progress" , "rejected"],
    },
    completionRemarks: { type: String, default: "" },
    completionAttachment: [{ type: String }],
    rejectionRemarks: { type: String, default: "" },
    rejectionAttachment: [{ type: String }],
    timeTaken: { type: Number, default: 0 }, // Time taken in minutes
    unposted: { type: Boolean, default: false },
    UnpostStatus: { type: String, default: "" },
    unpostedAt: { type: Date },
    developer_status: {
      type: String,
      enum: ["pending", "done", "not-done", "on-hold"],
      default: "pending",
    },
    developer_remarks: { type: String, default: "" },
    developer_attachment: [{ type: String }],
    updatedAt: { type: Date },
    developer_status_rejection: {
      type: String,
      enum: ["pending", "fixed"],
      default: "pending"
    },
    developer_done_date: { type: Date },
    developer_rejection_solve_attachment: [{
      type: String,
      default: [],
    }],
    developer_rejection_remarks: { type: String, default: "" },
  },
  {
    strict: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add a pre-save hook to handle updates properly
TaskSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const Task = mongoose.models.Task || mongoose.model<ITaskDocument>("Task", TaskSchema);

export default Task;