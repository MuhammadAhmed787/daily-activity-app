"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import * as XLSX from "xlsx"
import { useToast } from "@/hooks/use-toast"

export default function ExcelPrintPage() {
  const [task, setTask] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const taskId = searchParams.get("id")
  const action = searchParams.get("action")

  useEffect(() => {
    if (taskId) {
      fetchTask()
    }
  }, [taskId])

  useEffect(() => {
    if (task && action) {
      if (action === "print") {
        handlePrint()
      } else if (action === "export") {
        handleExport()
      }
    }
  }, [task, action])

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
        title: "Error",
        description: "Could not load task details. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    if (!task) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Failed to open print window",
        variant: "destructive",
      })
      return
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>PowerSoft Task Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; color: #2563eb; }
            .container { max-width: 800px; margin: 0 auto; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 1.2em; font-weight: bold; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f0f9ff; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>PowerSoft Daily Task Report</h1>
            
            <div class="section">
              <div class="section-title">Company Details</div>
              <table>
                <tr><th>Company Name</th><td>${task.company?.name || "N/A"}</td></tr>
                <tr><th>City</th><td>${task.company?.city || "N/A"}</td></tr>
                <tr><th>Address</th><td>${task.company?.address || "N/A"}</td></tr>
                <tr><th>Contact</th><td>${task.contact?.name || "N/A"} (${task.contact?.phone || "N/A"})</td></tr>
              </table>
            </div>

            <div class="section">
              <div class="section-title">Task Details</div>
              <table>
                <tr><th>Task Code</th><td>${task.code}</td></tr>
                <tr><th>Work Description</th><td>${task.working}</td></tr>
                <tr><th>Status</th><td>${task.finalStatus || task.status}</td></tr>
                <tr><th>Created At</th><td>${new Date(task.createdAt).toLocaleString()}</td></tr>
                <tr><th>Created By</th><td>${task.createdBy}</td></tr>
                <tr><th>Assigned</th><td>${task.assigned ? "Yes" : "No"}</td></tr>
                <tr><th>Assigned To</th><td>${task.assignedTo?.name || "N/A"}</td></tr>
                <tr><th>Assigned Date</th><td>${task.assignedDate ? new Date(task.assignedDate).toLocaleString() : "N/A"}</td></tr>
                <tr><th>Approved</th><td>${task.approved ? "Yes" : "No"}</td></tr>
                <tr><th>Approved At</th><td>${task.approvedAt ? new Date(task.approvedAt).toLocaleString() : "N/A"}</td></tr>
                <tr><th>Completion Approved</th><td>${task.completionApproved ? "Yes" : "No"}</td></tr>
                <tr><th>Completion Approved At</th><td>${task.completionApprovedAt ? new Date(task.completionApprovedAt).toLocaleString() : "N/A"}</td></tr>
                <tr><th>Task Remarks</th><td>${task.TaskRemarks || "N/A"}</td></tr>
                <tr><th>Assignment Remarks</th><td>${task.assignmentRemarks || "N/A"}</td></tr>
                <tr><th>Completion Remarks</th><td>${task.completionRemarks || "N/A"}</td></tr>
                <tr><th>Unposted</th><td>${task.unposted ? "Yes" : "No"}</td></tr>
                <tr><th>Unpost Status</th><td>${task.UnpostStatus || "N/A"}</td></tr>
              </table>
            </div>
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleExport = () => {
    if (!task) return

    const worksheetData = [
      ["PowerSoft Daily Task Report"],
      [],
      ["Company Details"],
      ["Company Name", task.company?.name || "N/A"],
      ["City", task.company?.city || "N/A"],
      ["Address", task.company?.address || "N/A"],
      ["Contact", `${task.contact?.name || "N/A"} (${task.contact?.phone || "N/A"})`],
      [],
      ["Task Details"],
      ["Task Code", task.code],
      ["Work Description", task.working],
      ["Status", task.finalStatus || task.status],
      ["Created At", new Date(task.createdAt).toLocaleString()],
      ["Created By", task.createdBy],
      ["Assigned", task.assigned ? "Yes" : "No"],
      ["Assigned To", task.assignedTo?.name || "N/A"],
      ["Assigned Date", task.assignedDate ? new Date(task.assignedDate).toLocaleString() : "N/A"],
      ["Approved", task.approved ? "Yes" : "No"],
      ["Approved At", task.approvedAt ? new Date(task.approvedAt).toLocaleString() : "N/A"],
      ["Completion Approved", task.completionApproved ? "Yes" : "No"],
      ["Completion Approved At", task.completionApprovedAt ? new Date(task.completionApprovedAt).toLocaleString() : "N/A"],
      ["Task Remarks", task.TaskRemarks || "N/A"],
      ["Assignment Remarks", task.assignmentRemarks || "N/A"],
      ["Completion Remarks", task.completionRemarks || "N/A"],
      ["Unposted", task.unposted ? "Yes" : "No"],
      ["Unpost Status", task.UnpostStatus || "N/A"],
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Task Report")
    
    // Auto-size columns
    const colWidths = worksheetData.reduce((acc, row) => {
      row.forEach((cell, i) => {
        const length = String(cell).length
        acc[i] = Math.max(acc[i] || 0, length)
      })
      return acc
    }, [])
    
    worksheet["!cols"] = colWidths.map(w => ({ wch: w + 2 }))

    XLSX.writeFile(workbook, `Task_${task.code}.xlsx`)
  }

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">
          {action === "export" ? "Generating Excel file..." : "Preparing print preview..."}
        </p>
      </div>
    </div>
  )
}