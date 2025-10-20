"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Eye, CheckSquare, Building, FileText, Loader2, User, Phone, Calendar, ClipboardList, Download, Paperclip, AlertTriangle, ArrowUp, Info, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ITask } from "@/models/Task";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface UserSession {
  id: string;
  username: string;
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
}

interface SoftwareInformation {
  softwareType: string;
  version: string;
  lastUpdated: string;
  _id: string;
}

export default function DeveloperWorkingPage() {
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ITask | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDoneDialogOpen, setIsDoneDialogOpen] = useState(false);
  const [developerRemarks, setDeveloperRemarks] = useState("");
  const [developerAttachments, setDeveloperAttachments] = useState<File[]>([]);
  const [developerRejectionSolveAttachments, setDeveloperRejectionSolveAttachments] = useState<File[]>([]);
  const [developerStatusRejection, setDeveloperStatusRejection] = useState("fixed");
  const [developerRejectionRemarks, setDeveloperRejectionRemarks] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Check if user is admin or manager
  const isAdminOrManager = user?.role?.permissions?.includes("tasks.view.all") || 
                           user?.role?.name?.toLowerCase().includes("admin") ||
                           user?.role?.name?.toLowerCase().includes("manager");

  // Update current time every second for elapsed time calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

// Calculate elapsed time between two dates
const calculateElapsedTime = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const elapsedMs = end.getTime() - start.getTime();
  
  const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((elapsedMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${days}d ${hours}h ${minutes}m`;
};

  // Download all attachments as a zip file
  const downloadAllAttachments = async (taskId: string, attachments: string[], type: string) => {
    try {
      const zip = new JSZip();
      const folder = zip.folder(`${type}-attachments-${taskId}`);
      
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        const response = await fetch(attachment);
        const blob = await response.blob();
        const fileName = attachment.split('/').pop() || `file-${i}`;
        folder?.file(fileName, blob);
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${type}-attachments-${taskId}.zip`);
    } catch (error) {
      console.error("Error downloading attachments:", error);
      toast({
        title: "Download Error",
        description: "Failed to download attachments. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle file selection for multiple attachments
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<File[]>>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newFiles = Array.from(files);
    setter(prev => [...prev, ...newFiles]);
  };

  // Remove a file from the attachment list
  const removeFile = (index: number, setter: React.Dispatch<React.SetStateAction<File[]>>, files: File[]) => {
    setter(files.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      toast({
        title: "Session Expired",
        description: "Please log in to continue.",
        variant: "destructive",
      });
      router.push("/login");
      return;
    }
    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    } catch (error) {
      console.error("Error parsing user data:", error);
      toast({
        title: "Session Error",
        description: "Invalid session data. Please log in again.",
        variant: "destructive",
      });
      localStorage.removeItem("user");
      router.push("/login");
    }
  }, [router, toast]);

  // Set up SSE connection for real-time updates
  useEffect(() => {
    if (!user) return;
    
    const eventSource = new EventSource('/api/tasks/stream');
    
    eventSource.onmessage = (event) => {
      if (event.data === 'heartbeat') return;
      
      try {
        const data = JSON.parse(event.data);
        setTasks(prevTasks => {
          if (isAdminOrManager) {
            return data.filter((task: ITask) => 
              (task.status === "assigned" && task.developer_status !== "done") ||
              task.finalStatus === "rejected"
            );
          } else {
            return data.filter((task: ITask) => 
              ((task.status === "assigned" && 
                task.developer_status !== "done" &&
                task.assignedTo?.username === user.username) ||
              (task.finalStatus === "rejected" &&
                task.assignedTo?.username === user.username))
            );
          }
        });
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };
    
    return () => {
      eventSource.close();
    };
  }, [user, isAdminOrManager]);

  const fetchTasks = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let response;
      
      if (isAdminOrManager) {
        response = await fetch(`/api/tasks`);
      } else {
        response = await fetch(`/api/tasks/developer_working?username=${user.username}`);
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ITask[] = await response.json();
      let filteredTasks;
      
      if (isAdminOrManager) {
        filteredTasks = data.filter((task: ITask) => 
          (task.status === "assigned" && task.developer_status !== "done") ||
          task.finalStatus === "rejected"
        );
      } else {
        filteredTasks = data.filter((task) => 
          ((task.status === "assigned" && 
            task.developer_status !== "done" &&
            task.assignedTo?.username === user.username) ||
          (task.finalStatus === "rejected" &&
            task.assignedTo?.username === user.username))
        );
      }
      
      if (filteredTasks.length === 0) {
        toast({
          title: isAdminOrManager ? "No Tasks Found" : "No Assigned Tasks",
          description: isAdminOrManager ? "No tasks found in the system." : "No tasks assigned to you found.",
          variant: "default",
        });
      }
      
      setTasks(filteredTasks);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast({
        title: "Error fetching tasks",
        description: "Could not load tasks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const handleDoneTask = async () => {
    if (!selectedTask || !developerRemarks) {
      toast({
        title: "Remarks Required",
        description: "Please provide developer remarks for the task.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTask.finalStatus === "rejected" && !developerRejectionRemarks) {
      toast({
        title: "Solve Rejection Remarks Required",
        description: "Please provide solve rejection remarks for the task.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("taskId", selectedTask._id);
      formData.append("developer_status", "done");
      formData.append("developer_remarks", developerRemarks);
      
      formData.append("developer_done_date", new Date().toISOString());
      
      if (selectedTask.finalStatus === "rejected") {
        formData.append("developer_status_rejection", developerStatusRejection);
        formData.append("developer_rejection_remarks", developerRejectionRemarks);
      }
      
      developerAttachments.forEach((file) => {
        formData.append("developer_attachments", file);
      });

      if (selectedTask.finalStatus === "rejected") {
        developerRejectionSolveAttachments.forEach((file) => {
          formData.append("developer_rejection_solve_attachments", file);
        });
      }

      const response = await fetch(`/api/tasks/developer_working`, {
        method: "PUT",
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, message: ${responseData.message || "Unknown error"}`);
      }

      setTasks((prev) => prev.filter((task) => task._id !== selectedTask._id));
      toast({
        title: "Task Marked as Done",
        description: `Task ${selectedTask.code} has been marked as done.`,
        duration: 5000,
      });

      setIsDoneDialogOpen(false);
      setSelectedTask(null);
      setDeveloperRemarks("");
      setDeveloperAttachments([]);
      setDeveloperRejectionSolveAttachments([]);
      setDeveloperStatusRejection("fixed");
      setDeveloperRejectionRemarks("");
    } catch (error) {
      console.error("Failed to update task:", error);
      toast({
        title: "Error",
        description: `Failed to mark task as done: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          {isAdminOrManager ? "All Tasks" : "My Assigned Tasks"}
        </h1>
        <p className="text-muted-foreground">
          {isAdminOrManager ? "View all tasks in the system" : "View and manage your assigned tasks"}
        </p>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckSquare className="h-4 w-4" />
            {isAdminOrManager ? "All Tasks" : "Assigned Tasks"} ({tasks.length})
          </CardTitle>
          <CardDescription className="text-sm">
            {isAdminOrManager ? "All tasks in the system" : `Tasks assigned to ${user.username}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">
                {isAdminOrManager ? "No tasks found" : "No assigned tasks"}
              </p>
              <p className="text-xs">
                {isAdminOrManager ? "Tasks will appear here once created" : "Tasks assigned to you will appear here"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-blue-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Code</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Company</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase hidden sm:table-cell">Work</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Priority</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Dev Status</th>
                    {isAdminOrManager && (
                      <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Assigned To</th>
                    )}
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Elapsed Time</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {tasks.map((task, index) => (
                    <tr
                      key={task._id}
                      className={index % 2 === 0 ? "bg-white" : "bg-blue-50/30 hover:bg-blue-100 transition-colors"}
                    >
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs font-mono border-blue-300">
                          {task.code?.split("-")[1]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <Building className="h-3 w-3 text-gray-400 mr-1" />
                          <span className="font-medium text-gray-900 truncate max-w-[80px] sm:max-w-24" title={task.company?.name}>
                            {task.company?.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <span className="text-gray-900 truncate max-w-[100px] block text-xs" title={task.working}>
                          {task.working}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={
                          task.priority === "Urgent" ? "bg-red-100 text-red-800 border-red-300" :
                          task.priority === "High" ? "bg-orange-100 text-orange-800 border-orange-300" :
                          "bg-blue-100 text-blue-800 border-blue-300"
                        }>
                          {task.priority === "Urgent" ? (
                            <>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Urgent
                            </>
                          ) : task.priority === "High" ? (
                            <>
                              <ArrowUp className="h-3 w-3 mr-1" />
                              High
                            </>
                          ) : (
                            <>
                              <Info className="h-3 w-3 mr-1" />
                              Normal
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={
                          task.status === "assigned" ? "bg-blue-600" :
                          task.status === "completed" ? "bg-green-600" :
                          task.status === "pending" ? "bg-yellow-600" :
                          "bg-gray-600"
                        }>
                          <span className="ml-1 capitalize">{task.status}</span>
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={
                          task.developer_status === "done" ? "bg-green-600" :
                          task.developer_status === "not-done" ? "bg-blue-600" :
                          task.developer_status === "pending" ? "bg-yellow-600" :
                          "bg-gray-600"
                        }>
                          <span className="ml-1 capitalize">{task.developer_status || "not started"}</span>
                        </Badge>
                      </td>
                      {isAdminOrManager && (
                        <td className="px-3 py-2">
                          <span className="text-gray-900 text-xs">
                            {task.assignedTo?.name || "Unassigned"}
                          </span>
                        </td>
                      )}
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                      {task.createdAt && task.assignedDate 
                        ? calculateElapsedTime(task.createdAt, task.assignedDate)
                        : "N/A"}
                    </td>
                      <td className="px-3 py-2 flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedTask(task);
                            setIsViewDialogOpen(true);
                          }}
                          size="sm"
                          variant="outline"
                          className="text-xs px-3 py-1"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        {(task.assignedTo?.username === user.username && 
 (task.finalStatus === "rejected" || (task.status === "assigned" && task.developer_status !== "done"))) && (
  <Button
    onClick={() => {
      setSelectedTask(task);
      setIsDoneDialogOpen(true);
    }}
    size="sm"
    className="bg-green-600 hover:bg-green-700 text-xs px-3 py-1"
  >
    <CheckSquare className="h-3 w-3 mr-1" />
    {task.finalStatus === "rejected" ? "Fix & Complete" : "Done"}
  </Button>
)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isViewDialogOpen} onOpenChange={(open) => {
        setIsViewDialogOpen(open);
        if (!open) setSelectedTask(null);
      }}>
        <DialogContent className="w-[95vw] max-w-[360px] sm:max-w-lg md:max-w-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Task Details</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Details for task {selectedTask?.code || ""}
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm border rounded-lg bg-gray-50">
                  <thead className="bg-gray-100">
                    <tr>
                      <th colSpan={2} className="p-2 sm:p-3 text-left font-semibold text-gray-700 text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4" />
                          Task Details
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Building className="h-3 w-3 text-gray-500" /> Company
                      </td>
                      <td className="p-2 sm:p-3 break-words">{selectedTask.company?.name}</td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Building className="h-3 w-3 text-gray-500" /> City
                      </td>
                      <td className="p-2 sm:p-3 break-words">{selectedTask.company?.city}</td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Building className="h-3 w-3 text-gray-500" /> Address
                      </td>
                      <td className="p-2 sm:p-3 break-words">{selectedTask.company?.address}</td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <User className="h-3 w-3 text-gray-500" /> Contact Name
                      </td>
                      <td className="p-2 sm:p-3 break-words">{selectedTask.contact?.name}</td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Phone className="h-3 w-3 text-gray-500" /> Contact Phone
                      </td>
                      <td className="p-2 sm:p-3 break-words">{selectedTask.contact?.phone}</td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <User className="h-3 w-3 text-gray-500" /> Assigned To
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        {selectedTask.assignedTo?.name} ({selectedTask.assignedTo?.username}, {selectedTask.assignedTo?.role?.name})
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <FileText className="h-3 w-3 text-gray-500" /> Work
                      </td>
                      <td className="p-2 sm:p-3 break-words">{selectedTask.working}</td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <AlertTriangle className="h-3 w-3 text-gray-500" /> Priority
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        <Badge variant="outline" className={
                          selectedTask.priority === "Urgent" ? "bg-red-100 text-red-800 border-red-300" :
                          selectedTask.priority === "High" ? "bg-orange-100 text-orange-800 border-orange-300" :
                          "bg-blue-100 text-blue-800 border-blue-300"
                        }>
                          {selectedTask.priority === "Urgent" ? (
                            <>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Urgent
                            </>
                          ) : selectedTask.priority === "High" ? (
                            <>
                              <ArrowUp className="h-3 w-3 mr-1" />
                              High
                            </>
                          ) : (
                            <>
                              <Info className="h-3 w-3 mr-1" />
                              Normal
                            </>
                          )}
                        </Badge>
                      </td>
                    </tr>
                    {selectedTask.company?.id && typeof selectedTask.company.id === 'object' && 
                     'softwareInformation' in selectedTask.company.id && (
                      <tr>
                        <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                          <FileText className="h-3 w-3 text-gray-50" /> Software Info
                        </td>
                        <td className="p-2 sm:p-3 break-words">
                          {(selectedTask.company.id as any).softwareInformation?.map((software: SoftwareInformation, index: number) => (
                            <div key={index} className="mb-2 last:mb-0">
                              <div className="font-medium">{software.softwareType}</div>
                              <div>Version: {software.version}</div>
                              <div>Last Updated: {new Date(software.lastUpdated).toLocaleDateString()}</div>
                            </div>
                          )) || "N/A"}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Calendar className="h-3 w-3 text-gray-500" /> Created At
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        {selectedTask.createdAt
                          ? new Date(selectedTask.createdAt).toLocaleString()
                          : "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Calendar className="h-3 w-3 text-gray-500" /> Assigned Date
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        {selectedTask.assignedDate
                          ? new Date(selectedTask.assignedDate).toLocaleString()
                          : "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Paperclip className="h-3 w-3 text-gray-500" /> Task Attachments
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        {selectedTask.TasksAttachment && Array.isArray(selectedTask.TasksAttachment) && selectedTask.TasksAttachment.length > 0 ? (
                          <div className="space-y-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              onClick={() => downloadAllAttachments(selectedTask._id, selectedTask.TasksAttachment || [], 'task')}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download All ({selectedTask.TasksAttachment.length})
                            </Button>
                            <div className="grid gap-1 max-h-20 overflow-y-auto">
                              {selectedTask.TasksAttachment.map((attachment: string, index: number) => (
                                <a 
                                  key={index}
                                  href={attachment} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                >
                                  <FileText className="h-3 w-3" />
                                  File {index + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : "None"}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Paperclip className="h-3 w-3 text-gray-50" /> Assignment Attachments
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        {selectedTask.assignmentAttachment && Array.isArray(selectedTask.assignmentAttachment) && selectedTask.assignmentAttachment.length > 0 ? (
                          <div className="space-y-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              onClick={() => downloadAllAttachments(selectedTask._id, selectedTask.assignmentAttachment || [], 'assignment')}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download All ({selectedTask.assignmentAttachment.length})
                            </Button>
                            <div className="grid gap-1 max-h-20 overflow-y-auto">
                              {selectedTask.assignmentAttachment.map((attachment: string, index: number) => (
                                <a 
                                  key={index}
                                  href={attachment} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                >
                                  <FileText className="h-3 w-3" />
                                  File {index + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : "None"}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <FileText className="h-3 w-3 text-gray-500" /> Task Remarks
                      </td>
                      <td className="p-2 sm:p-3 break-words">{selectedTask.TaskRemarks || "None"}</td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <FileText className="h-3 w-3 text-gray-500" /> Assignment Remarks
                      </td>
                      <td className="p-2 sm:p-3 break-words">{selectedTask.assignmentRemarks || "None"}</td>
                    </tr>
                    {selectedTask.finalStatus === "rejected" && (
                      <>
                        <tr>
                          <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                            <AlertTriangle className="h-3 w-3 text-red-500" /> Solve Rejection Remarks
                          </td>
                          <td className="p-2 sm:p-3 break-words text-red-600">
                            {selectedTask.rejectionRemarks || "None"}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                            <Paperclip className="h-3 w-3 text-red-500" /> Rejection Attachments
                          </td>
                          <td className="p-2 sm:p-3 break-words">
                            {selectedTask.rejectionAttachment && Array.isArray(selectedTask.rejectionAttachment) && selectedTask.rejectionAttachment.length > 0 ? (
                              <div className="space-y-2">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                                  onClick={() => downloadAllAttachments(selectedTask._id, selectedTask.rejectionAttachment || [], 'rejection')}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Download All ({selectedTask.rejectionAttachment.length})
                                </Button>
                                <div className="grid gap-1 max-h-20 overflow-y-auto">
                                  {selectedTask.rejectionAttachment.map((attachment: string, index: number) => (
                                    <a 
                                      key={index}
                                      href={attachment} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-red-600 hover:underline text-xs flex items-center gap-1"
                                    >
                                      <FileText className="h-3 w-3" />
                                      File {index + 1}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : "None"}
                          </td>
                        </tr>
                        {selectedTask.developer_status_rejection && (
                          <tr>
                            <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                              <Info className="h-3 w-3 text-blue-500" /> Developer Rejection Status
                            </td>
                            <td className="p-2 sm:p-3 break-words">
                              <Badge variant="outline" className={
                                selectedTask.developer_status_rejection === "fixed" ? "bg-green-100 text-green-800 border-green-300" :
                                "bg-yellow-100 text-yellow-800 border-yellow-300"
                              }>
                                {selectedTask.developer_status_rejection}
                              </Badge>
                            </td>
                          </tr>
                        )}
                        {selectedTask.developer_rejection_remarks && (
                          <tr>
                            <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                              <FileText className="h-3 w-3 text-blue-500" /> Developer Solve Rejection Remarks
                            </td>
                            <td className="p-2 sm:p-3 break-words">{selectedTask.developer_rejection_remarks}</td>
                          </tr>
                        )}
                        {selectedTask.developer_rejection_solve_attachment && Array.isArray(selectedTask.developer_rejection_solve_attachment) && selectedTask.developer_rejection_solve_attachment.length > 0 && (
                          <tr>
                            <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                              <Paperclip className="h-3 w-3 text-blue-500" /> Developer Rejection Solve Attachments
                            </td>
                            <td className="p-2 sm:p-3 break-words">
                              <div className="space-y-2">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-xs"
                                  onClick={() => downloadAllAttachments(selectedTask._id, selectedTask.developer_rejection_solve_attachment || [], 'developer-rejection-solve')}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Download All ({selectedTask.developer_rejection_solve_attachment.length})
                                </Button>
                                <div className="grid gap-1 max-h-20 overflow-y-auto">
                                  {selectedTask.developer_rejection_solve_attachment.map((attachment: string, index: number) => (
                                    <a 
                                      key={index}
                                      href={attachment} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                    >
                                      <FileText className="h-3 w-3" />
                                      File {index + 1}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Paperclip className="h-3 w-3 text-gray-500" /> Developer Attachments
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        {selectedTask.developer_attachment && Array.isArray(selectedTask.developer_attachment) && selectedTask.developer_attachment.length > 0 ? (
                          <div className="space-y-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              onClick={() => downloadAllAttachments(selectedTask._id, selectedTask.developer_attachment || [], 'developer')}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download All ({selectedTask.developer_attachment.length})
                            </Button>
                            <div className="grid gap-1 max-h-20 overflow-y-auto">
                              {selectedTask.developer_attachment.map((attachment: string, index: number) => (
                                <a 
                                  key={index}
                                  href={attachment} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                >
                                  <FileText className="h-3 w-3" />
                                  File {index + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : "None"}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 text-xs sm:text-sm">
                        Status
                      </td>
                      <td className="p-2 sm:p-3">
                        <Badge variant="outline" className={
                          selectedTask.status === "assigned" ? "bg-blue-100 text-blue-800" :
                          selectedTask.status === "completed" ? "bg-green-100 text-green-800" :
                          selectedTask.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-800"
                        }>
                          {selectedTask.status}
                        </Badge>
                      </td>
                    </tr>
                    {selectedTask.developer_status && (
                      <tr>
                        <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 text-xs sm:text-sm">
                          Developer Status
                        </td>
                        <td className="p-2 sm:p-3">
                          <Badge variant="outline" className={
                            selectedTask.developer_status === "done" ? "bg-green-100 text-green-800" :
                            selectedTask.developer_status === "not-done" ? "bg-blue-100 text-blue-800" :
                            selectedTask.developer_status === "pending" ? "bg-yellow-100 text-yellow-800" :
                            "bg-gray-100 text-gray-800"
                          }>
                            {selectedTask.developer_status}
                          </Badge>
                        </td>
                      </tr>
                    )}
                    {selectedTask.finalStatus && (
                      <tr>
                        <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 text-xs sm:text-sm">
                          Final Status
                        </td>
                        <td className="p-2 sm:p-3">
                          <Badge variant="outline" className={
                            selectedTask.finalStatus === "done" ? "bg-green-100 text-green-800" :
                            selectedTask.finalStatus === "in-progress" ? "bg-blue-100 text-blue-800" :
                            selectedTask.finalStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
                            selectedTask.finalStatus === "rejected" ? "bg-red-100 text-red-800" :
                            "bg-gray-100 text-gray-800"
                          }>
                            {selectedTask.finalStatus}
                          </Badge>
                        </td>
                      </tr>
                    )}
                    {selectedTask.developer_done_date && (
                      <tr>
                        <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                          <Calendar className="h-3 w-3 text-gray-500" /> Developer Completed At
                        </td>
                        <td className="p-2 sm:p-3 break-words">
                          {new Date(selectedTask.developer_done_date).toLocaleString()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDoneDialogOpen} onOpenChange={(open) => {
        setIsDoneDialogOpen(open);
        if (!open) {
          setSelectedTask(null);
          setDeveloperRemarks("");
          setDeveloperAttachments([]);
          setDeveloperRejectionSolveAttachments([]);
          setDeveloperStatusRejection("fixed");
          setDeveloperRejectionRemarks("");
        }
      }}>
        <DialogContent className="w-[95vw] max-w-[360px] sm:max-w-lg md:max-w-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Mark Task as Done</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Provide details for task {selectedTask?.code || ""}
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border rounded-lg bg-gray-50">
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="p-2 font-medium w-[80px] sm:w-[100px] shrink-0 flex items-center gap-1 text-xs">
                        <Building className="h-3 w-3 text-gray-500" /> Company
                      </td>
                      <td className="p-2 break-words">{selectedTask.company?.name}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium w-[80px] sm:w-[100px] shrink-0 flex items-center gap-1 text-xs">
                        <FileText className="h-3 w-3 text-gray-500" /> Work
                      </td>
                      <td className="p-2 break-words">{selectedTask.working}</td>
                    </tr>
                    {selectedTask.finalStatus === "rejected" && (
                      <>
                        <tr>
                          <td className="p-2 font-medium w-[80px] sm:w-[100px] shrink-0 flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="h-3 w-3 text-red-500" /> Solve Rejection Remarks
                          </td>
                          <td className="p-2 break-words text-red-600">
                            {selectedTask.rejectionRemarks || "None"}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 font-medium w-[80px] sm:w-[100px] shrink-0 flex items-center gap-1 text-xs text-red-600">
                            <Paperclip className="h-3 w-3 text-red-500" /> Rejection Attachments
                          </td>
                          <td className="p-2 break-words">
                            {selectedTask.rejectionAttachment && Array.isArray(selectedTask.rejectionAttachment) && selectedTask.rejectionAttachment.length > 0 ? (
                              <div className="space-y-1">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                                  onClick={() => downloadAllAttachments(selectedTask._id, selectedTask.rejectionAttachment || [], 'rejection')}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Download All ({selectedTask.rejectionAttachment.length})
                                </Button>
                                <div className="grid gap-1 max-h-16 overflow-y-auto">
                                  {selectedTask.rejectionAttachment.map((attachment: string, index: number) => (
                                    <a 
                                      key={index}
                                      href={attachment} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-red-600 hover:underline text-xs flex items-center gap-1"
                                    >
                                      <FileText className="h-3 w-3" />
                                      File {index + 1}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : "None"}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2">
                <Label htmlFor="developerRemarks" className="text-xs font-medium">Developer Remarks *</Label>
                <Textarea
                  id="developerRemarks"
                  value={developerRemarks}
                  onChange={(e) => setDeveloperRemarks(e.target.value)}
                  placeholder="Enter remarks about task completion"
                  rows={3}
                  className="w-full text-xs min-h-[60px] max-h-[80px]"
                />
              </div>

              {selectedTask.finalStatus === "rejected" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="developerStatusRejection" className="text-xs font-medium">Rejection Status *</Label>
                    <Select value={developerStatusRejection} onValueChange={setDeveloperStatusRejection}>
                      <SelectTrigger className="w-full text-xs h-8">
                        <SelectValue placeholder="Select rejection status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="developerRejectionRemarks" className="text-xs font-medium">Solve Rejection Remarks *</Label>
                    <Textarea
                      id="developerRejectionRemarks"
                      value={developerRejectionRemarks}
                      onChange={(e) => setDeveloperRejectionRemarks(e.target.value)}
                      placeholder="Enter remarks about how you fixed the rejection"
                      rows={3}
                      className="w-full text-xs min-h-[60px] max-h-[80px]"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="files" className="text-xs font-medium">Attach Files (Optional)</Label>
                <div className="border rounded-md p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-3 w-3" />
                      <span className="text-xs font-medium">Developer Files</span>
                    </div>
                    <div className="relative">
                      <Input
                        id="files"
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.txt"
                        onChange={(e) => handleFileChange(e, setDeveloperAttachments)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7">
                        <Paperclip className="h-3 w-3 mr-1" />
                        Add Files
                      </Button>
                    </div>
                  </div>
                  
                  {developerAttachments.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Selected files:</div>
                      <div className="grid gap-1 max-h-20 overflow-y-auto">
                        {developerAttachments.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-1 bg-muted/50 rounded-md">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="h-3 w-3 flex-shrink-0" />
                              <span className="text-xs truncate max-w-[200px]">{file.name}</span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index, setDeveloperAttachments, developerAttachments)}
                              className="h-5 w-5 p-0"
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedTask.finalStatus === "rejected" && (
                <div className="space-y-2">
                  <Label htmlFor="rejectionSolveFiles" className="text-xs font-medium">Rejection Solve Attachments (Optional)</Label>
                  <div className="border rounded-md p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-3 w-3" />
                        <span className="text-xs font-medium">Rejection Solve Files</span>
                      </div>
                      <div className="relative">
                        <Input
                          id="rejectionSolveFiles"
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.txt"
                          onChange={(e) => handleFileChange(e, setDeveloperRejectionSolveAttachments)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button type="button" variant="outline" size="sm" className="text-xs h-7">
                          <Paperclip className="h-3 w-3 mr-1" />
                          Add Files
                        </Button>
                      </div>
                    </div>
                    
                    {developerRejectionSolveAttachments.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Selected files:</div>
                        <div className="grid gap-1 max-h-20 overflow-y-auto">
                          {developerRejectionSolveAttachments.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-1 bg-muted/50 rounded-md">
                              <div className="flex items-center gap-2 truncate">
                                <FileText className="h-3 w-3 flex-shrink-0" />
                                <span className="text-xs truncate max-w-[200px]">{file.name}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  ({(file.size / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(index, setDeveloperRejectionSolveAttachments, developerRejectionSolveAttachments)}
                                className="h-5 w-5 p-0"
                              >
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-3">
                <Button
                  onClick={handleDoneTask}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-xs py-1.5"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Submitting...
                    </div>
                  ) : (
                    selectedTask.finalStatus === "rejected" ? "Fix & Complete" : "Mark as Done"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDoneDialogOpen(false)}
                  className="text-xs py-1.5"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}