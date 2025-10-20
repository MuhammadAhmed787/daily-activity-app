"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Printer, ArrowLeft, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function TaskViewPage() {
  const [task, setTask] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const taskId = searchParams.get("id")

  useEffect(() => {
    if (taskId) {
      fetchTask()
    }
  }, [taskId])

  const fetchTask = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/tasks?id=${taskId}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setTask(data[0])
    } catch (error) {
      console.error("Failed to fetch task:", error)
      toast({
        title: "Error fetching task",
        description: "Could not load task details. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    router.push(`/dashboard/reports/excel_print?action=print&id=${taskId}`)
  }

  const handleExport = () => {
    router.push(`/dashboard/reports/excel_print?action=export&id=${taskId}`)
  }

  const handleAttachmentClick = (attachmentPath: string) => {
    if (attachmentPath) {
      window.open(attachmentPath, "_blank")
    } else {
      toast({
        title: "No Attachment",
        description: "No file available for this attachment.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading task details...</p>
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-600">No task found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Button>
        <div className="flex gap-2">
          <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
        PowerSoft Daily Task Report
      </h1>

      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Company Name</p>
              <p className="text-lg">{task.company?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">City</p>
              <p className="text-lg">{task.company?.city || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Address</p>
              <p className="text-lg">{task.company?.address || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Contact</p>
              <p className="text-lg">{task.contact?.name || "N/A"} ({task.contact?.phone || "N/A"})</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Task Code</td>
                  <td className="px-4 py-2">{task.code}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Work Description</td>
                  <td className="px-4 py-2">{task.working}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Status</td>
                  <td className="px-4 py-2">{task.finalStatus || task.status}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Created At</td>
                  <td className="px-4 py-2">{new Date(task.createdAt).toLocaleString()}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Created By</td>
                  <td className="px-4 py-2">{task.createdByUsername || "N/A"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Assigned</td>
                  <td className="px-4 py-2">{task.assigned ? "Yes" : "No"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Assigned To</td>
                  <td className="px-4 py-2">{task.assignedTo?.name || "N/A"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Assigned Date</td>
                  <td className="px-4 py-2">{task.assignedDate ? new Date(task.assignedDate).toLocaleString() : "N/A"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Approved</td>
                  <td className="px-4 py-2">{task.approved ? "Yes" : "No"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Approved At</td>
                  <td className="px-4 py-2">{task.approvedAt ? new Date(task.approvedAt).toLocaleString() : "N/A"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Completion Approved</td>
                  <td className="px-4 py-2">{task.completionApproved ? "Yes" : "No"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Completion Approved At</td>
                  <td className="px-4 py-2">{task.completionApprovedAt ? new Date(task.completionApprovedAt).toLocaleString() : "N/A"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Task Remarks</td>
                  <td className="px-4 py-2">{task.TaskRemarks || "N/A"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Assignment Remarks</td>
                  <td className="px-4 py-2">{task.assignmentRemarks || "N/A"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Completion Remarks</td>
                  <td className="px-4 py-2">{task.completionRemarks || "N/A"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Unposted</td>
                  <td className="px-4 py-2">{task.unposted ? "Yes" : "No"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Unpost Status</td>
                  <td className="px-4 py-2">{task.UnpostStatus || "N/A"}</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Task Attachment</td>
                  <td className="px-4 py-2">
                    {task.TasksAttachment ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAttachmentClick(task.TasksAttachment)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Task Attachment
                      </Button>
                    ) : (
                      "N/A"
                    )}
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2 font-medium text-gray-600">Assignment Attachment</td>
                  <td className="px-4 py-2">
                    {task.assignmentAttachment ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAttachmentClick(task.assignmentAttachment)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Assignment Attachment
                      </Button>
                    ) : (
                      "N/A"
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium text-gray-600">Completion Attachment</td>
                  <td className="px-4 py-2">
                    {task.completionAttachment ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAttachmentClick(task.completionAttachment)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Completion Attachment
                      </Button>
                    ) : (
                      "N/A"
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}