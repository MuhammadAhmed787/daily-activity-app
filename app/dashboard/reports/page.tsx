"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BarChart3,
  Calendar,
  Download,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Building,
  User,
  Loader2,
  Eye,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useMediaQuery } from "@/hooks/use-media-query"

export default function ReportsPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [reportType, setReportType] = useState("daily")
  const [reportData, setReportData] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const isMobile = useMediaQuery("(max-width: 640px)")
  const router = useRouter()

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/tasks")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setTasks(data)
      generateReport(data, reportType)
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
      toast({
        title: "Error fetching tasks",
        description: "Could not load tasks for reports. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [reportType, toast])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const generateReport = (tasks: any[], type: string) => {
    const now = new Date()
    let filteredTasks = []

    switch (type) {
      case "daily":
        filteredTasks = tasks.filter((task) => {
          const taskDate = new Date(task.createdAt)
          return taskDate.toDateString() === now.toDateString()
        })
        break
      case "weekly":
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
        filteredTasks = tasks.filter((task) => {
          const taskDate = new Date(task.createdAt)
          return taskDate >= weekStart
        })
        break
      case "monthly":
        filteredTasks = tasks.filter((task) => {
          const taskDate = new Date(task.createdAt)
          return taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear()
        })
        break
      default:
        filteredTasks = tasks
        break
    }

    const completed = filteredTasks.filter((t) => t.status === "completed" || t.finalStatus === "done").length
    const pending = filteredTasks.filter((t) => t.status === "pending").length
    const assigned = filteredTasks.filter((t) => t.status === "assigned" || t.approved).length
    const onHold = filteredTasks.filter((t) => t.status === "on-hold" || t.finalStatus === "on-hold").length

    setReportData({
      total: filteredTasks.length,
      completed,
      pending,
      assigned,
      onHold,
      tasks: filteredTasks,
      completionRate: filteredTasks.length > 0 ? (completed / filteredTasks.length) * 100 : 0,
    })
  }

  const getReportTitle = () => {
    switch (reportType) {
      case "daily":
        return "Daily Task Report"
      case "weekly":
        return "Weekly Task Report"
      case "monthly":
        return "Monthly Task Report"
      default:
        return "Task Report"
    }
  }

  const getReportPeriod = () => {
    const now = new Date()
    switch (reportType) {
      case "daily":
        return now.toLocaleDateString()
      case "weekly":
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        return `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`
      case "monthly":
        return now.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      default:
        return ""
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground text-xs sm:text-base">
            Track your productivity and task completion rates
          </p>
        </div>
        <div className="flex flex-col sm:flex-row w-full gap-2">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily Report</SelectItem>
              <SelectItem value="weekly">Weekly Report</SelectItem>
              <SelectItem value="monthly">Monthly Report</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="w-full sm:w-auto bg-transparent">
            <Download className="h-4 w-4 mr-2" />
            {isMobile ? "Export" : "Export Report"}
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 animate-slide-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            {getReportTitle()}
          </CardTitle>
          <CardDescription className="text-sm">
            <Calendar className="h-4 w-4 inline mr-1" />
            {getReportPeriod()}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500 animate-slide-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{reportData.total || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 animate-slide-in" style={{ animationDelay: "0.1s" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{reportData.completed || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 animate-slide-in" style={{ animationDelay: "0.2s" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{reportData.assigned || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 animate-slide-in" style={{ animationDelay: "0.3s" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{reportData.pending || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 animate-slide-in" style={{ animationDelay: "0.4s" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">On Hold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{reportData.onHold || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="animate-slide-in" style={{ animationDelay: "0.5s" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Completion Rate
          </CardTitle>
          <CardDescription>Task completion for selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-green-600">
                {reportData.completionRate?.toFixed(1) || 0}%
              </div>
              <p className="text-muted-foreground">Tasks Completed</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="space-y-1">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mx-auto" />
                <div className="text-base sm:text-lg font-semibold">{reportData.completed || 0}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div className="space-y-1">
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 mx-auto" />
                <div className="text-base sm:text-lg font-semibold">{reportData.assigned || 0}</div>
                <div className="text-xs text-muted-foreground">Assigned</div>
              </div>
              <div className="space-y-1">
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600 mx-auto" />
                <div className="text-base sm:text-lg font-semibold">{reportData.pending || 0}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="space-y-1">
                <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 mx-auto" />
                <div className="text-base sm:text-lg font-semibold">{reportData.onHold || 0}</div>
                <div className="text-xs text-muted-foreground">On Hold</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-slide-in" style={{ animationDelay: "0.6s" }}>
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4 w-4" />
            Task Details
          </CardTitle>
          <CardDescription className="text-sm">Detailed breakdown of tasks for the selected period</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-12 w-12 mx-auto mb-3 opacity-50 animate-spin" />
              <p className="text-base font-medium">Loading tasks...</p>
            </div>
          ) : reportData.tasks?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No tasks found for this period</p>
              <p className="text-xs">Tasks will appear here once created</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gradient-to-r from-purple-50 to-blue-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase">Code</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase">Company</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase hidden sm:table-cell">
                      Work
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase hidden md:table-cell">
                      Assigned To
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase hidden lg:table-cell">
                      Date
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase hidden xl:table-cell">
                      Progress
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {reportData.tasks?.map((task: any, index: number) => (
                    <tr key={task.id} className={index % 2 === 0 ? "bg-white" : "bg-purple-50/30"}>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="font-mono text-xs">
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
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <span className="text-gray-900 truncate max-w-[100px] block text-xs" title={task.working}>
                          {task.working}
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        {task.assignedTo ? (
                          <div className="flex items-center">
                            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-2">
                              <User className="h-3 w-3 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-medium text-purple-700 text-xs">{task.assignedTo.name}</p>
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-gray-500 text-xs">
                            Unassigned
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <span className="text-gray-900 text-xs">{new Date(task.createdAt).toLocaleDateString()}</span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          className={`text-xs ${
                            task.finalStatus === "done"
                              ? "bg-green-600"
                              : task.status === "assigned" || task.approved
                                ? "bg-blue-600"
                                : task.status === "pending"
                                  ? "bg-yellow-600"
                                  : "bg-red-600"
                          }`}
                        >
                          {(task.finalStatus === "done" || task.status === "completed") && (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          {(task.status === "assigned" || task.approved) && <Clock className="h-3 w-3 mr-1" />}
                          {task.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                          {(task.status === "on-hold" || task.finalStatus === "on-hold") && (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {task.finalStatus || task.status || "pending"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 hidden xl:table-cell">
                        <div className="flex items-center">
                          <div className="w-12 bg-gray-200 rounded-full h-1.5 mr-2">
                            <div
                              className={`h-1.5 rounded-full ${
                                task.finalStatus === "done"
                                  ? "bg-green-600 w-full"
                                  : task.status === "assigned" || task.approved
                                    ? "bg-blue-600 w-3/4"
                                    : task.status === "pending"
                                      ? "bg-yellow-600 w-1/4"
                                      : "bg-red-600 w-1/2"
                              }`}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600">
                            {task.finalStatus === "done"
                              ? "100%"
                              : task.status === "assigned" || task.approved
                                ? "75%"
                                : task.status === "pending"
                                  ? "25%"
                                  : "50%"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/reports/view?id=${task._id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
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
    </div>
  )
}