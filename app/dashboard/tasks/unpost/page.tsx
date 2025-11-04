"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Archive, Edit, Loader2, FileText, X, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { ITask } from "@/models/Task";

interface UserSession {
  id: string;
  username: string;
}

interface Developer {
  _id: string;
  username: string;
  name: string;
  role: {
    name: string;
    permissions: string[];
  };
}

// Helper function to safely normalize attachments
const normalizeAttachments = (attachments: any): string[] => {
  if (!attachments) return [];
  if (Array.isArray(attachments)) {
    return attachments.filter((att): att is string => typeof att === 'string' && att.length > 0);
  }
  return typeof attachments === 'string' && attachments.length > 0 ? [attachments] : [];
};

export default function UnpostTasksPage() {
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ITask | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tasksPerPage, setTasksPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<ITask | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newDeveloperFiles, setNewDeveloperFiles] = useState<File[]>([]);
  const [newTaskFiles, setNewTaskFiles] = useState<File[]>([]);
  const [newAssignmentFiles, setNewAssignmentFiles] = useState<File[]>([]);
  const [newCompletionFiles, setNewCompletionFiles] = useState<File[]>([]);
  const [existingTaskAttachments, setExistingTaskAttachments] = useState<string[]>([]);
  const [existingAssignmentAttachments, setExistingAssignmentAttachments] = useState<string[]>([]);
  const [existingCompletionAttachments, setExistingCompletionAttachments] = useState<string[]>([]);
  const [existingDeveloperAttachments, setExistingDeveloperAttachments] = useState<string[]>([]);

  // Helper function to get download URL for any attachment
  const getDownloadUrl = (attachment: string): string => {
    if (attachment.startsWith('/')) {
      return `${window.location.origin}${attachment}`;
    } else if (/^[0-9a-fA-F]{24}$/.test(attachment)) {
      return `/api/files/download?fileId=${attachment}`;
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
      description: "Starting download...",
      duration: 2000,
    });

    try {
      const zip = new JSZip();
      const failedDownloads: string[] = [];

      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        
        try {
          let fileUrl: string;
          let fileName: string;

          if (attachment.startsWith('/')) {
            fileUrl = `${window.location.origin}${attachment}`;
            fileName = `file-${i + 1}${getFileExtensionFromPath(attachment)}`;
          } else if (/^[0-9a-fA-F]{24}$/.test(attachment)) {
            fileUrl = `/api/files/download?fileId=${attachment}`;
            fileName = `file-${i + 1}`;
          } else if (attachment.startsWith('http')) {
            fileUrl = attachment;
            fileName = `file-${i + 1}`;
          } else {
            fileUrl = `/api/files/download?fileId=${attachment}`;
            fileName = `file-${i + 1}`;
          }

          const response = await fetch(fileUrl);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const blob = await response.blob();
          
          if (blob.size === 0) {
            throw new Error('Empty file received');
          }

          const contentDisposition = response.headers.get('content-disposition');
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch[1]) {
              fileName = filenameMatch[1];
            }
          }

          zip.file(fileName, blob);
          
        } catch (error) {
          console.error(`Failed to download file ${i + 1}:`, error);
          failedDownloads.push(`File ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
          zip.file(`error-file-${i + 1}.txt`, `Failed to download: ${attachment}\nError: ${error}`);
        }
      }

      const content = await zip.generateAsync({ 
        type: "blob",
        compression: "STORE"
      });
      
      saveAs(content, `task-${taskId}-${type}-attachments.zip`);

      if (failedDownloads.length > 0) {
        toast({
          title: "Download Complete with Errors",
          description: `Downloaded ${attachments.length - failedDownloads.length} files, ${failedDownloads.length} failed`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Download Complete",
          description: `Successfully downloaded ${attachments.length} files`,
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

  // Helper function to get file extension from path
  const getFileExtensionFromPath = (path: string): string => {
    const match = path.match(/\.([a-zA-Z0-9]+)$/);
    return match ? `.${match[1]}` : '';
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
      if (!parsedUser?.id || !parsedUser?.username) {
        toast({
          title: "Session Error",
          description: "Invalid user data. Please log in again.",
          variant: "destructive",
        });
        localStorage.removeItem("user");
        router.push("/login");
        return;
      }
      setUser(parsedUser);
    } catch (error) {
      toast({
        title: "Session Error",
        description: "Invalid session data. Please log in again.",
        variant: "destructive",
      });
      localStorage.removeItem("user");
      router.push("/login");
    }
  }, [router, toast]);

  const fetchDevelopers = async () => {
    try {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Filter users with developer role
      const developerUsers = data.filter((user: Developer) =>
        user.role && user.role.name === "developer"
      );
      setDevelopers(developerUsers);
    } catch (error) {
      console.error("Failed to fetch developers:", error);
      toast({
        title: "Error fetching developers",
        description: "Could not load developers. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/tasks?status=completed");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ITask[] = await response.json();
      const normalizedTasks = data.map((task: ITask) => ({
        ...task,
        company: task.company && task.company.name && task.company.city && task.company.address
          ? task.company
          : { id: "", name: "N/A", city: "N/A", address: "N/A", companyRepresentative: "", support: "" },
        contact: task.contact && task.contact.name && task.contact.phone
          ? task.contact
          : { name: "N/A", phone: "N/A" },
        assignedTo: task.assignedTo &&
                    task.assignedTo.id &&
                    task.assignedTo.username &&
                    task.assignedTo.name &&
                    task.assignedTo.role &&
                    task.assignedTo.role.name
          ? task.assignedTo
          : null,
        TasksAttachment: normalizeAttachments(task.TasksAttachment),
        assignmentAttachment: normalizeAttachments(task.assignmentAttachment),
        completionAttachment: normalizeAttachments(task.completionAttachment),
        developer_attachment: normalizeAttachments(task.developer_attachment),
        developer_status: task.developer_status || "pending",
      }));
      setTasks(normalizedTasks);
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
      fetchDevelopers();
    }
  }, [user]);

  const handleOpenEditModal = (task: ITask) => {
    setSelectedTask({
      ...task,
      company: task.company || { id: "", name: "", city: "", address: "", companyRepresentative: "", support: "" },
      contact: task.contact || { name: "", phone: "" },
      TasksAttachment: normalizeAttachments(task.TasksAttachment),
      assignmentAttachment: normalizeAttachments(task.assignmentAttachment),
      completionAttachment: normalizeAttachments(task.completionAttachment),
      developer_attachment: normalizeAttachments(task.developer_attachment),
      developer_status: task.developer_status || "pending",
    });
    
    // Set existing attachments
    setExistingTaskAttachments(normalizeAttachments(task.TasksAttachment));
    setExistingAssignmentAttachments(normalizeAttachments(task.assignmentAttachment));
    setExistingCompletionAttachments(normalizeAttachments(task.completionAttachment));
    setExistingDeveloperAttachments(normalizeAttachments(task.developer_attachment));
    
    // Reset new files
    setNewDeveloperFiles([]);
    setNewTaskFiles([]);
    setNewAssignmentFiles([]);
    setNewCompletionFiles([]);
    setIsModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFiles: React.Dispatch<React.SetStateAction<File[]>>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number, setFiles: React.Dispatch<React.SetStateAction<File[]>>) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index: number, setAttachments: React.Dispatch<React.SetStateAction<string[]>>, attachmentType: string) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleModalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTask) {
      toast({
        title: "Error",
        description: "Missing task data. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    // Ensure all required fields are included
    formData.append("code", selectedTask.code || "");
    formData.append("company", JSON.stringify({
      name: selectedTask.company?.name || "",
      city: selectedTask.company?.city || "",
      address: selectedTask.company?.address || "",
      companyRepresentative: selectedTask.company?.companyRepresentative || "",
      support: selectedTask.company?.support || "",
    }));
    formData.append("contact", JSON.stringify({
      name: selectedTask.contact?.name || "",
      phone: selectedTask.contact?.phone || "",
    }));
    formData.append("working", formData.get("working") as string || selectedTask.working || "");
    formData.append("dateTime", formData.get("dateTime") as string || selectedTask.dateTime || "");
    formData.append("priority", selectedTask.priority || "Normal");
    formData.append("status", selectedTask.status || "completed");
    formData.append("UnpostStatus", "unposted");
    formData.append("assigned", selectedTask.assigned ? "true" : "false");

    // Handle assignedTo
    const assignedToId = formData.get("assignedTo") as string;
    formData.delete("assignedTo"); // Remove the original field

    if (assignedToId && assignedToId.trim() !== "") {
      const assignedDeveloper = developers.find(dev => dev._id === assignedToId);
      if (assignedDeveloper) {
        const assignedToData = {
          id: assignedDeveloper._id,
          username: assignedDeveloper.username,
          name: assignedDeveloper.name,
          role: { name: assignedDeveloper.role.name },
        };
        formData.append("assignedTo", JSON.stringify(assignedToData));
      } else {
        console.warn("No developer found for assignedToId:", assignedToId);
        formData.append("assignedTo", "");
      }
    } else {
      formData.append("assignedTo", "");
    }

    formData.append("approved", selectedTask.approved ? "true" : "false");
    formData.append("completionApproved", selectedTask.completionApproved ? "true" : "false");
    formData.append("unposted", "true");
    formData.append("TaskRemarks", formData.get("TaskRemarks") as string || selectedTask.TaskRemarks || "");
    formData.append("assignmentRemarks", formData.get("assignmentRemarks") as string || selectedTask.assignmentRemarks || "");
    formData.append("completionRemarks", formData.get("completionRemarks") as string || selectedTask.completionRemarks || "");
    formData.append("developerRemarks", formData.get("developerRemarks") as string || selectedTask.developer_remarks || "");
    formData.append("developerStatus", formData.get("developerStatus") as string || selectedTask.developer_status || "");

    // Append existing attachments that haven't been removed
    existingTaskAttachments.forEach((attachment, index) => {
      formData.append(`existingTasksAttachment[${index}]`, attachment);
    });

    existingAssignmentAttachments.forEach((attachment, index) => {
      formData.append(`existingAssignmentAttachment[${index}]`, attachment);
    });

    existingCompletionAttachments.forEach((attachment, index) => {
      formData.append(`existingCompletionAttachment[${index}]`, attachment);
    });

    existingDeveloperAttachments.forEach((attachment, index) => {
      formData.append(`existingDeveloperAttachment[${index}]`, attachment);
    });

    // Append new files
    newTaskFiles.forEach((file) => {
      formData.append("TasksAttachment", file);
    });

    newAssignmentFiles.forEach((file) => {
      formData.append("assignmentAttachment", file);
    });

    newCompletionFiles.forEach((file) => {
      formData.append("completionAttachment", file);
    });

    newDeveloperFiles.forEach((file) => {
      formData.append("developerAttachment", file);
    });

    if (selectedTask.approvedAt) {
      formData.append("approvedAt", selectedTask.approvedAt);
    }
    if (selectedTask.assignedDate) {
      formData.append("assignedDate", selectedTask.assignedDate);
    }

    try {
      const response = await fetch(`/api/tasks/unpost/${selectedTask._id}`, {
        method: "PUT",
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || "Failed to update task");
      }

      const updatedTask = responseData;
      setTasks((prev) =>
        prev.map((task) =>
          task._id === updatedTask._id ? { ...task, ...updatedTask } : task
        )
      );
      setIsModalOpen(false);
      toast({
        title: "Task Unposted Successfully",
        description: "The task has been moved back for review.",
        duration: 5000,
        className: "bg-green-100 text-green-800 border border-green-200",
      });
    } catch (error: any) {
      console.error("Failed to update task:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${taskToDelete._id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete task");
      }

      setTasks(tasks.filter(task => task._id !== taskToDelete._id));
      setDeleteDialogOpen(false);
      toast({
        title: "Task Deleted",
        description: `Task ${taskToDelete.code} has been deleted successfully.`,
      });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Pagination logic
  const indexOfLastTask = currentPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = tasks.slice(indexOfFirstTask, indexOfLastTask);
  const totalPages = Math.ceil(tasks.length / tasksPerPage);

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
        <h1 className="text-3xl font-bold text-orange-600">
          Unpost Tasks
        </h1>
        <p className="text-muted-foreground">Unpost tasks to move them back for review</p>
      </div>

      <Card>
        <CardHeader className="py-4 bg-orange-50">
          <div className="flex flex-col items-start gap-4">
            <CardTitle className="flex items-center gap-2 text-lg text-orange-700">
              <Archive className="h-4 w-4" />
              Tasks ({tasks.length})
            </CardTitle>
            <CardDescription className="text-sm">Click the action button to edit or delete a task</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No tasks available</p>
              <p className="text-xs">Tasks will appear here once available</p>
            </div>
          ) : (
            <div className="responsive-table max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-orange-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">Code</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">Company</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">City</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">Address</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">Work</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {currentTasks.map((task, index) => (
                    <tr
                      key={task._id}
                      className={`${index % 2 === 0 ? "bg-white" : "bg-orange-50/30"} hover:bg-orange-100 transition-colors`}
                    >
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs font-mono border-orange-300">
                          {task.code?.split("-")[1] || task.code}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <Building className="h-3 w-3 text-gray-400 mr-1" />
                          <span className="font-medium text-gray-900 truncate max-w-[80px] sm:max-w-24" title={task.company?.name || "N/A"}>
                            {task.company?.name || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-gray-900 text-xs">{task.company?.city || "N/A"}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-gray-900 truncate max-w-[100px] block text-xs" title={task.company?.address || "N/A"}>
                          {task.company?.address || "N/A"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-gray-900 truncate max-w-[100px] block text-xs" title={task.working || "N/A"}>
                          {task.working || "N/A"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge className="bg-green-600 text-xs">
                          {task.status || "N/A"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditModal(task)}
                            className="text-orange-600 border-orange-300 hover:bg-orange-100"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setTaskToDelete(task);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {/* Pagination */}
        {tasks.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
            </div>

            <Button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete task {taskToDelete?.code}? This action cannot be undone.
            </p>
          </DialogHeader>
          <div className="flex gap-4 justify-end">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTask}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Task Modal */}
      {selectedTask && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="w-[95vw] max-w-[800px] max-h-[80vh] overflow-y-auto bg-gray-50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1IiBoZWlnaHQ9IjUiPgo8cmVjdCB3aWR0aD0iNSIgaGVpZ2h0PSI1IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxwYXRoIGQ9Ik0wIDVMNSAwWk02IDRMNCA2Wk0tMSAxTDEgLTFaIiBzdHJva2U9IiNlMGUwZTAiIHN0cm9rZS13aWR0aD0iMSI+PC9wYXRoPgo8L3N2Zz4=')]">
            <DialogHeader>
              <DialogTitle className="text-left border-b pb-2 text-orange-700">
                Unpost Task - {selectedTask.code}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleModalSubmit}>
              <div className="grid gap-4 py-4">
                {/* Company Details */}
                <div className="bg-white p-4 rounded-lg border">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Building className="h-4 w-4" /> Company Details
                  </h3>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="companyName" className="text-left text-gray-600">
                      Company Name
                    </Label>
                    <Input
                      id="companyName"
                      name="companyName"
                      defaultValue={selectedTask.company?.name || ""}
                      className="col-span-3"
                      disabled
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="companyCity" className="text-left text-gray-600">
                      City
                    </Label>
                    <Input
                      id="companyCity"
                      name="companyCity"
                      defaultValue={selectedTask.company?.city || ""}
                      className="col-span-3"
                      disabled
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="companyAddress" className="text-left text-gray-600">
                      Address
                    </Label>
                    <Input
                      id="companyAddress"
                      name="companyAddress"
                      defaultValue={selectedTask.company?.address || ""}
                      className="col-span-3"
                      disabled
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-white p-4 rounded-lg border">
                  <h3 className="font-semibold text-gray-700 mb-3">Contact Information</h3>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="contactName" className="text-left text-gray-600">
                      Contact Name
                    </Label>
                    <Input
                      id="contactName"
                      name="contactName"
                      defaultValue={selectedTask.contact?.name || ""}
                      className="col-span-3"
                      disabled
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="contactPhone" className="text-left text-gray-600">
                      Contact Phone
                    </Label>
                    <Input
                      id="contactPhone"
                      name="contactPhone"
                      defaultValue={selectedTask.contact?.phone || ""}
                      className="col-span-3"
                      disabled
                    />
                  </div>
                </div>

                {/* Task Details */}
                <div className="bg-white p-4 rounded-lg border">
                  <h3 className="font-semibold text-gray-700 mb-3">Task Details</h3>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="working" className="text-left text-gray-600">
                      Work Description
                    </Label>
                    <Textarea
                      id="working"
                      name="working"
                      defaultValue={selectedTask.working || ""}
                      className="col-span-3"
                      onChange={(e) => {
                        setSelectedTask({
                          ...selectedTask,
                          working: e.target.value,
                        });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="dateTime" className="text-left text-gray-600">
                      Date & Time
                    </Label>
                    <Input
                      id="dateTime"
                      name="dateTime"
                      type="datetime-local"
                      defaultValue={selectedTask.dateTime ? new Date(selectedTask.dateTime).toISOString().slice(0, 16) : ""}
                      className="col-span-3"
                      onChange={(e) => {
                        setSelectedTask({
                          ...selectedTask,
                          dateTime: e.target.value,
                        });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="priority" className="text-left text-gray-600">
                      Priority
                    </Label>
                    <Input
                      id="priority"
                      name="priority"
                      value={selectedTask.priority || "Normal"}
                      className="col-span-3"
                      disabled
                    />
                  </div>
                </div>

                {/* Assignment Details */}
                <div className="bg-white p-4 rounded-lg border">
                  <h3 className="font-semibold text-gray-700 mb-3">Assignment Details</h3>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="assignedTo" className="text-left text-gray-600">
                      Assigned To
                    </Label>
                    <Select
                      name="assignedTo"
                      value={selectedTask.assignedTo?.id || ""}
                      onValueChange={(value) => {
                        const developer = developers.find(dev => dev._id === value);
                        setSelectedTask({
                          ...selectedTask,
                          assignedTo: developer
                            ? {
                                id: developer._id,
                                username: developer.username,
                                name: developer.name,
                                role: { name: developer.role.name },
                              }
                            : null,
                        });
                      }}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a developer" />
                      </SelectTrigger>
                      <SelectContent>
                        {developers.map((developer) => (
                          <SelectItem key={developer._id} value={developer._id}>
                            {developer.name} ({developer.username})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="assignedDate" className="text-left text-gray-600">
                      Assigned Date
                    </Label>
                    <Input
                      id="assignedDate"
                      name="assignedDate"
                      type="datetime-local"
                      defaultValue={selectedTask.assignedDate ? new Date(selectedTask.assignedDate).toISOString().slice(0, 16) : ""}
                      className="col-span-3"
                      onChange={(e) => {
                        setSelectedTask({
                          ...selectedTask,
                          assignedDate: e.target.value,
                        });
                      }}
                    />
                  </div>
                </div>

                {/* Developer Details */}
                <div className="bg-white p-4 rounded-lg border">
                  <h3 className="font-semibold text-gray-700 mb-3">Developer Details</h3>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="developerStatus" className="text-left text-gray-600">
                      Developer Status
                    </Label>
                    <Input
                      id="developerStatus"
                      name="developerStatus"
                      value={selectedTask.developer_status || "N/A"}
                      className="col-span-3"
                      disabled
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="developerRemarks" className="text-left text-gray-600">
                      Developer Remarks
                    </Label>
                    <Textarea
                      id="developerRemarks"
                      name="developerRemarks"
                      defaultValue={selectedTask.developer_remarks || ""}
                      className="col-span-3"
                      onChange={(e) => {
                        setSelectedTask({
                          ...selectedTask,
                          developer_remarks: e.target.value,
                        });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="developerAttachment" className="text-left text-gray-600">
                      Developer Attachments
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="developerAttachment"
                        name="developerAttachment"
                        type="file"
                        accept=".txt,.doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg,.gif,.bmp,.csv,.rtf,.odt,.ods,.odp"
                        multiple
                        onChange={(e) => handleFileChange(e, setNewDeveloperFiles)}
                      />
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">Existing Attachments:</p>
                        {existingDeveloperAttachments.length > 0 ? (
                          <div className="space-y-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              onClick={() => downloadAllAttachments(selectedTask._id, existingDeveloperAttachments, 'developer')}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download All ({existingDeveloperAttachments.length})
                            </Button>
                            <ul className="space-y-1">
                              {existingDeveloperAttachments.map((attachment, index) => (
                                <li key={index} className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <FileText className="h-3 w-3 mr-1" />
                                    <a 
                                      href={getDownloadUrl(attachment)} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-blue-600 hover:underline text-xs"
                                      onClick={(e) => handleFileClick(e, attachment)}
                                    >
                                      Attachment {index + 1}
                                    </a>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeExistingAttachment(index, setExistingDeveloperAttachments, "developer")}
                                    className="h-4 w-4 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No existing attachments</p>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">New Attachments:</p>
                        {newDeveloperFiles.length > 0 ? (
                          <ul className="space-y-1">
                            {newDeveloperFiles.map((file, index) => (
                              <li key={index} className="flex items-center justify-between">
                                <span className="text-xs">{file.name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(index, setNewDeveloperFiles)}
                                  className="h-4 w-4 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground">No new attachments added</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Approval Details */}
                <div className="bg-white p-4 rounded-lg border">
                  <h3 className="font-semibold text-gray-700 mb-3">Approval Details</h3>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="approved" className="text-left text-gray-600">
                      Approved
                    </Label>
                    <Input
                      id="approved"
                      name="approved"
                      value={selectedTask.approved ? "Yes" : "No"}
                      className="col-span-3"
                      disabled
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="completionApproved" className="text-left text-gray-600">
                      Completion Approved
                    </Label>
                    <Input
                      id="completionApproved"
                      name="completionApproved"
                      value={selectedTask.completionApproved ? "Yes" : "No"}
                      className="col-span-3"
                      disabled
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="approvedAt" className="text-left text-gray-600">
                      Approved At
                    </Label>
                    <Input
                      id="approvedAt"
                      name="approvedAt"
                      type="datetime-local"
                      defaultValue={selectedTask.approvedAt ? new Date(selectedTask.approvedAt).toISOString().slice(0, 16) : ""}
                      className="col-span-3"
                      onChange={(e) => {
                        setSelectedTask({
                          ...selectedTask,
                          approvedAt: e.target.value,
                        });
                      }}
                    />
                  </div>
                </div>

                {/* Remarks */}
                <div className="bg-white p-4 rounded-lg border">
                  <h3 className="font-semibold text-gray-700 mb-3">Remarks</h3>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="TaskRemarks" className="text-left text-gray-600">
                      Task Remarks
                    </Label>
                    <Textarea
                      id="TaskRemarks"
                      name="TaskRemarks"
                      defaultValue={selectedTask.TaskRemarks || ""}
                      className="col-span-3"
                      onChange={(e) => {
                        setSelectedTask({
                          ...selectedTask,
                          TaskRemarks: e.target.value,
                        });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="assignmentRemarks" className="text-left text-gray-600">
                      Assignment Remarks
                    </Label>
                    <Textarea
                      id="assignmentRemarks"
                      name="assignmentRemarks"
                      defaultValue={selectedTask.assignmentRemarks || ""}
                      className="col-span-3"
                      onChange={(e) => {
                        setSelectedTask({
                          ...selectedTask,
                          assignmentRemarks: e.target.value,
                        });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="completionRemarks" className="text-left text-gray-600">
                      Completion Remarks
                    </Label>
                    <Textarea
                      id="completionRemarks"
                      name="completionRemarks"
                      defaultValue={selectedTask.completionRemarks || ""}
                      className="col-span-3"
                      onChange={(e) => {
                        setSelectedTask({
                          ...selectedTask,
                          completionRemarks: e.target.value,
                        });
                      }}
                    />
                  </div>
                </div>

                {/* Attachments */}
                <div className="bg-white p-4 rounded-lg border">
                  <h3 className="font-semibold text-gray-700 mb-3">Attachments</h3>
                  
                  {/* Task Attachments */}
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="TasksAttachment" className="text-left text-gray-600">
                      Task Attachments
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="TasksAttachment"
                        name="TasksAttachment"
                        type="file"
                        accept=".txt,.doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg,.gif,.bmp,.csv,.rtf,.odt,.ods,.odp"
                        multiple
                        onChange={(e) => handleFileChange(e, setNewTaskFiles)}
                      />
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">Existing Attachments:</p>
                        {existingTaskAttachments.length > 0 ? (
                          <div className="space-y-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              onClick={() => downloadAllAttachments(selectedTask._id, existingTaskAttachments, 'task')}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download All ({existingTaskAttachments.length})
                            </Button>
                            <ul className="space-y-1">
                              {existingTaskAttachments.map((attachment, index) => (
                                <li key={index} className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <FileText className="h-3 w-3 mr-1" />
                                    <a 
                                      href={getDownloadUrl(attachment)} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-blue-600 hover:underline text-xs"
                                      onClick={(e) => handleFileClick(e, attachment)}
                                    >
                                      Attachment {index + 1}
                                    </a>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeExistingAttachment(index, setExistingTaskAttachments, "task")}
                                    className="h-4 w-4 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No existing attachments</p>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">New Attachments:</p>
                        {newTaskFiles.length > 0 ? (
                          <ul className="space-y-1">
                            {newTaskFiles.map((file, index) => (
                              <li key={index} className="flex items-center justify-between">
                                <span className="text-xs">{file.name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(index, setNewTaskFiles)}
                                  className="h-4 w-4 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground">No new attachments added</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Assignment Attachments */}
                  <div className="grid grid-cols-4 items-start gap-4 mb-3">
                    <Label htmlFor="assignmentAttachment" className="text-left text-gray-600">
                      Assignment Attachments
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="assignmentAttachment"
                        name="assignmentAttachment"
                        type="file"
                        accept=".txt,.doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg,.gif,.bmp,.csv,.rtf,.odt,.ods,.odp"
                        multiple
                        onChange={(e) => handleFileChange(e, setNewAssignmentFiles)}
                      />
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">Existing Attachments:</p>
                        {existingAssignmentAttachments.length > 0 ? (
                          <div className="space-y-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              onClick={() => downloadAllAttachments(selectedTask._id, existingAssignmentAttachments, 'assignment')}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download All ({existingAssignmentAttachments.length})
                            </Button>
                            <ul className="space-y-1">
                              {existingAssignmentAttachments.map((attachment, index) => (
                                <li key={index} className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <FileText className="h-3 w-3 mr-1" />
                                    <a 
                                      href={getDownloadUrl(attachment)} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-blue-600 hover:underline text-xs"
                                      onClick={(e) => handleFileClick(e, attachment)}
                                    >
                                      Attachment {index + 1}
                                    </a>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeExistingAttachment(index, setExistingAssignmentAttachments, "assignment")}
                                    className="h-4 w-4 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No existing attachments</p>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">New Attachments:</p>
                        {newAssignmentFiles.length > 0 ? (
                          <ul className="space-y-1">
                            {newAssignmentFiles.map((file, index) => (
                              <li key={index} className="flex items-center justify-between">
                                <span className="text-xs">{file.name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(index, setNewAssignmentFiles)}
                                  className="h-4 w-4 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground">No new attachments added</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Completion Attachments */}
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="completionAttachment" className="text-left text-gray-600">
                      Completion Attachments
                    </Label>
                    <div className="col-span-3">
                      <Input
                        id="completionAttachment"
                        name="completionAttachment"
                        type="file"
                        accept=".txt,.doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg,.gif,.bmp,.csv,.rtf,.odt,.ods,.odp"
                        multiple
                        onChange={(e) => handleFileChange(e, setNewCompletionFiles)}
                      />
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">Existing Attachments:</p>
                        {existingCompletionAttachments.length > 0 ? (
                          <div className="space-y-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              onClick={() => downloadAllAttachments(selectedTask._id, existingCompletionAttachments, 'completion')}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download All ({existingCompletionAttachments.length})
                            </Button>
                            <ul className="space-y-1">
                              {existingCompletionAttachments.map((attachment, index) => (
                                <li key={index} className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <FileText className="h-3 w-3 mr-1" />
                                    <a 
                                      href={getDownloadUrl(attachment)} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-blue-600 hover:underline text-xs"
                                      onClick={(e) => handleFileClick(e, attachment)}
                                    >
                                      Attachment {index + 1}
                                    </a>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeExistingAttachment(index, setExistingCompletionAttachments, "completion")}
                                    className="h-4 w-4 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No existing attachments</p>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">New Attachments:</p>
                        {newCompletionFiles.length > 0 ? (
                          <ul className="space-y-1">
                            {newCompletionFiles.map((file, index) => (
                              <li key={index} className="flex items-center justify-between">
                                <span className="text-xs">{file.name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(index, setNewCompletionFiles)}
                                  className="h-4 w-4 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground">No new attachments added</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Unposting Task...
                    </div>
                  ) : (
                    "Confirm Unpost"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}