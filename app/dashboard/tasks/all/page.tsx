"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  CheckSquare, 
  Clock, 
  XCircle, 
  Building, 
  User, 
  CheckCircle2, 
  Loader2, 
  FileText, 
  Calendar, 
  ClipboardList, 
  Phone, 
  AlertTriangle,
  ArrowUp,
  Info,
  Paperclip,
  Download,
  Trash2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import type { ITask } from "@/models/Task";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface UserSession {
  id: string
  username: string
  role: {
    id: string
    name: string
    permissions: string[]
  }
}

interface SoftwareInformation {
  softwareType: string;
  version: string;
  lastUpdated: string;
  _id: string;
}

export default function AllTasksPage() {
  const [tasks, setTasks] = useState<ITask[]>([])
  const [selectedTask, setSelectedTask] = useState<ITask | null>(null)
  const [taskStatus, setTaskStatus] = useState("")
  const [completionRemarks, setCompletionRemarks] = useState("")
  const [completionAttachments, setCompletionAttachments] = useState<File[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isApproving, setIsApproving] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const [user, setUser] = useState<UserSession | null>(null)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)

  // Helper function to get download URL for any attachment
  const getDownloadUrl = (attachment: string): string => {
    if (attachment.startsWith('/')) {
      return `${window.location.origin}${attachment}`;
    } else if (/^[0-9a-fA-F]{24}$/.test(attachment)) {
      return `/api/tasks?fileId=${attachment}`;
    }
    return attachment;
  };

  // Helper function to handle individual file click
  const handleFileClick = (e: React.MouseEvent, attachment: string) => {
    if (/^[0-9a-fA-F]{24}$/.test(attachment)) {
      e.preventDefault();
      const downloadUrl = getDownloadUrl(attachment);
      window.open(downloadUrl, '_blank');
    }
  };

  // Fast parallel download function
  const downloadAllAttachments = async (taskId: string, attachments: string[], type: string) => {
    // Early validation
    if (!attachments || attachments.length === 0) {
      toast({
        title: "No Files",
        description: "No attachments available to download",
        variant: "default",
      });
      return;
    }

    const toastId = toast({
      title: "Preparing Download",
      description: "Starting parallel download...",
      duration: 2000,
    });

    try {
      const zip = new JSZip();
      const failedDownloads: number[] = [];

      // Download ALL files in true parallel (no batching)
      const downloadPromises = attachments.map(async (attachment, index) => {
        try {
          const fileUrl = getDownloadUrl(attachment);
          
          const response = await fetch(fileUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          const blob = await response.blob();
          
          // Get filename from headers or use default
          let fileName = `file-${index + 1}`;
          const contentDisposition = response.headers.get('content-disposition');
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch) fileName = filenameMatch[1];
          } else if (/^[0-9a-fA-F]{24}$/.test(attachment)) {
            fileName = `attachment-${index + 1}`;
          }
          
          // Add to zip immediately
          zip.file(fileName, blob);
          return { success: true, index };
        } catch (error) {
          console.warn(`Failed to download file ${index + 1}:`, error);
          failedDownloads.push(index + 1);
          return { success: false, index };
        }
      });

      // Wait for ALL downloads to complete in parallel
      const results = await Promise.allSettled(downloadPromises);
      
      const successCount = results.filter(result => 
        result.status === 'fulfilled' && result.value?.success === true
      ).length;

      // Handle results immediately
      if (successCount === 0) {
        toast({
          title: "Download Failed",
          description: "Could not download any files",
          variant: "destructive",
        });
        return;
      }

      // Generate ZIP without compression for maximum speed
      toast({
        title: "Creating ZIP",
        description: "Finalizing download...",
        duration: 1000,
      });

      // Use STORE (no compression) for fastest ZIP creation
      const content = await zip.generateAsync({ 
        type: "blob",
        compression: "STORE",
        compressionOptions: { level: 0 }
      });
      
      // Immediate download
      saveAs(content, `task-${taskId}-${type}-attachments.zip`);

      // Show final result
      if (failedDownloads.length > 0) {
        toast({
          title: "Download Complete",
          description: `Downloaded ${successCount} files, ${failedDownloads.length} failed`,
          duration: 2000,
        });
      } else {
        toast({
          title: "Download Complete",
          description: `Successfully downloaded ${successCount} files`,
          duration: 2000,
        });
      }

    } catch (error) {
      console.error("Error in download process:", error);
      toast({
        title: "Download Error",
        description: "Failed to process download. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) {
      toast({
        title: "Session Expired",
        description: "Please log in to continue.",
        variant: "destructive",
      })
      router.push("/login")
      return
    }
    try {
      const parsedUser = JSON.parse(userData)
      if (!parsedUser?.role?.permissions.includes("tasks.complete")) {
        toast({
          title: "Access Denied",
          description: "You do not have permission to approve task completion.",
          variant: "destructive",
        })
        router.push("/dashboard")
        return
      }
      setUser(parsedUser)
    } catch (error) {
      console.error("Error parsing user data:", error)
      toast({
        title: "Session Error",
        description: "Invalid session data. Please log in again.",
        variant: "destructive",
      })
      localStorage.removeItem("user")
      router.push("/login")
    }
  }, [router, toast])

  // SSE for real-time updates
  useEffect(() => {
    if (!user) return;

    const es = new EventSource("/api/tasks/stream");
    setEventSource(es);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          const filteredTasks = data.filter((task: ITask) => 
            task.status === "assigned" || 
            (task.finalStatus === "in-progress" && task.developer_status_rejection === "fixed")
          );
          setTasks(filteredTasks);
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    es.onerror = (error) => {
      console.error("SSE connection error:", error);
      es.close();
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (user) {
          const newEs = new EventSource("/api/tasks/stream");
          setEventSource(newEs);
        }
      }, 5000);
    };

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [user]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/tasks/approved");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ITask[] = await response.json();
      const filteredTasks = data.filter(task => 
        task.status === "assigned" || 
        (task.finalStatus === "in-progress" && task.developer_status_rejection === "fixed")
      );
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setCompletionAttachments(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setCompletionAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleApproveTaskCompletion = async () => {
    if (!selectedTask || !taskStatus) {
      toast({
        title: "Status Required",
        description: "Please select a completion status for the task.",
        variant: "destructive",
      })
      return
    }

    setIsApproving(true)
    try {
      const formData = new FormData()
      formData.append("completionApproved", "true")
      formData.append("completionApprovedAt", new Date().toISOString())
      formData.append("finalStatus", taskStatus)
      formData.append("status", taskStatus === "done" ? "completed" : taskStatus)
      
      // Change field names based on status
      if (taskStatus === "rejected") {
        formData.append("rejectionRemarks", completionRemarks)
      } else {
        formData.append("completionRemarks", completionRemarks)
      }
      
      // Add all attachments
      completionAttachments.forEach((file) => {
        if (taskStatus === "rejected") {
          formData.append("rejectionAttachment", file)
        } else {
          formData.append("completionAttachment", file)
        }
      })

      // Calculate time taken if task is done
      if (taskStatus === "done" && selectedTask.assignedDate) {
        const assignedDate = new Date(selectedTask.assignedDate)
        const completionDate = new Date()
        const timeTaken = completionDate.getTime() - assignedDate.getTime()
        formData.append("timeTaken", timeTaken.toString())
      }

      const response = await fetch(`/api/tasks/${selectedTask._id}`, {
        method: "PUT",
        body: formData,
      })

      if (!response.ok) {
        const errorResponse = await response.json()
        console.error("API error response:", errorResponse)
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorResponse.message}`)
      }

      const updatedTask = await response.json()
      setTasks((prev) => prev.filter((task) => task._id !== selectedTask._id))

      toast({
        title: `Task ${taskStatus === "rejected" ? "Rejected" : "Completion Approved"}!`,
        description: `Task ${selectedTask.code} has been ${taskStatus === "rejected" ? "rejected" : "marked as completed"}.`,
        duration: 5000,
      })

      setIsDialogOpen(false)
      setSelectedTask(null)
      setTaskStatus("")
      setCompletionRemarks("")
      setCompletionAttachments([])
    } catch (error) {
      console.error("Failed to approve task completion:", error)
      toast({
        title: "Error",
        description: "Failed to approve task completion. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsApproving(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
      case "completed":
        return <CheckSquare className="h-4 w-4" />
      case "on-hold":
        return <Clock className="h-4 w-4" />
      case "not-done":
      case "rejected":
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done":
      case "completed":
        return "bg-green-600"
      case "on-hold":
        return "bg-yellow-600"
      case "not-done":
      case "rejected":
        return "bg-red-600"
      case "pending":
      case "approved":
      case "in-progress":
        return "bg-blue-600"
      default:
        return "bg-gray-600"
    }
  }

  const getDeveloperStatusColor = (status: string) => {
    switch (status) {
      case "done":
      case "fixed":
        return "bg-green-100 text-green-800 border-green-300"
      case "not-done":
        return "bg-red-100 text-red-800 border-red-300"
      case "on-hold":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const formatTimeTaken = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          All Tasks Management
        </h1>
        <p className="text-muted-foreground">Review and approve task completion status</p>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckSquare className="h-4 w-4" />
            All Approved Tasks ({tasks.length})
          </CardTitle>
          <CardDescription className="text-sm">Manage completion status of all approved tasks</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No approved tasks to manage</p>
              <p className="text-xs">Tasks will appear here once they are approved in the assignment section</p>
            </div>
          ) : (
            <div className="responsive-table max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-blue-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Code</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Company</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Work</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Assigned To</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Current Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Developer Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-blue-700 uppercase">Completion</th>
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
                      <td className="px-3 py-2">
                        <span className="text-gray-900 truncate max-w-[100px] block text-xs" title={task.working}>
                          {task.working}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                            <User className="h-3 w-3 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-blue-700 text-xs">{task.assignedTo?.name || "Unassigned"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={`text-xs ${getStatusColor(task.finalStatus || task.status || "approved")}`}>
                          {getStatusIcon(task.finalStatus || task.status || "approved")}
                          <span className="ml-1 capitalize">{task.finalStatus || task.status || "approved"}</span>
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-xs ${getDeveloperStatusColor(task.developer_status || "pending")}`}>
                          {task.developer_status || "pending"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {task.completionApproved ? (
                          <Badge className="bg-green-600 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700">
                            Pending Review
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {(!task.completionApproved || (task.finalStatus === "in-progress" && task.developer_status_rejection === "fixed")) && (
                          <Button
                            onClick={() => {
                              setSelectedTask(task)
                              setIsDialogOpen(true)
                            }}
                            size="sm"
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-xs px-3 py-1"
                          >
                            Complete
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) {
          setSelectedTask(null)
          setTaskStatus("")
          setCompletionRemarks("")
          setCompletionAttachments([])
        }
      }}>
        <DialogContent className="w-[95vw] max-w-[360px] sm:max-w-lg md:max-w-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Approve Task Completion</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Approve completion for task {selectedTask?.code || ""}
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
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
                    {/* Software Information */}
                    {selectedTask.company?.id && typeof selectedTask.company.id === 'object' && 
                     'softwareInformation' in selectedTask.company.id && (
                      <tr>
                        <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                          <FileText className="h-3 w-3 text-gray-500" /> Software Info
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
                    {selectedTask.completionApprovedAt && (
                      <tr>
                        <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                          <Calendar className="h-3 w-3 text-gray-500" /> Completion Date
                        </td>
                        <td className="p-2 sm:p-3 break-words">
                          {new Date(selectedTask.completionApprovedAt).toLocaleString()}
                        </td>
                      </tr>
                    )}
                    {selectedTask.assignedDate && selectedTask.completionApprovedAt && (
                      <tr>
                        <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                          <Clock className="h-3 w-3 text-gray-500" /> Time Taken
                        </td>
                        <td className="p-2 sm:p-3 break-words">
                          {formatTimeTaken(
                            new Date(selectedTask.completionApprovedAt).getTime() - 
                            new Date(selectedTask.assignedDate).getTime()
                          )}
                        </td>
                      </tr>
                    )}
                    {/* Task Attachments */}
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
                                  href={getDownloadUrl(attachment)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                  onClick={(e) => handleFileClick(e, attachment)}
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
                    {/* Assignment Attachments */}
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Paperclip className="h-3 w-3 text-gray-500" /> Assignment Attachments
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
                                  href={getDownloadUrl(attachment)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                  onClick={(e) => handleFileClick(e, attachment)}
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
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <FileText className="h-3 w-3 text-gray-500" /> Developer Remarks
                      </td>
                      <td className="p-2 sm:p-3 break-words">{selectedTask.developer_remarks || "None"}</td>
                    </tr>
                    {/* Developer Attachments */}
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
                                  href={getDownloadUrl(attachment)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                  onClick={(e) => handleFileClick(e, attachment)}
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
                    {selectedTask.finalStatus === "in-progress" && (
                      <>
                        <tr>
                          <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                            <FileText className="h-3 w-3 text-gray-500" /> Rejection Remarks
                          </td>
                          <td className="p-2 sm:p-3 break-words">{selectedTask.rejectionRemarks || "None"}</td>
                        </tr>
                        {/* Rejection Attachments */}
                        <tr>
                          <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                            <Paperclip className="h-3 w-3 text-gray-500" /> Rejection Attachments
                          </td>
                          <td className="p-2 sm:p-3 break-words">
                            {selectedTask.rejectionAttachment && Array.isArray(selectedTask.rejectionAttachment) && selectedTask.rejectionAttachment.length > 0 ? (
                              <div className="space-y-2">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-xs"
                                  onClick={() => downloadAllAttachments(selectedTask._id, selectedTask.rejectionAttachment || [], 'rejection')}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Download All ({selectedTask.rejectionAttachment.length})
                                </Button>
                                <div className="grid gap-1 max-h-20 overflow-y-auto">
                                  {selectedTask.rejectionAttachment.map((attachment: string, index: number) => (
                                    <a 
                                      key={index}
                                      href={getDownloadUrl(attachment)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                      onClick={(e) => handleFileClick(e, attachment)}
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
                            <FileText className="h-3 w-3 text-gray-500" /> Developer Rejection Remarks
                          </td>
                          <td className="p-2 sm:p-3 break-words">{selectedTask.developer_rejection_remarks || "None"}</td>
                        </tr>
                        {/* Developer Rejection Solve Attachments */}
                        <tr>
                          <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                            <Paperclip className="h-3 w-3 text-gray-500" /> Developer Rejection Solve Attachments
                          </td>
                          <td className="p-2 sm:p-3 break-words">
                            {selectedTask.developer_rejection_solve_attachment && Array.isArray(selectedTask.developer_rejection_solve_attachment) && selectedTask.developer_rejection_solve_attachment.length > 0 ? (
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
                                      href={getDownloadUrl(attachment)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                      onClick={(e) => handleFileClick(e, attachment)}
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
                            Developer Status Rejection
                          </td>
                          <td className="p-2 sm:p-3">
                            <Badge variant="outline" className={`text-xs ${getDeveloperStatusColor(selectedTask.developer_status_rejection || "")}`}>
                              {selectedTask.developer_status_rejection || "N/A"}
                            </Badge>
                          </td>
                        </tr>
                      </>
                    )}
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
                            selectedTask.developer_status === "not-done" ? "bg-red-100 text-red-800" :
                            selectedTask.developer_status === "on-hold" ? "bg-yellow-100 text-yellow-800" :
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
                            selectedTask.finalStatus === "not-done" ? "bg-red-100 text-red-800" :
                            selectedTask.finalStatus === "on-hold" ? "bg-yellow-100 text-yellow-800" :
                            selectedTask.finalStatus === "in-progress" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-800"
                          }>
                            {selectedTask.finalStatus}
                          </Badge>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="taskStatus" className="text-xs sm:text-sm font-medium">Task Completion Status *</Label>
                  <Select value={taskStatus} onValueChange={setTaskStatus}>
                    <SelectTrigger className="w-full text-xs sm:text-sm">
                      <SelectValue placeholder="Select completion status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="done">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-green-600" />
                          Done - Task Completed Successfully
                        </div>
                      </SelectItem>
                      <SelectItem value="not-done">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Not Done - Task Not Completed
                        </div>
                      </SelectItem>
                      <SelectItem value="on-hold">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-600" />
                          On Hold - Task Paused
                        </div>
                      </SelectItem>
                      <SelectItem value="rejected">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Rejected - Task Rejected
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="completionRemarks" className="text-xs sm:text-sm font-medium">
                    {taskStatus === "rejected" ? "Rejection Remarks" : "Completion Remarks"}
                  </Label>
                  <Textarea
                    id="completionRemarks"
                    value={completionRemarks}
                    onChange={(e) => setCompletionRemarks(e.target.value)}
                    placeholder={taskStatus === "rejected" ? "Enter rejection remarks" : "Enter completion remarks"}
                    rows={3}
                    className="w-full text-xs sm:text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="completionAttachment" className="text-xs sm:text-sm font-medium">
                    {taskStatus === "rejected" ? "Rejection Attachments" : "Completion Attachments"} (Optional)
                  </Label>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {taskStatus === "rejected" ? "Rejection Files" : "Completion Files"}
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        id="files"
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.txt"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Button type="button" variant="outline" size="sm" className="text-xs">
                        <Paperclip className="h-3 w-3 mr-1" />
                        Add Files
                      </Button>
                    </div>
                  </div>
                  
                  {completionAttachments.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Selected files:</div>
                      <div className="grid gap-2 max-h-32 overflow-y-auto">
                        {completionAttachments.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="h-3 w-3 flex-shrink-0" />
                              <span className="text-xs truncate max-w-xs">{file.name}</span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button
                    onClick={handleApproveTaskCompletion}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-xs sm:text-sm py-2"
                    disabled={isApproving}
                  >
                    {isApproving ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {taskStatus === "rejected" ? "Rejecting..." : "Approving..."}
                      </div>
                    ) : (
                      taskStatus === "rejected" ? "Reject Task" : "Approve Completion"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="text-xs sm:text-sm py-2"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}