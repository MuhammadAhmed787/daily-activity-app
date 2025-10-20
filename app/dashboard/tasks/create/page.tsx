"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  CalendarIcon,
  Plus,
  Building,
  User,
  Phone,
  MapPin,
  FileText,
  ClipboardList,
  Sparkles,
  Loader2,
  Edit,
  Trash2,
  Search,
  Paperclip,
  AlertTriangle,
  TrendingUp,
  Info,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandInput
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface UserSession {
  id: string
  username: string
  role: {
    id: string
    name: string
    permissions: string[]
  }
}

interface Company {
  _id: string
  code: string
  companyName: string
  city: string
  address: string
  phoneNumber: string
  companyRepresentative: string
  support: string
  createdAt: string
  createdBy: string
  updatedAt: string
  __v: number
}

export default function CreateTaskPage() {
  const [task, setTask] = useState({
    code: `TSK-${Date.now()}`,
    company: {
      id: "",
      name: "",
      city: "",
      address: "",
      companyRepresentative: "",
      support: "",
    },
    contact: {
      name: "",
      phone: "",
    },
    working: "",
    dateTime: new Date().toISOString().slice(0, 16),
    priority: "Normal" as "Urgent" | "High" | "Normal",
    TaskRemarks: "",
    TasksAttachment: [] as File[],
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingTasks, setIsFetchingTasks] = useState(true)
  const [allTasks, setAllTasks] = useState<any[]>([])
  const [user, setUser] = useState<UserSession | null>(null)
  const [editingTask, setEditingTask] = useState<any | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

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
      if (!parsedUser?.role?.permissions.includes("tasks.create")) {
        toast({
          title: "Access Denied",
          description: "You do not have permission to create tasks.",
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

  // Also modify the fetchCompanies function to handle errors better
const fetchCompanies = async () => {
  try {
    const response = await fetch("/api/company_information");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    setCompanies(Array.isArray(data) ? data : [data]);
  } catch (error) {
    console.error("Failed to fetch companies:", error);
    toast({
      title: "Error fetching companies",
      description: "Could not load company data. Please try again.",
      variant: "destructive",
    });
  }
};

  useEffect(() => {
   if (user) {
    fetchCompanies();
  }

  let eventSource: EventSource | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  const connectToStream = () => {
    eventSource = new EventSource("/api/tasks/stream");

    eventSource.onopen = () => {
      console.log("Connected to task stream");
      reconnectAttempts = 0;
      setIsFetchingTasks(true);
    };

    eventSource.onmessage = (event) => {
      try {
        // Ignore heartbeat messages
        if (event.data.trim() === ": heartbeat") return;
        
        const tasks = JSON.parse(event.data);
        setAllTasks(tasks);
        setIsFetchingTasks(false);
      } catch (err) {
        console.error("Error parsing stream data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource error:", err);
      eventSource?.close();
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(connectToStream, 1000 * reconnectAttempts);
      } else {
        toast({
          title: "Connection Error",
          description: "Unable to connect to task updates. Please refresh the page.",
          variant: "destructive",
        });
        setIsFetchingTasks(false);
      }
    };
  };

  connectToStream();

  return () => {
    if (eventSource) {
      eventSource.close();
    }
  };
}, [user, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("code", task.code)
      formData.append("company", JSON.stringify(task.company))
      formData.append("contact", JSON.stringify(task.contact))
      formData.append("working", task.working)
      formData.append("dateTime", task.dateTime)
      formData.append("priority", task.priority)
      formData.append("status", "pending")
      formData.append("createdAt", new Date().toISOString())
      formData.append("createdBy", user?.id || "")
      formData.append("assigned", "false")
      formData.append("approved", "false")
      formData.append("unposted", "false")
      formData.append("TaskRemarks", task.TaskRemarks || "")
      
      task.TasksAttachment.forEach((file, index) => {
        formData.append(`TasksAttachment_${index}`, file)
      })
      formData.append("TasksAttachmentCount", task.TasksAttachment.length.toString())

      const response = await fetch("/api/tasks", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || "Unknown error"}`)
      }

      const createdTask = await response.json()
      // Optimistic update
      setAllTasks((prevTasks) => [...prevTasks, createdTask])

      toast({
        title: "Task Created Successfully! ✨",
        description: `Task ${createdTask.code} has been created and is ready for assignment.`,
        duration: 5000,
      })

      setTask({
        code: `TSK-${Date.now()}`,
        company: {
          id: "",
          name: "",
          city: "",
          address: "",
          companyRepresentative: "",
          support: "",
        },
        contact: {
          name: "",
          phone: "",
        },
        working: "",
        dateTime: new Date().toISOString().slice(0, 16),
        priority: "Normal",
        TaskRemarks: "",
        TasksAttachment: [],
      })
      setSelectedCompany(null)
    } catch (error) {
      console.error("Failed to create task:", error)
      toast({
        title: "Error",
        description: `Failed to create task: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTask) return
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("code", editingTask.code)
      formData.append("company", JSON.stringify(editingTask.company))
      formData.append("contact", JSON.stringify(editingTask.contact))
      formData.append("working", editingTask.working)
      formData.append("dateTime", editingTask.dateTime)
      formData.append("priority", editingTask.priority)
      formData.append("status", editingTask.status)
      formData.append("assigned", editingTask.assigned.toString())
      if (editingTask.assignedTo) formData.append("assignedTo", JSON.stringify(editingTask.assignedTo))
      formData.append("approved", editingTask.approved.toString())
      formData.append("unposted", editingTask.unposted.toString())
      formData.append("TaskRemarks", editingTask.TaskRemarks || "")
      
      if (Array.isArray(editingTask.existingAttachments)) {
        editingTask.existingAttachments.forEach((attachment: string) => {
          formData.append("existingAttachments", attachment)
        })
      }
      
      if (Array.isArray(editingTask.newAttachments)) {
        editingTask.newAttachments.forEach((file: File, index: number) => {
          formData.append(`newAttachments_${index}`, file)
        })
        formData.append("newAttachmentsCount", editingTask.newAttachments.length.toString())
      }

      const response = await fetch(`/api/tasks/${editingTask._id}`, {
        method: "PUT",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || "Unknown error"}`)
      }

      const updatedTask = await response.json()
      // Optimistic update
      setAllTasks((prevTasks) =>
        prevTasks.map((t) => (t._id === updatedTask._id ? updatedTask : t))
      )

      toast({
        title: "Task Updated Successfully! ✅",
        description: `Task ${updatedTask.code} has been updated.`,
        duration: 5000,
      })
      setEditingTask(null)
    } catch (error) {
      console.error("Failed to update task:", error)
      toast({
        title: "Error",
        description: `Failed to update task: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (taskId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || "Unknown error"}`)
      }

      // Optimistic update
      setAllTasks((prevTasks) => prevTasks.filter((t) => t._id !== taskId))
      toast({
        title: "Task Deleted Successfully! 🗑️",
        description: "The task has been removed from the system.",
        duration: 5000,
      })
    } catch (error) {
      console.error("Failed to delete task:", error)
      toast({
        title: "Error",
        description: `Failed to delete task: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setDeleteDialogOpen(false)
      setTaskToDelete(null)
    }
  }

  const handleCompanySelect = (company: Company | null) => {
    setSelectedCompany(company)
    if (company) {
      setTask(prev => ({
        ...prev,
        company: {
          id: company._id,
          name: company.companyName,
          city: company.city,
          address: company.address,
          companyRepresentative: company.companyRepresentative,
          support: company.support,
        }
      }))
    }
    setOpen(false)
  }

  const handleManualInput = () => {
    setSelectedCompany(null)
    setTask(prev => ({
      ...prev,
      company: {
        id: "",
        name: "",
        city: "",
        address: "",
        companyRepresentative: "",
        support: "",
      }
    }))
    setOpen(false)
  }

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const validFiles = Array.from(files).filter(file => 
        file.type === "application/pdf" || 
        file.type.startsWith("image/") ||
        file.type.includes("spreadsheet") ||
        file.type.includes("word") ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls") ||
        file.name.endsWith(".doc") ||
        file.name.endsWith(".docx")
      )
      
      if (validFiles.length > 0) {
        setTask(prev => ({ ...prev, TasksAttachment: [...prev.TasksAttachment, ...validFiles] }))
        toast({
          title: "Files Selected",
          description: `${validFiles.length} files have been selected for attachment.`,
        })
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please upload PDF, image, Excel, or Word files.",
          variant: "destructive",
        })
      }
    }
  }

  const handleEditAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const validFiles = Array.from(files).filter(file => 
        file.type === "application/pdf" || 
        file.type.startsWith("image/") ||
        file.type.includes("spreadsheet") ||
        file.type.includes("word") ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls") ||
        file.name.endsWith(".doc") ||
        file.name.endsWith(".docx")
      )
      
      if (validFiles.length > 0) {
        setEditingTask((prev: any) => ({ 
          ...prev, 
          newAttachments: [...(prev.newAttachments || []), ...validFiles] 
        }))
        toast({
          title: "Files Selected",
          description: `${validFiles.length} files have been selected for attachment.`,
        })
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please upload PDF, image, Excel, or Word files.",
          variant: "destructive",
        })
      }
    }
  }

  const removeAttachment = (index: number) => {
    setTask(prev => ({
      ...prev,
      TasksAttachment: prev.TasksAttachment.filter((_, i) => i !== index)
    }))
  }

  const removeEditAttachment = (index: number, isNew: boolean) => {
    if (isNew) {
      setEditingTask((prev: any) => ({
        ...prev,
        newAttachments: prev.newAttachments.filter((_: any, i: number) => i !== index)
      }))
    } else {
      setEditingTask((prev: any) => ({
        ...prev,
        existingAttachments: prev.existingAttachments.filter((_: string, i: number) => i !== index)
      }))
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
            <Plus className="h-6 w-6 text-white" />
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
          Create New Task
        </h1>
        <p className="text-muted-foreground">Add a new task to your daily activity workflow</p>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/20 animate-slide-in">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-t-xl border-b border-emerald-200/50">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Task Information
            </CardTitle>
            <CardDescription>Fill in the details for your new task</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-medium">
                    Task Code
                  </Label>
                  <Input id="code" value={task.code} readOnly className="bg-muted/50 font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">Auto-generated unique identifier</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dateTime" className="text-sm font-medium">
                    Date & Time
                  </Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="dateTime"
                      type="datetime-local"
                      value={task.dateTime}
                      onChange={(e) => setTask((prev) => ({ ...prev, dateTime: e.target.value }))}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-sm font-medium">
                    Priority
                  </Label>
                  <Select
                    value={task.priority}
                    onValueChange={(value: "Urgent" | "High" | "Normal") => 
                      setTask(prev => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Urgent">
                        <div className="flex items-center">
                          <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                          Urgent
                        </div>
                      </SelectItem>
                      <SelectItem value="High">
                        <div className="flex items-center">
                          <TrendingUp className="h-4 w-4 text-orange-500 mr-2" />
                          High
                        </div>
                      </SelectItem>
                      <SelectItem value="Normal">
                        <div className="flex items-center">
                          <Info className="h-4 w-4 text-blue-500 mr-2" />
                          Normal
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-sm font-medium">
                    Company Name
                  </Label>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                      >
                        {selectedCompany ? selectedCompany.companyName : "Select company..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search company..." />
                        <CommandList>
                          <CommandEmpty>No companies found.</CommandEmpty>
                          <CommandGroup>
                            {companies.map((company) => (
                              <CommandItem
                                key={company._id}
                                value={company.companyName}
                                onSelect={() => handleCompanySelect(company)}
                              >
                                {company.companyName}
                              </CommandItem>
                            ))}
                            <CommandItem
                              value="manual"
                              onSelect={handleManualInput}
                            >
                              Enter manually
                            </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {selectedCompany && (
                <div className="bg-muted/30 rounded-lg p-4 border border-emerald-200/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Company Name</Label>
                      <p className="font-medium">{selectedCompany.companyName}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">City</Label>
                      <p>{selectedCompany.city}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Representative</Label>
                      <p>{selectedCompany.companyRepresentative || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">Support</Label>
                      <p>{selectedCompany.support || "N/A"}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs font-medium text-muted-foreground">Address</Label>
                      <p>{selectedCompany.address}</p>
                    </div>
                  </div>
                </div>
              )}

              {!selectedCompany && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="companyNameInput" className="text-sm font-medium">
                      Company Name
                    </Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="companyNameInput"
                        placeholder="Enter company name"
                        value={task.company.name}
                        onChange={(e) => setTask(prev => ({
                          ...prev,
                          company: {
                            ...prev.company,
                            name: e.target.value
                          }
                        }))}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="city" className="text-sm font-medium">
                        City
                      </Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="city"
                          placeholder="Enter city"
                          value={task.company.city}
                          onChange={(e) => setTask(prev => ({
                            ...prev,
                            company: {
                              ...prev.company,
                              city: e.target.value
                            }
                          }))}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-sm font-medium">
                        Address
                      </Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="address"
                          placeholder="Enter address"
                          value={task.company.address}
                          onChange={(e) => setTask(prev => ({
                            ...prev,
                            company: {
                              ...prev.company,
                              address: e.target.value
                            }
                          }))}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="companyRepresentative" className="text-sm font-medium">
                        Company Representative
                      </Label>
                      <Input
                        id="companyRepresentative"
                        placeholder="Enter company representative"
                        value={task.company.companyRepresentative}
                        onChange={(e) => setTask(prev => ({
                          ...prev,
                          company: {
                            ...prev.company,
                            companyRepresentative: e.target.value
                          }
                        }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="support" className="text-sm font-medium">
                        Support
                      </Label>
                      <Input
                        id="support"
                        placeholder="Enter support details"
                        value={task.company.support}
                        onChange={(e) => setTask(prev => ({
                          ...prev,
                          company: {
                            ...prev.company,
                            support: e.target.value
                          }
                        }))}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Contact Person Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Enter contact person name"
                      value={task.contact.name}
                      onChange={(e) => setTask(prev => ({
                        ...prev,
                        contact: {
                          ...prev.contact,
                          name: e.target.value
                        }
                      }))}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactNo" className="text-sm font-medium">
                    Contact Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="contactNo"
                      type="tel"
                      placeholder="Enter contact number"
                      value={task.contact.phone}
                      onChange={(e) => setTask(prev => ({
                        ...prev,
                        contact: {
                          ...prev.contact,
                          phone: e.target.value
                        }
                      }))}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="working" className="text-sm font-medium">
                  Work Description
                </Label>
                <Textarea
                  id="working"
                  placeholder="Describe the work to be done..."
                  value={task.working}
                  onChange={(e) => setTask((prev) => ({ ...prev, working: e.target.value }))}
                  className="min-h-[100px] resize-none"
                  required
                />
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-medium">Task Attachments</Label>
                <div className="border rounded-md p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      <span className="text-sm font-medium">Attachments</span>
                    </div>
                    <div className="relative">
                      <Input
                        id="TasksAttachment"
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
                        onChange={handleAttachmentChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Button type="button" variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Files
                      </Button>
                    </div>
                  </div>
                  
                  {task.TasksAttachment.length > 0 && (
                    <div className="space-y-2">
  <div className="text-xs text-muted-foreground">Selected files:</div>
  <div className="grid gap-2">
    {task.TasksAttachment.map((file, index) => (
      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm truncate max-w-xs">{file.name}</span>
          <span className="text-xs text-muted-foreground">
            ({(file.size / 1024).toFixed(1)} KB)
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => removeAttachment(index)}
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

              <div className="space-y-2">
                <Label htmlFor="TaskRemarks" className="text-sm font-medium">
                  Task Remarks
                </Label>
                <Textarea
                  id="TaskRemarks"
                  placeholder="Enter task remarks..."
                  value={task.TaskRemarks}
                  onChange={(e) => setTask(prev => ({ ...prev, TaskRemarks: e.target.value }))}
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transition-all-smooth"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Task...
                    </div>
                  ) : (
                    "Create Task"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  className="sm:px-8 hover:bg-muted/50 transition-all-smooth"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
          <DialogContent className="w-[95vw] max-w-[500px] sm:max-w-[600px] md:max-w-[700px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Edit Task</DialogTitle>
            </DialogHeader>
            {editingTask && (
              <form onSubmit={handleEdit} className="space-y-4 sm:space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-code" className="text-xs sm:text-sm">Task Code</Label>
                    <Input id="edit-code" value={editingTask.code} readOnly className="bg-muted/50 font-mono text-xs sm:text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-dateTime" className="text-xs sm:text-sm">Date & Time</Label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-dateTime"
                        type="datetime-local"
                        value={editingTask.dateTime.slice(0, 16)}
                        onChange={(e) =>
                          setEditingTask((prev: any) => ({ ...prev, dateTime: e.target.value }))
                        }
                        className="pl-8 text-xs sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="edit-priority" className="text-xs sm:text-sm">Priority</Label>
                  <Select
                    value={editingTask.priority || "Normal"}
                    onValueChange={(value: "Urgent" | "High" | "Normal") =>
                      setEditingTask((prev: any) => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger className="w-full text-xs sm:text-sm">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Urgent">
                        <div className="flex items-center">
                          <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                          Urgent
                        </div>
                      </SelectItem>
                      <SelectItem value="High">
                        <div className="flex items-center">
                          <TrendingUp className="h-4 w-4 text-orange-500 mr-2" />
                          High
                        </div>
                      </SelectItem>
                      <SelectItem value="Normal">
                        <div className="flex items-center">
                          <Info className="h-4 w-4 text-blue-500 mr-2" />
                          Normal
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="edit-companyName" className="text-xs sm:text-sm">Company Name</Label>
                  <div className="relative">
                    <Building className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-companyName"
                      placeholder="Enter company name"
                      value={editingTask.company.name}
                      onChange={(e) =>
                        setEditingTask((prev: any) => ({
                          ...prev,
                          company: {
                            ...prev.company,
                            name: e.target.value
                          }
                        }))
                      }
                      className="pl-8 text-xs sm:text-sm"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-city" className="text-xs sm:text-sm">City</Label>
                    <div className="relative">
                      <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-city"
                        placeholder="Enter city"
                        value={editingTask.company.city}
                        onChange={(e) =>
                          setEditingTask((prev: any) => ({
                            ...prev,
                            company: {
                              ...prev.company,
                              city: e.target.value
                            }
                          }))
                        }
                        className="pl-8 text-xs sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="edit-address" className="text-xs sm:text-sm">Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-address"
                        placeholder="Enter address"
                        value={editingTask.company.address}
                        onChange={(e) =>
                          setEditingTask((prev: any) => ({
                            ...prev,
                            company: {
                              ...prev.company,
                              address: e.target.value
                            }
                          }))
                        }
                        className="pl-8 text-xs sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
                
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-companyRepresentative" className="text-xs sm:text-sm">Company Representative</Label>
                    <Input
                      id="edit-companyRepresentative"
                      placeholder="Enter company representative"
                      value={editingTask.company.companyRepresentative || ""}
                      onChange={(e) =>
                        setEditingTask((prev: any) => ({
                          ...prev,
                          company: {
                            ...prev.company,
                            companyRepresentative: e.target.value
                          }
                        }))
                      }
                      className="text-xs sm:text-sm"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="edit-support" className="text-xs sm:text-sm">Support</Label>
                    <Input
                      id="edit-support"
                      placeholder="Enter support details"
                      value={editingTask.company.support || ""}
                      onChange={(e) =>
                        setEditingTask((prev: any) => ({
                          ...prev,
                          company: {
                            ...prev.company,
                            support: e.target.value
                          }
                        }))
                      }
                      className="text-xs sm:text-sm"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="edit-name" className="text-xs sm:text-sm">Contact Person Name</Label>
                    <div className="relative">
                      <User className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-name"
                        placeholder="Enter contact person name"
                        value={editingTask.contact.name}
                        onChange={(e) => setEditingTask((prev: any) => ({
                          ...prev,
                          contact: {
                            ...prev.contact,
                            name: e.target.value
                          }
                        }))}
                        className="pl-8 text-xs sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="edit-contactNo" className="text-xs sm:text-sm">Contact Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-contactNo"
                        type="tel"
                        placeholder="Enter contact number"
                        value={editingTask.contact.phone}
                        onChange={(e) =>
                          setEditingTask((prev: any) => ({
                            ...prev,
                            contact: {
                              ...prev.contact,
                              phone: e.target.value
                            }
                          }))
                        }
                        className="pl-8 text-xs sm:text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="edit-working" className="text-xs sm:text-sm">Work Description</Label>
                  <Textarea
                    id="edit-working"
                    placeholder="Describe the work to be done..."
                    value={editingTask.working}
                    onChange={(e) => setEditingTask((prev: any) => ({ ...prev, working: e.target.value }))}
                    className="min-h-[80px] resize-none text-xs sm:text-sm"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm font-medium">Task Attachments</Label>
                  <div className="border rounded-md p-3 sm:p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        <span className="text-xs sm:text-sm font-medium">Attachments</span>
                      </div>
                      <div className="relative">
                        <Input
                          id="edit-TasksAttachment"
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
                          onChange={handleEditAttachmentChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button type="button" variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Files
                        </Button>
                      </div>
                    </div>
                    
                    {(editingTask.existingAttachments?.length > 0 || editingTask.newAttachments?.length > 0) && (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">Attachments:</div>
                        <div className="grid gap-2">
                          {editingTask.existingAttachments?.map((attachment: string, index: number) => (
                            <div key={`existing-${index}`} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="text-xs sm:text-sm truncate max-w-[150px] sm:max-w-xs">{attachment.split('/').pop()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <a 
                                  href={attachment} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs sm:text-sm"
                                >
                                  View
                                </a>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeEditAttachment(index, false)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {editingTask.newAttachments?.map((file: File, index: number) => (
                            <div key={`new-${index}`} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="text-xs sm:text-sm truncate max-w-[150px] sm:max-w-xs">{file.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({(file.size / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEditAttachment(index, true)}
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
                
                <div className="space-y-1">
                  <Label htmlFor="edit-TaskRemarks" className="text-xs sm:text-sm">Task Remarks</Label>
                  <Textarea
                    id="edit-TaskRemarks"
                    placeholder="Enter task remarks..."
                    value={editingTask.TaskRemarks || ""}
                    onChange={(e) => setEditingTask((prev: any) => ({ ...prev, TaskRemarks: e.target.value }))}
                    className="min-h-[80px] sm:min-h-[100px] resize-none text-xs sm:text-sm"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 pt-3">
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transition-all-smooth text-xs sm:text-sm"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </div>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingTask(null)}
                    className="px-4 sm:px-8 text-xs sm:text-sm"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Card
          className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/20 animate-slide-in"
          style={{ animationDelay: "0.2s" }}
        >
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-t-xl border-b border-blue-200/50 py-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-blue-600" />
              All Created Tasks ({allTasks.length})
            </CardTitle>
            <CardDescription className="text-sm">Complete list of all tasks created in the system</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isFetchingTasks ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-16 w-16 mx-auto mb-4 opacity-50 animate-spin" />
                <p className="text-lg font-medium">Loading tasks...</p>
              </div>
            ) : allTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No pending tasks found</p>
                <p className="text-sm">Create a new task using the form above</p>
              </div>
            ) : (
              <div className="responsive-table">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-muted/50 to-muted/30 border-b sticky top-0">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Code
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Company
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                          Contact
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                          Phone
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Priority
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Work
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                          Date
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Task Remarks
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Task Attachment
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-background divide-y divide-border/50">
                      {allTasks
                        .filter((task) => task.status === "pending")
                        .map((task, index) => (
                          <tr
                            key={task._id}
                            className={`${index % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/30 transition-colors`}
                          >
                            <td className="px-3 py-3">
                              <Badge variant="outline" className="text-xs font-mono">
                                {task.code?.split("-")[1]}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center">
                                <Building className="h-3 w-3 text-muted-foreground mr-2" />
                                <span
                                  className="font-medium text-foreground truncate max-w-[80px] sm:max-w-24"
                                  title={task.company.name}
                                >
                                  {task.company.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 hidden sm:table-cell">
                              <span className="text-foreground truncate max-w-20 block" title={task.contact.name}>
                                {task.contact.name}
                              </span>
                            </td>
                            <td className="px-3 py-3 hidden md:table-cell">
                              <span className="text-foreground text-xs">{task.contact.phone}</span>
                            </td>
                            <td className="px-3 py-3">
                              <Badge
                                className={`text-xs ${
                                  task.priority === "Urgent"
                                    ? "bg-red-100 text-red-700"
                                    : task.priority === "High"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {task.priority || "Normal"}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-foreground truncate max-w-[100px] block text-xs" title={task.working}>
                                {task.working}
                              </span>
                            </td>
                            <td className="px-3 py-3 hidden lg:table-cell">
                              <span className="text-foreground text-xs">
                                {new Date(task.dateTime).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <Badge
                                className={`text-xs ${
                                  task.finalStatus === "done"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : task.status === "approved"
                                      ? "bg-blue-100 text-blue-700"
                                      : task.status === "pending"
                                        ? "bg-amber-100 text-amber-700"
                                        : task.status === "unposted"
                                          ? "bg-orange-100 text-orange-700"
                                          : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {task.finalStatus || task.status || "pending"}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-foreground truncate max-w-[100px] block text-xs" title={task.TaskRemarks}>
                                {task.TaskRemarks || "None"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              {task.TasksAttachment && task.TasksAttachment.length > 0 ? (
                                <div className="flex flex-col">
                                  {task.TasksAttachment.slice(0, 2).map((attachment: string, index: number) => (
                                    <a key={index} href={attachment} target="_blank" className="text-blue-600 hover:underline text-xs mb-1">
                                      File {index + 1}
                                    </a>
                                  ))}
                                  {task.TasksAttachment.length > 2 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{task.TasksAttachment.length - 2} more
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">None</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingTask({
                                      ...task,
                                      existingAttachments: task.TasksAttachment || [],
                                      newAttachments: []
                                    })
                                  }}
                                  disabled={isLoading}
                                >
                                  <Edit className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Dialog open={deleteDialogOpen && taskToDelete === task._id} onOpenChange={(open) => {
                                  setDeleteDialogOpen(open)
                                  if (!open) setTaskToDelete(null)
                                }}>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={isLoading}
                                      onClick={() => setTaskToDelete(task._id)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                      <DialogTitle>Confirm Delete</DialogTitle>
                                      <DialogDescription>
                                        Are you sure you want to delete task {task.code}? This action cannot be undone.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex gap-4 justify-end">
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setDeleteDialogOpen(false)
                                          setTaskToDelete(null)
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        onClick={() => handleDelete(task._id)}
                                        disabled={isLoading}
                                      >
                                        {isLoading ? (
                                          <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Deleting...
                                          </div>
                                        ) : (
                                          "Confirm"
                                        )}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}