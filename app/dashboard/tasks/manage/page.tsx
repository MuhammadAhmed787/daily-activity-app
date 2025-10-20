"use client"

import { useState, useEffect } from "react"
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
import { CheckSquare, Clock, XCircle, Building, User, Loader2 } from "lucide-react"
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

export default function ManageTasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [newStatus, setNewStatus] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
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
      if (!parsedUser?.role?.permissions.includes("tasks.manage")) {
        toast({
          title: "Access Denied",
          description: "You do not have permission to manage tasks.",
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

  const fetchTasks = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/tasks/approved")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setTasks(data)
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
      toast({
        title: "Error fetching tasks",
        description: "Could not load tasks. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchTasks()
    }
  }, [user])

  const handleStatusUpdate = async () => {
    if (!selectedTask || !newStatus) {
      toast({
        title: "Error",
        description: "Please select a status.",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/tasks/${selectedTask._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          updatedAt: new Date().toISOString(),
          ...(newStatus === "unposted" && { unposted: true, unpostedAt: new Date().toISOString(), finalStatus: "unposted" }),
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const updatedTask = await response.json()

      setTasks((prev) => prev.map((task) => (task._id === selectedTask._id ? updatedTask : task)))

      toast({
        title: "Status Updated",
        description: `Task ${selectedTask.code} status updated to ${newStatus}.`,
        duration: 5000,
      })

      setIsDialogOpen(false)
      setSelectedTask(null)
      setNewStatus("")
    } catch (error) {
      console.error("Failed to update task:", error)
      toast({
        title: "Error",
        description: "Failed to update task status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckSquare className="h-4 w-4" />
      case "on-hold":
      case "unposted":
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-600"
      case "on-hold":
      case "unposted":
        return "bg-red-600"
      case "approved":
        return "bg-blue-600"
      default:
        return "bg-yellow-600"
    }
  }

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
          Manage Tasks
        </h1>
        <p className="text-muted-foreground">Update task status and track progress</p>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckSquare className="h-4 w-4" />
            All Tasks ({tasks.length})
          </CardTitle>
          <CardDescription className="text-sm">Manage and update the status of assigned tasks</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No assigned tasks to manage</p>
              <p className="text-xs">Tasks will appear here once they are assigned</p>
            </div>
          ) : (
            <div className="responsive-table max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Work</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {tasks.map((task, index) => (
                    <tr
                      key={task._id}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50 hover:bg-blue-50 transition-colors"}
                    >
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          {task.code?.split("-")[1]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <Building className="h-3 w-3 text-gray-400 mr-1" />
                          <span className="font-medium text-gray-900 truncate max-w-[80px] sm:max-w-24" title={task.companyName}>
                            {task.companyName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
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
                        <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                          {getStatusIcon(task.status)}
                          <span className="ml-1 capitalize">{task.status}</span>
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          onClick={() => {
                            setSelectedTask(task)
                            setIsDialogOpen(true)
                          }}
                          variant="outline"
                          size="sm"
                          className="text-xs px-3 py-1"
                        >
                          Update
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
          setNewStatus("")
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Task Status</DialogTitle>
            <DialogDescription>Change the status of task {selectedTask?.code || ""}</DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Status</label>
                <div className="p-2 bg-gray-50 rounded">
                  <Badge className={getStatusColor(selectedTask.status)}>
                    {getStatusIcon(selectedTask.status)}
                    <span className="ml-1 capitalize">{selectedTask.status}</span>
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">New Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Pending
                      </div>
                    </SelectItem>
                    <SelectItem value="approved">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Approved
                      </div>
                    </SelectItem>
                    <SelectItem value="completed">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4" />
                        Completed
                      </div>
                    </SelectItem>
                    <SelectItem value="on-hold">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        On Hold
                      </div>
                    </SelectItem>
                    <SelectItem value="unposted">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Unposted
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleStatusUpdate} className="flex-1" disabled={isUpdating}>
                  {isUpdating ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </div>
                  ) : (
                    "Update Status"
                  )}
                </Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}