"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Building,
  Phone,
  MapPin,
  FileText,
  ClipboardList,
  Sparkles,
  Loader2,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User,
  Package,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
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

interface SoftwareInfo {
  softwareType: string
  version: string
  lastUpdated: string
}

interface Company {
  _id?: string
  code: string
  companyName: string
  city: string
  phoneNumber: string
  address: string
  support: string
  designatedDeveloper: string
  companyRepresentative: string
  softwareInformation: SoftwareInfo[]
  createdAt?: string
  createdBy?: string
}

interface User {
  _id: string
  username: string
}

export default function CreateCompanyPage() {
  const [company, setCompany] = useState<Company>({
    code: `CMP-${Date.now()}`,
    companyName: "",
    city: "",
    phoneNumber: "",
    address: "",
    support: "Active",
    designatedDeveloper: "N/A",
    companyRepresentative: "N/A",
    softwareInformation: [],
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingCompanies, setIsFetchingCompanies] = useState(true)
  const [allCompanies, setAllCompanies] = useState<Company[]>([])
  const [user, setUser] = useState<UserSession | null>(null)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [softwareDialogOpen, setSoftwareDialogOpen] = useState(false)
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [softwareInfo, setSoftwareInfo] = useState({
    softwareType: "Finance Manager",
    version: "v1.00",
    lastUpdated: new Date().toISOString().slice(0, 16),
  })
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
      if (!parsedUser?.role?.permissions.includes("company_information.manage")) {
        toast({
          title: "Access Denied",
          description: "You do not have permission to create company information.",
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

  const fetchAllCompanies = async () => {
    setIsFetchingCompanies(true)
    try {
      const response = await fetch("/api/company_information")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setAllCompanies(data)
    } catch (error) {
      console.error("Failed to fetch companies:", error)
      toast({
        title: "Error fetching companies",
        description: "Could not load existing companies. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsFetchingCompanies(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error("Failed to fetch users:", error)
      toast({
        title: "Error fetching users",
        description: "Could not load user list. Please try again.",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (!user) return;

    fetchAllCompanies()
    fetchUsers()

    const eventSource = new EventSource("/api/company_information/stream");

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setAllCompanies(data);
    };

    eventSource.onerror = () => {
      console.error("SSE error");
      toast({
        title: "Connection Error",
        description: "Failed to maintain real-time updates. Retrying...",
        variant: "destructive",
      });
      eventSource.close();
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const newCompany = {
        ...company,
        createdAt: new Date().toISOString(),
        createdBy: user?.id,
      }

      const response = await fetch("/api/company_information", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newCompany),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      toast({
        title: "Company Created Successfully! ✨",
        description: `Company ${newCompany.code} has been created.`,
        duration: 5000,
      })

      setCompany({
        code: `CMP-${Date.now()}`,
        companyName: "",
        city: "",
        phoneNumber: "",
        address: "",
        support: "Active",
        designatedDeveloper: "N/A",
        companyRepresentative: "N/A",
        softwareInformation: [],
      })
      setSoftwareInfo({
        softwareType: "Finance Manager",
        version: "v1.00",
        lastUpdated: new Date().toISOString().slice(0, 16),
      })
    } catch (error) {
      console.error("Failed to create company:", error)
      toast({
        title: "Error",
        description: "Failed to create company. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCompany) return
    setIsLoading(true)

    try {
      const response = await fetch(`/api/company_information/${editingCompany._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: editingCompany.code,
          companyName: editingCompany.companyName,
          city: editingCompany.city,
          phoneNumber: editingCompany.phoneNumber,
          address: editingCompany.address,
          support: editingCompany.support,
          designatedDeveloper: editingCompany.designatedDeveloper,
          companyRepresentative: editingCompany.companyRepresentative,
          softwareInformation: editingCompany.softwareInformation,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      toast({
        title: "Company Updated Successfully! ✅",
        description: `Company ${editingCompany.code} has been updated.`,
        duration: 5000,
      })
      setEditingCompany(null)
    } catch (error) {
      console.error("Failed to update company:", error)
      toast({
        title: "Error",
        description: "Failed to update company. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSoftwareSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent any parent form submission
    try {
      const updatedSoftware = [
        ...company.softwareInformation,
        { ...softwareInfo, lastUpdated: new Date(softwareInfo.lastUpdated).toISOString() },
      ]

      setCompany((prev) => ({ ...prev, softwareInformation: updatedSoftware }))
      setSoftwareInfo({
        softwareType: "Finance Manager",
        version: "v1.00",
        lastUpdated: new Date().toISOString().slice(0, 16),
      })

      toast({
        title: "Software Information Added! 📦",
        description: `Software ${softwareInfo.softwareType} has been added to the company details.`,
        duration: 5000,
      })
      setSoftwareDialogOpen(false)
    } catch (error) {
      console.error("Failed to add software information:", error)
      toast({
        title: "Error",
        description: "Failed to add software information. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleAddSoftwareToEdit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent any parent form submission
    if (!editingCompany) return
    const updatedSoftware = [
      ...editingCompany.softwareInformation,
      { ...softwareInfo, lastUpdated: new Date(softwareInfo.lastUpdated).toISOString() },
    ]
    setEditingCompany((prev: any) => ({ ...prev, softwareInformation: updatedSoftware }))
    setSoftwareInfo({
      softwareType: "Finance Manager",
      version: "v1.00",
      lastUpdated: new Date().toISOString().slice(0, 16),
    })
    toast({
      title: "Software Information Added! 📦",
      description: `Software ${softwareInfo.softwareType} has been added to the company details.`,
      duration: 5000,
    })
    setSoftwareDialogOpen(false)
  }

  const handleRemoveSoftware = (index: number) => {
    setCompany((prev) => ({
      ...prev,
      softwareInformation: prev.softwareInformation.filter((_, i) => i !== index),
    }))
  }

  const handleRemoveSoftwareFromEdit = (index: number) => {
    if (!editingCompany) return
    const updatedSoftware = editingCompany.softwareInformation.filter((_, i) => i !== index)
    setEditingCompany((prev: any) => ({ ...prev, softwareInformation: updatedSoftware }))
  }

  const handleDelete = async () => {
    if (!companyToDelete) return
    setIsLoading(true)
    try {
      const response = await fetch(`/api/company_information/${companyToDelete}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      toast({
        title: "Company Deleted Successfully! 🗑️",
        description: "The company has been removed from the system.",
        duration: 5000,
      })
    } catch (error) {
      console.error("Failed to delete company:", error)
      toast({
        title: "Error",
        description: "Failed to delete company. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setDeleteConfirmOpen(false)
      setCompanyToDelete(null)
    }
  }

  const totalPages = Math.ceil(allCompanies.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentCompanies = allCompanies.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
    setCurrentPage(1)
  }

  const getPageNumbers = () => {
    const maxVisiblePages = 5
    const pages = []
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    if (startPage > 1) {
      pages.unshift('...')
      pages.unshift(1)
    }
    if (endPage < totalPages) {
      pages.push('...')
      pages.push(totalPages)
    }

    return pages
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
            <Building className="h-6 w-6 text-white" />
          </div>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
          Add Company Information
        </h1>
        <p className="text-muted-foreground">Add new company details to your system</p>
      </div>

      <div className="max-w-4xl mx-auto">
        <Card className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/20 animate-slide-in">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-t-xl border-b border-emerald-200/50">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Company Information
            </CardTitle>
            <CardDescription>Fill in the details for the new company</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-medium">
                    Company Code
                  </Label>
                  <Input id="code" value={company.code} readOnly className="bg-muted/50 font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">Auto-generated unique identifier</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-sm font-medium">
                    Company Name
                  </Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyName"
                      placeholder="Enter company name"
                      value={company.companyName}
                      onChange={(e) => setCompany((prev) => ({ ...prev, companyName: e.target.value }))}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-medium">
                  City
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="city"
                    placeholder="Enter city"
                    value={company.city}
                    onChange={(e) => setCompany((prev) => ({ ...prev, city: e.target.value }))}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-sm font-medium">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="Enter phone number"
                      value={company.phoneNumber}
                      onChange={(e) => setCompany((prev) => ({ ...prev, phoneNumber: e.target.value }))}
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
                      value={company.address}
                      onChange={(e) => setCompany((prev) => ({ ...prev, address: e.target.value }))}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="support" className="text-sm font-medium">
                    Support
                  </Label>
                  <Select
                    value={company.support}
                    onValueChange={(value) => setCompany((prev) => ({ ...prev, support: value }))}
                  >
                    <SelectTrigger id="support">
                      <SelectValue placeholder="Select support status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="In-Active">In-Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="designatedDeveloper" className="text-sm font-medium">
                    Designated Developer
                  </Label>
                  <Select
                    value={company.designatedDeveloper}
                    onValueChange={(value) => setCompany((prev) => ({ ...prev, designatedDeveloper: value }))}
                  >
                    <SelectTrigger id="designatedDeveloper">
                      <SelectValue placeholder="Select developer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="N/A">N/A</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user._id} value={user.username}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyRepresentative" className="text-sm font-medium">
                  Company Representative
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="companyRepresentative"
                    placeholder="Enter company representative"
                    value={company.companyRepresentative}
                    onChange={(e) => setCompany((prev) => ({ ...prev, companyRepresentative: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Software Information</Label>
                <div className="space-y-4 p-3 border rounded-md bg-muted/10 max-h-[200px] overflow-y-auto">
                  {company.softwareInformation.length > 0 ? (
                    company.softwareInformation.map((software, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1 grid gap-2 sm:grid-cols-3">
                          <div>
                            <Label htmlFor={`softwareType-${index}`} className="text-xs">Type</Label>
                            <Input
                              id={`softwareType-${index}`}
                              value={software.softwareType}
                              readOnly
                              className="bg-muted/50 text-xs sm:text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`version-${index}`} className="text-xs">Version</Label>
                            <Input
                              id={`version-${index}`}
                              value={software.version}
                              readOnly
                              className="bg-muted/50 text-xs sm:text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`lastUpdated-${index}`} className="text-xs">Last Updated</Label>
                            <Input
                              id={`lastUpdated-${index}`}
                              value={new Date(software.lastUpdated).toLocaleString()}
                              readOnly
                              className="bg-muted/50 text-xs sm:text-sm"
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSoftware(index)}
                          disabled={isLoading}
                          className="p-1"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs sm:text-sm text-muted-foreground">No software information added.</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Dialog open={softwareDialogOpen} onOpenChange={setSoftwareDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Add Software
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>Add Software Information</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSoftwareSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="softwareType">Software Type</Label>
                        <Select
                          value={softwareInfo.softwareType}
                          onValueChange={(value) => setSoftwareInfo((prev) => ({ ...prev, softwareType: value }))}
                        >
                          <SelectTrigger id="softwareType">
                            <SelectValue placeholder="Select software type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Finance Manager">Finance Manager</SelectItem>
                            <SelectItem value="Finance Controller">Finance Controller</SelectItem>
                            <SelectItem value="Power Accounting">Power Accounting</SelectItem>
                            <SelectItem value="Ems Finance Manager Urdu">Ems Finance Manager Urdu</SelectItem>
                            <SelectItem value="Pos">Pos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="version">Version</Label>
                        <Select
                          value={softwareInfo.version}
                          onValueChange={(value) => setSoftwareInfo((prev) => ({ ...prev, version: value }))}
                        >
                          <SelectTrigger id="version">
                            <SelectValue placeholder="Select version" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="v1.00">v1.00</SelectItem>
                            <SelectItem value="v2.00">v2.00</SelectItem>
                            <SelectItem value="v3.00">v3.00</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastUpdated">Last Updated</Label>
                        <Input
                          id="lastUpdated"
                          type="datetime-local"
                          value={softwareInfo.lastUpdated}
                          onChange={(e) => setSoftwareInfo((prev) => ({ ...prev, lastUpdated: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <Button
                          type="submit"
                          className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transition-all-smooth"
                          disabled={isLoading}
                        >
                          Add Software
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSoftwareDialogOpen(false)}
                          className="sm:px-8"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transition-all-smooth"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Company...
                    </div>
                  ) : (
                    "Create Company"
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

        <Dialog open={!!editingCompany} onOpenChange={() => setEditingCompany(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-[600px] w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Edit Company</DialogTitle>
            </DialogHeader>
            {editingCompany && (
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-code" className="text-sm font-medium">
                      Company Code
                    </Label>
                    <Input id="edit-code" value={editingCompany.code} readOnly className="bg-muted/50 font-mono text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-companyName" className="text-sm font-medium">
                      Company Name
                    </Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-companyName"
                        placeholder="Enter company name"
                        value={editingCompany.companyName}
                        onChange={(e) =>
                          setEditingCompany((prev: any) => ({ ...prev, companyName: e.target.value }))
                        }
                        className="pl-10 text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-city" className="text-sm font-medium">
                    City
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-city"
                      placeholder="Enter city"
                      value={editingCompany.city}
                      onChange={(e) => setEditingCompany((prev: any) => ({ ...prev, city: e.target.value }))}
                      className="pl-10 text-sm"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-phoneNumber" className="text-sm font-medium">
                      Phone Number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-phoneNumber"
                        type="tel"
                        placeholder="Enter phone number"
                        value={editingCompany.phoneNumber}
                        onChange={(e) =>
                          setEditingCompany((prev: any) => ({ ...prev, phoneNumber: e.target.value }))
                        }
                        className="pl-10 text-sm"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-address" className="text-sm font-medium">
                      Address
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="edit-address"
                        placeholder="Enter address"
                        value={editingCompany.address}
                        onChange={(e) =>
                          setEditingCompany((prev: any) => ({ ...prev, address: e.target.value }))
                        }
                        className="pl-10 text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-support" className="text-sm font-medium">
                      Support
                    </Label>
                    <Select
                      value={editingCompany.support}
                      onValueChange={(value) => setEditingCompany((prev: any) => ({ ...prev, support: value }))}
                    >
                      <SelectTrigger id="edit-support" className="text-sm">
                        <SelectValue placeholder="Select support status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="In-Active">In-Active</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-designatedDeveloper" className="text-sm font-medium">
                      Designated Developer
                    </Label>
                    <Select
                      value={editingCompany.designatedDeveloper}
                      onValueChange={(value) =>
                        setEditingCompany((prev: any) => ({ ...prev, designatedDeveloper: value }))
                      }
                    >
                      <SelectTrigger id="edit-designatedDeveloper" className="text-sm">
                        <SelectValue placeholder="Select developer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="N/A">N/A</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user._id} value={user.username}>
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-companyRepresentative" className="text-sm font-medium">
                    Company Representative
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-companyRepresentative"
                      placeholder="Enter company representative"
                      value={editingCompany.companyRepresentative}
                      onChange={(e) =>
                        setEditingCompany((prev: any) => ({ ...prev, companyRepresentative: e.target.value }))
                      }
                      className="pl-10 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Software Information</Label>
                  <div className="space-y-4 p-3 border rounded-md bg-muted/10 max-h-[200px] overflow-y-auto">
                    {(editingCompany.softwareInformation || []).length > 0 ? (
                      editingCompany.softwareInformation.map((software, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="flex-1 grid gap-2 sm:grid-cols-3">
                            <div>
                              <Label htmlFor={`softwareType-${index}`} className="text-xs">Type</Label>
                              <Input
                                id={`softwareType-${index}`}
                                value={software.softwareType}
                                readOnly
                                className="bg-muted/50 text-xs sm:text-sm"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`version-${index}`} className="text-xs">Version</Label>
                              <Input
                                id={`version-${index}`}
                                value={software.version}
                                readOnly
                                className="bg-muted/50 text-xs sm:text-sm"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`lastUpdated-${index}`} className="text-xs">Last Updated</Label>
                              <Input
                                id={`lastUpdated-${index}`}
                                value={new Date(software.lastUpdated).toLocaleString()}
                                readOnly
                                className="bg-muted/50 text-xs sm:text-sm"
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSoftwareFromEdit(index)}
                            disabled={isLoading}
                            className="p-1"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs sm:text-sm text-muted-foreground">No software information added.</p>
                    )}
                    <div className="space-y-2 pt-2">
                      <Label className="text-sm font-medium">Add New Software</Label>
                      <Dialog open={softwareDialogOpen} onOpenChange={setSoftwareDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full text-xs sm:text-sm border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Add Software
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                          <DialogHeader>
                            <DialogTitle>Add Software Information</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleAddSoftwareToEdit} className="space-y-6">
                            <div className="space-y-2">
                              <Label htmlFor="edit-softwareType" className="text-sm">Software Type</Label>
                              <Select
                                value={softwareInfo.softwareType}
                                onValueChange={(value) => setSoftwareInfo((prev) => ({ ...prev, softwareType: value }))}
                              >
                                <SelectTrigger id="edit-softwareType" className="text-sm">
                                  <SelectValue placeholder="Select software type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Finance Manager">Finance Manager</SelectItem>
                                  <SelectItem value="Finance Controller">Finance Controller</SelectItem>
                                  <SelectItem value="Power Accounting">Power Accounting</SelectItem>
                                  <SelectItem value="Ems Finance Manager Urdu">Ems Finance Manager Urdu</SelectItem>
                                  <SelectItem value="Pos">Pos</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-version" className="text-sm">Version</Label>
                              <Select
                                value={softwareInfo.version}
                                onValueChange={(value) => setSoftwareInfo((prev) => ({ ...prev, version: value }))}
                              >
                                <SelectTrigger id="edit-version" className="text-sm">
                                  <SelectValue placeholder="Select version" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="v1.00">v1.00</SelectItem>
                                  <SelectItem value="v2.00">v2.00</SelectItem>
                                  <SelectItem value="v3.00">v3.00</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-lastUpdated" className="text-sm">Last Updated</Label>
                              <Input
                                id="edit-lastUpdated"
                                type="datetime-local"
                                value={softwareInfo.lastUpdated}
                                onChange={(e) => setSoftwareInfo((prev) => ({ ...prev, lastUpdated: e.target.value }))}
                                className="text-sm"
                                required
                              />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                              <Button
                                type="submit"
                                className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transition-all-smooth"
                                disabled={isLoading}
                              >
                                Add Software
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setSoftwareDialogOpen(false)}
                                className="sm:px-8"
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transition-all-smooth text-sm sm:text-base"
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
                    onClick={() => setEditingCompany(null)}
                    className="text-sm sm:text-base sm:px-8"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={deleteConfirmOpen} onOpenChange={() => setDeleteConfirmOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to delete this company?</p>
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={handleDelete}
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
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card
          className="border-0 shadow-xl bg-gradient-to-br from-background to-muted/20 animate-slide-in"
          style={{ animationDelay: "0.2s" }}
        >
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-t-xl border-b border-blue-200/50 py-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-blue-600" />
              All Companies ({allCompanies.length})
            </CardTitle>
            <CardDescription className="text-sm">Complete list of all companies in the system</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isFetchingCompanies ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-16 w-16 mx-auto mb-4 opacity-50 animate-spin" />
                <p className="text-lg font-medium">Loading companies...</p>
              </div>
            ) : allCompanies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No companies created yet</p>
                <p className="text-sm">Create your first company using the form above</p>
              </div>
            ) : (
              <>
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
                            City
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                            Phone
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Address
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                            Support
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                            Developer
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                            Representative
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                            Created
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-background divide-y divide-border/50">
                        {currentCompanies.map((company, index) => (
                          <tr
                            key={company._id}
                            className={`${index % 2 === 0 ? "bg-background" : "bg-muted/20"} hover:bg-muted/30 transition-colors`}
                          >
                            <td className="px-3 py-3">
                              <Badge variant="outline" className="text-xs font-mono">
                                {company.code?.split("-")[1]}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center">
                                <Building className="h-3 w-3 text-muted-foreground mr-2" />
                                <span
                                  className="font-medium text-foreground truncate max-w-[80px] sm:max-w-24"
                                  title={company.companyName}
                                >
                                  {company.companyName}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 hidden sm:table-cell">
                              <span className="text-foreground truncate max-w-20 block" title={company.city}>
                                {company.city}
                              </span>
                            </td>
                            <td className="px-3 py-3 hidden md:table-cell">
                              <span className="text-foreground text-xs">{company.phoneNumber}</span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-foreground truncate max-w-[100px] block text-xs" title={company.address}>
                                {company.address}
                              </span>
                            </td>
                            <td className="px-3 py-3 hidden lg:table-cell">
                              <Badge variant={company.support === "Active" ? "default" : "destructive"}>
                                {company.support}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 hidden lg:table-cell">
                              <span className="text-foreground text-xs">{company.designatedDeveloper}</span>
                            </td>
                            <td className="px-3 py-3 hidden lg:table-cell">
                              <span className="text-foreground text-xs">{company.companyRepresentative}</span>
                            </td>
                            <td className="px-3 py-3 hidden lg:table-cell">
                              <span className="text-foreground text-xs">
                                {new Date(company.createdAt!).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingCompany({ ...company, softwareInformation: company.softwareInformation || [] })}
                                  disabled={isLoading}
                                >
                                  <Edit className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setCompanyToDelete(company._id!)
                                    setDeleteConfirmOpen(true)
                                  }}
                                  disabled={isLoading}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center px-4 py-3 gap-4">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label htmlFor="itemsPerPage" className="text-sm font-medium">
                      Company per page:
                    </Label>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={handleItemsPerPageChange}
                    >
                      <SelectTrigger id="itemsPerPage" className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="15">15</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || isLoading}
                      className="min-w-[90px] text-xs sm:text-sm"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1 hidden sm:flex">
                      {getPageNumbers().map((page, index) => (
                        <Button
                          key={index}
                          variant={page === currentPage ? "default" : page === '...' ? "ghost" : "outline"}
                          size="sm"
                          onClick={() => typeof page === 'number' && handlePageChange(page)}
                          disabled={page === '...' || isLoading}
                          className={page === '...' ? "cursor-default" : "min-w-[32px] text-xs"}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || isLoading}
                      className="min-w-[90px] text-xs sm:text-sm"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}