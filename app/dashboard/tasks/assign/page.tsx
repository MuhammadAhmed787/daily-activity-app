"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  UserCheck,
  Building,
  User,
  CheckCircle,
  Loader2,
  FileText,
  Calendar,
  ClipboardList,
  Phone,
  Paperclip,
  Download,
  Eye,
  AlertCircle,
  Clock,
  Zap,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Trash2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface UserSession {
  id: string
  username: string
  role: {
    id: string
    name: string
    permissions: string[]
  }
}

export default function TaskAssignPage() {
  const [pendingTasks, setPendingTasks] = useState<any[]>([])
  const [approvedTasks, setApprovedTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [assignmentData, setAssignmentData] = useState({
    userId: "",
    assignedDate: new Date().toISOString().slice(0, 16),
  })
  const [remarks, setRemarks] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false) // Add this line
  const [approvedPage, setApprovedPage] = useState(1)
  const [tasksPerPage, setTasksPerPage] = useState(5)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const [user, setUser] = useState<UserSession | null>(null)

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
      if (!parsedUser?.role?.permissions.includes("tasks.assign")) {
        toast({
          title: "Access Denied",
          description: "You do not have permission to assign tasks.",
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
    if (!user) return
    
    const eventSource = new EventSource('/api/tasks/stream')
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const pending = data.filter((task: any) => !task.approved)
        const approved = data.filter((task: any) => task.approved)
        setPendingTasks(pending)
        setApprovedTasks(approved)
      } catch (error) {
        console.error("Error parsing SSE data:", error)
      }
    }
    
    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error)
      eventSource.close()
    }
    
    return () => {
      eventSource.close()
    }
  }, [user])

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [pendingResponse, approvedResponse, usersResponse] = await Promise.all([
        fetch("/api/tasks/pending"),
        fetch("/api/tasks/approved"),
        fetch("/api/users"),
      ])

      if (!pendingResponse.ok || !approvedResponse.ok || !usersResponse.ok) {
        throw new Error(`HTTP error! Pending: ${pendingResponse.status}, Approved: ${approvedResponse.status}, Users: ${usersResponse.status}`)
      }

      const [pendingData, approvedData, usersData] = await Promise.all([
        pendingResponse.json(),
        approvedResponse.json(),
        usersResponse.json(),
      ])

      console.log("Fetched approved tasks:", approvedData)
      setPendingTasks(pendingData)
      setApprovedTasks(approvedData)
      setUsers(usersData)
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast({
        title: "Error fetching data",
        description: "Could not load tasks and users. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user, fetchData])

  const handleApproveTask = async () => {
    if (!selectedTask || !assignmentData.userId) {
      toast({
        title: "Assignment Required",
        description: "Please select a user to assign the task before approval.",
        variant: "destructive",
      })
      return
    }

    setIsAssigning(true)
    try {
      const selectedUser = users.find((u) => u._id === assignmentData.userId)
      if (!selectedUser) {
        throw new Error("Selected user not found")
      }

      const formData = new FormData()
      formData.append("taskId", selectedTask._id)
      formData.append("userId", selectedUser._id)
      formData.append("username", selectedUser.username)
      formData.append("name", selectedUser.name)
      formData.append("roleName", selectedUser.role?.name || "No Role")
      formData.append("assignedDate", assignmentData.assignedDate)
      formData.append("remarks", remarks)
      
      // Append all files
      files.forEach(file => {
        formData.append("files", file)
      })

      console.log("FormData before sending:", {
        taskId: selectedTask._id,
        userId: selectedUser._id,
        username: selectedUser.username,
        name: selectedUser.name,
        roleName: selectedUser.role?.name || "No Role",
        assignedDate: assignmentData.assignedDate,
        remarks,
        files: files.map(f => f.name),
      })

      const response = await fetch("/api/tasks/assign", {
        method: "PUT",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message}`)
      }

      const updatedTask = await response.json()
      console.log("Received updated task from API:", updatedTask)

      setPendingTasks((prev) => prev.filter((task) => task._id !== selectedTask._id))
      setApprovedTasks((prev) => [...prev, updatedTask])
      setApprovedPage(1) // Reset to first page after task approval

      toast({
        title: "Task Approved & Assigned Successfully! ✅",
        description: `Task ${selectedTask.code} has been approved and assigned to ${selectedUser.name}.`,
        duration: 5000,
      })

      setIsDialogOpen(false)
      setSelectedTask(null)
      setAssignmentData({
        userId: "",
        assignedDate: new Date().toISOString().slice(0, 16),
      })
      setRemarks("")
      setFiles([])
    } catch (error) {
      console.error("Failed to assign task:", error)
      toast({
        title: "Error",
        description: "Failed to assign task. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAssigning(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setFiles(prev => [...prev, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

const downloadAllAttachments = async (taskId: string) => {
  try {
    setIsDownloading(true);
    
    // First, get the list of files
    const listResponse = await fetch(`/api/tasks/assign?taskId=${taskId}`);
    
    if (!listResponse.ok) {
      const errorData = await listResponse.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(errorData.message || `Failed to get file list: ${listResponse.status}`);
    }

    const listData = await listResponse.json();
    
    if (!listData.files || listData.files.length === 0) {
      toast({
        title: "No Files",
        description: "No attachments found for this task",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Starting Downloads",
      description: `Downloading ${listData.files.length} files individually...`,
    });

    // Download each file individually
    let successCount = 0;
    
    for (const file of listData.files) {
      try {
        if (!file.isValidObjectId) {
          console.warn(`Skipping invalid file: ${file.id}`);
          continue;
        }

        const fileResponse = await fetch(file.downloadUrl);
        
        if (fileResponse.ok) {
          const blob = await fileResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          successCount++;
          
          // Small delay between downloads to avoid browser issues
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          console.warn(`Failed to download file: ${file.name}`);
        }
      } catch (fileError) {
        console.error(`Error downloading file ${file.name}:`, fileError);
      }
    }

    if (successCount > 0) {
      toast({
        title: "Downloads Complete",
        description: `Successfully downloaded ${successCount} out of ${listData.files.length} files`,
      });
    } else {
      toast({
        title: "Download Failed",
        description: "Could not download any files",
        variant: "destructive",
      });
    }
  } catch (error) {
    console.error("Error downloading attachments:", error);
    toast({
      title: "Download Failed",
      description: error instanceof Error ? error.message : "Could not download attachments",
      variant: "destructive",
    });
  } finally {
    setIsDownloading(false);
  }
};

// Fallback function for individual file downloads
const downloadFilesIndividually = async (taskId: string) => {
  try {
    // First, get the task to know what files we have
    const taskResponse = await fetch(`/api/tasks/${taskId}`);
    if (!taskResponse.ok) {
      throw new Error("Failed to fetch task details");
    }
    
    const task = await taskResponse.json();
    const allAttachments = [
      ...(task.TasksAttachment || []),
      ...(task.assignmentAttachment || [])
    ];

    if (allAttachments.length === 0) {
      toast({
        title: "No Files",
        description: "No attachments found for this task",
        variant: "destructive",
      });
      return;
    }

    let downloadedCount = 0;
    
    // Download each file individually
    for (const attachment of allAttachments) {
      try {
        const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(attachment);
        if (!isValidObjectId) continue;

        const fileResponse = await fetch(`/api/tasks/assign?taskId=${taskId}&fileId=${attachment}`);
        if (fileResponse.ok) {
          const blob = await fileResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `file-${downloadedCount + 1}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          downloadedCount++;
          
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (fileError) {
        console.error(`Error downloading individual file:`, fileError);
      }
    }

    toast({
      title: "Individual Downloads Started",
      description: `Started downloading ${downloadedCount} files individually`,
    });
  } catch (error) {
    console.error("Error in individual download fallback:", error);
    toast({
      title: "Download Failed",
      description: "Could not download files individually either",
      variant: "destructive",
    });
  }
};

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return <Zap className="h-3 w-3 text-red-500" />
      case "High":
        return <AlertCircle className="h-3 w-3 text-orange-500" />
      default:
        return <Clock className="h-3 w-3 text-blue-500" />
    }
  }

    // ADD DEBUGGING HERE:
  console.log("🔄 Starting file upload process...");
  console.log("📁 Total files to upload:", files.length);
  files.forEach((file, index) => {
    console.log(`File ${index + 1}:`, {
      name: file.name,
      type: file.type,
      size: file.size,
      extension: file.name.split('.').pop()
    });
  });

  setIsAssigning(true)

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return <Badge variant="destructive" className="text-xs flex items-center gap-1"><Zap className="h-3 w-3" /> Urgent</Badge>
      case "High":
        return <Badge className="bg-orange-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" /> High</Badge>
      default:
        return <Badge variant="secondary" className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> Normal</Badge>
    }
  }

  // Pagination logic for approved tasks
  const totalApprovedPages = Math.ceil(approvedTasks.length / tasksPerPage)
  const paginatedApprovedTasks = approvedTasks.slice(
    (approvedPage - 1) * tasksPerPage,
    approvedPage * tasksPerPage
  )

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading tasks and users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          Task Assignment & Approval
        </h1>
        <p className="text-muted-foreground">Review, assign, and approve tasks for team members</p>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="h-4 w-4" />
            Pending Tasks for Approval ({pendingTasks.length})
          </CardTitle>
          <CardDescription className="text-sm">Tasks created and waiting for assignment & approval</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pendingTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No pending tasks</p>
              <p className="text-xs">All tasks have been approved and assigned</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="bg-yellow-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700 uppercase">Code</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700 uppercase">Company</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700 uppercase">Contact</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700 uppercase hidden sm:table-cell">
                      Phone
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700 uppercase">Work</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700 uppercase">Priority</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700 uppercase hidden lg:table-cell">
                      Created At
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-yellow-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {pendingTasks.map((task, index) => (
                    <tr
                      key={task._id}
                      className={index % 2 === 0 ? "bg-white" : "bg-yellow-50/30 hover:bg-yellow-100 transition-colors"}
                    >
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs font-mono border-yellow-300">
                          {task.code?.split("-")[1]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <Building className="h-3 w-3 text-gray-400 mr-1" />
                          <span
                            className="font-medium text-gray-900 truncate max-w-[80px] sm:max-w-24"
                            title={task.company?.name}
                          >
                            {task.company?.name}
                          </span>
                        </div>
                        {task.company?.companyRepresentative && (
                          <div className="text-xs text-muted-foreground truncate max-w-[80px] sm:max-w-24" 
                               title={`Rep: ${task.company.companyRepresentative}`}>
                            Rep: {task.company.companyRepresentative}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-gray-900 truncate max-w-20 block" title={task.contact?.name}>
                          {task.contact?.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <span className="text-gray-900 truncate max-w-20 block" title={task.contact?.phone}>
                          {task.contact?.phone}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-gray-900 truncate max-w-[100px] block text-xs" title={task.working}>
                          {task.working}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {getPriorityBadge(task.priority || "Normal")}
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <span className="text-gray-900 text-xs">
                          {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "N/A"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge className="bg-yellow-600 text-xs">Pending Approval</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          onClick={() => {
                            setSelectedTask(task)
                            setIsDialogOpen(true)
                          }}
                          size="sm"
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-xs px-3 py-1"
                        >
                          Assign
                        </Button>
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
          setAssignmentData({
            userId: "",
            assignedDate: new Date().toISOString().slice(0, 16),
          })
          setRemarks("")
          setFiles([])
        }
      }}>
        <DialogContent className="w-[95vw] max-w-[360px] sm:max-w-lg md:max-w-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Approve & Assign Task</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Approve task {selectedTask?.code || ""} and assign it to a team member
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
                      <td className="p-2 sm:p-3 break-words">
                        <div>{selectedTask.company?.name}</div>
                        {selectedTask.company?.companyRepresentative && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Rep: {selectedTask.company.companyRepresentative}
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <User className="h-3 w-3 text-gray-500" /> Contact
                      </td>
                      <td className="p-2 sm:p-3 break-words">{selectedTask.contact?.name}</td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Phone className="h-3 w-3 text-gray-500" /> Phone
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        {selectedTask.contact?.phone || "N/A"}
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
                        <FileText className="h-3 w-3 text-gray-500" /> Task Remarks
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        {selectedTask.TaskRemarks || "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Zap className="h-3 w-3 text-gray-500" /> Priority
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        {getPriorityBadge(selectedTask.priority || "Normal")}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 flex items-center gap-1 text-xs sm:text-sm">
                        <Paperclip className="h-3 w-3 text-gray-500" /> Attachments
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        {selectedTask.TasksAttachment && selectedTask.TasksAttachment.length > 0 ? (
                          <div className="space-y-2">
                            <Button 
  type="button" 
  variant="outline" 
  size="sm" 
  className="text-xs"
  onClick={() => downloadAllAttachments(selectedTask._id)}
  disabled={isDownloading}
>
  {isDownloading ? (
    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
  ) : (
    <Download className="h-3 w-3 mr-1" />
  )}
  {isDownloading ? "Downloading..." : `Download All (${selectedTask.TasksAttachment.length})`}
</Button>
                            <div className="text-xs text-muted-foreground">Click individual files to download them separately:</div>
                            <div className="grid gap-1 max-h-20 overflow-y-auto">
                              {selectedTask.TasksAttachment.map((attachment: string, index: number) => {
                                const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(attachment);
                                const downloadUrl = isValidObjectId 
                                  ? `/api/tasks/assign?taskId=${selectedTask._id}&fileId=${attachment}`
                                  : attachment;

                                return (
                                  <a 
                                    key={index}
                                    href={downloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                                    onClick={(e) => {
                                      if (!isValidObjectId) {
                                        e.preventDefault();
                                        toast({
                                          title: "Legacy File",
                                          description: "This file is stored in legacy format and cannot be downloaded individually.",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  >
                                    <FileText className="h-3 w-3" />
                                    File {index + 1}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        ) : "N/A"}
                      </td>
                    </tr>
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
                        <Calendar className="h-3 w-3 text-gray-500" /> Scheduled
                      </td>
                      <td className="p-2 sm:p-3 break-words">
                        {new Date(selectedTask.dateTime).toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 sm:p-3 font-medium w-[100px] sm:w-[120px] shrink-0 text-xs sm:text-sm">
                        Status
                      </td>
                      <td className="p-2 sm:p-3">
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">
                          Pending Approval
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user" className="text-xs sm:text-sm font-medium">Assign to User *</Label>
                  <Select
                    value={assignmentData.userId}
                    onValueChange={(value) => setAssignmentData((prev) => ({ ...prev, userId: value }))}
                  >
                    <SelectTrigger className="w-full text-xs sm:text-sm">
                      <SelectValue placeholder="Choose a team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user._id} value={user._id} className="text-xs sm:text-sm">
                          {user.name} ({user.role?.name || "No Role"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignedDate" className="text-xs sm:text-sm font-medium">Assignment Date & Time *</Label>
                  <Input
                    id="assignedDate"
                    type="datetime-local"
                    value={assignmentData.assignedDate}
                    onChange={(e) =>
                      setAssignmentData((prev) => ({ ...prev, assignedDate: e.target.value }))
                    }
                    className="w-full text-xs sm:text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="remarks" className="text-xs sm:text-sm font-medium">Assign Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={remarks}
                    onChange={(e) => {
                      setRemarks(e.target.value)
                      console.log("Remarks updated in state:", e.target.value)
                    }}
                    placeholder="Enter any special instructions or remarks"
                    rows={3}
                    className="w-full text-xs sm:text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="files" className="text-xs sm:text-sm font-medium">Attach Files (Optional)</Label>
                  <div className="border rounded-md p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        <span className="text-sm font-medium">Assignment Files</span>
                      </div>
                      <div className="relative">
                        <Input
                          id="files"
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.txt,.csv,.json"
                          onChange={handleFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button type="button" variant="outline" size="sm" className="text-xs">
                          <Paperclip className="h-3 w-3 mr-1" />
                          Add Files
                        </Button>
                      </div>
                    </div>
                    
                    {files.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">Selected files:</div>
                        <div className="grid gap-2 max-h-32 overflow-y-auto">
                          {files.map((file, index) => (
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
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button
                  onClick={handleApproveTask}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-xs sm:text-sm py-2"
                  disabled={isAssigning}
                >
                  {isAssigning ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Assigning...
                    </div>
                  ) : (
                    "Approve & Assign Task"
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
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-4 w-4" />
            Approved Tasks ({approvedTasks.length})
          </CardTitle>
          <CardDescription className="text-sm">
            Tasks that have been approved and assigned to team members
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {approvedTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No approved tasks yet</p>
              <p className="text-xs">Approve tasks to see them here</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-green-50 border-b border-green-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Code</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Company</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase hidden sm:table-cell">
                        Work
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Priority</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Assigned To</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase hidden lg:table-cell">
                        Assigned Date
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Remarks</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Attachments</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {paginatedApprovedTasks.map((task, index) => (
                      <tr key={task._id} className={index % 2 === 0 ? "bg-green-50/30" : "bg-white"}>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs font-mono border-green-300">
                            {task.code?.split("-")[1]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center">
                            <Building className="h-3 w-3 text-gray-400 mr-1" />
                            <span
                              className="font-medium text-gray-900 truncate max-w-[80px] sm:max-w-24"
                              title={task.company?.name}
                            >
                              {task.company?.name}
                            </span>
                          </div>
                          {task.company?.companyRepresentative && (
                            <div className="text-xs text-muted-foreground truncate max-w-[80px] sm:max-w-24" 
                                 title={`Rep: ${task.company.companyRepresentative}`}>
                              Rep: {task.company.companyRepresentative}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <span className="text-gray-900 truncate max-w-[100px] block text-xs" title={task.working}>
                            {task.working}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {getPriorityIcon(task.priority || "Normal")}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-2">
                              <User className="h-3 w-3 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-green-700 text-xs">{task.assignedTo?.name || "Unassigned"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell">
                          <span className="text-gray-900 text-xs">
                            {task.assignedDate ? new Date(task.assignedDate).toLocaleString() : "N/A"}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[100px] truncate text-xs text-gray-600">
                          {task.assignmentRemarks || "N/A"}
                        </td>
                        <td className="px-3 py-2">
                          {task.assignmentAttachment && task.assignmentAttachment.length > 0 ? (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs h-6 p-1"
                              onClick={() => downloadAllAttachments(task._id)}
                              disabled={isDownloading}
                            >
                              {isDownloading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Download className="h-3 w-3" />
                              )}
                              <span className="ml-1">{task.assignmentAttachment.length}</span>
                            </Button>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className="bg-green-600 text-xs">✅ Assigned</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between p-4 flex-wrap gap-2">
                <Button
                  onClick={() => setApprovedPage((prev) => Math.max(prev - 1, 1))}
                  disabled={approvedPage === 1}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={tasksPerPage.toString()}
                    onValueChange={(value) => {
                      setTasksPerPage(Number(value))
                      setApprovedPage(1)
                    }}
                  >
                    <SelectTrigger className="w-20 text-xs sm:text-sm">
                      <SelectValue placeholder="Tasks per page" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="15">15</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: totalApprovedPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        onClick={() => setApprovedPage(page)}
                        variant={approvedPage === page ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-8 w-8 p-0"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={() => setApprovedPage((prev) => Math.min(prev + 1, totalApprovedPages))}
                  disabled={approvedPage === totalApprovedPages}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}