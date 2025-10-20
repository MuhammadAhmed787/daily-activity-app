"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Users, Plus, Edit, Shield, User, Loader2, Trash2 } from "lucide-react"
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

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false)
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false)
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [isCreatingRole, setIsCreatingRole] = useState(false)
  const [isEditingRole, setIsEditingRole] = useState(false)
  const [isEditingUser, setIsEditingUser] = useState(false)
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [isDeletingRole, setIsDeletingRole] = useState(false)
  const [newUser, setNewUser] = useState({
    username: "",
    name: "",
    email: "",
    password: "",
    roleId: "",
  })
  const [editUser, setEditUser] = useState({
    id: "",
    username: "",
    name: "",
    email: "",
    roleId: "",
  })
  const [newRole, setNewRole] = useState({
    name: "",
    permissions: [] as string[],
  })
  const [editRole, setEditRole] = useState({
    id: "",
    name: "",
    permissions: [] as string[],
  })
  const [userToDelete, setUserToDelete] = useState<any>(null)
  const [roleToDelete, setRoleToDelete] = useState<any>(null)
  const { toast } = useToast()
  const router = useRouter()
  const [user, setUser] = useState<UserSession | null>(null)

  const availablePermissions = [
    "dashboard",
    "tasks.create",
    "tasks.assign",
    "tasks.complete",
    "tasks.manage",
    "tasks.developer_working",
    "tasks.unpost",
    "users.manage",
    "reports.view",
    "company_information.manage",
  ]

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
      if (!parsedUser?.role?.permissions.includes("users.manage")) {
        toast({
          title: "Access Denied",
          description: "You do not have permission to manage users.",
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

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [usersResponse, rolesResponse] = await Promise.all([
        fetch("/api/users"), 
        fetch("/api/roles")
      ])

      if (!usersResponse.ok || !rolesResponse.ok) {
        throw new Error(`HTTP error! Users: ${usersResponse.status}, Roles: ${rolesResponse.status}`)
      }

      const [usersData, rolesData] = await Promise.all([
        usersResponse.json(), 
        rolesResponse.json()
      ])

      setUsers(usersData)

      if (rolesData.length === 0) {
        const defaultRoles = [
          {
            name: "Admin",
            permissions: availablePermissions,
          },
          {
            name: "Manager",
            permissions: [
              "dashboard",
              "tasks.create",
              "tasks.assign",
              "tasks.complete",
              "tasks.manage",
              "tasks.developer_working",
              "users.manage",
              "tasks.unpost",
              "reports.view",
              "company_information.manage",
            ],
          },
          {
            name: "Employee",
            permissions: ["dashboard"],
          },
        ]

        for (const role of defaultRoles) {
          await fetch("/api/roles", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(role),
          })
        }

        const newRolesResponse = await fetch("/api/roles")
        if (!newRolesResponse.ok) {
          throw new Error(`HTTP error! status: ${newRolesResponse.status}`)
        }
        const newRolesData = await newRolesResponse.json()
        setRoles(newRolesData)
      } else {
        setRoles(rolesData)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      toast({
        title: "Error fetching data",
        description: "Could not load users and roles. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  // Add this function to update the current user's session if their role was modified
  const updateCurrentUserSessionIfNeeded = (updatedRole: any) => {
    try {
      const currentUserData = localStorage.getItem("user");
      if (!currentUserData) return;
      
      const currentUser = JSON.parse(currentUserData);
      
      // If the current user has the role that was just updated
      if (currentUser.role.id === updatedRole._id) {
        // Update the role information in the session
        const updatedUser = {
          ...currentUser,
          role: {
            id: updatedRole._id,
            name: updatedRole.name,
            permissions: updatedRole.permissions
          }
        };
        
        // Save the updated session
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
        
        // Show a notification that permissions have been updated
        toast({
          title: "Permissions Updated",
          description: "Your permissions have been updated. Some changes may require a page refresh to take effect.",
        });
      }
    } catch (error) {
      console.error("Error updating user session:", error);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.name || !newUser.email || !newUser.password || !newUser.roleId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields, including password and role.",
        variant: "destructive",
      })
      return
    }

    setIsCreatingUser(true)
    try {
      const selectedRole = roles.find((r) => r._id === newUser.roleId)

      const userData = {
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        roleId: newUser.roleId,  // Send roleId instead of role object
      }

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to create user")
      }

      const createdUser = await response.json()
      setUsers((prev) => [...prev, createdUser])

      toast({
        title: "User Created",
        description: `User ${newUser.name} has been created successfully.`,
      })

      setNewUser({
        username: "",
        name: "",
        email: "",
        password: "",
        roleId: "",
      })
      setIsCreateDialogOpen(false)
    } catch (error: any) {
      console.error("Failed to create user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create user. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingUser(false)
    }
  }

  const handleEditUser = async () => {
    if (!editUser.id || !editUser.username || !editUser.name || !editUser.email || !editUser.roleId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsEditingUser(true)
    try {
      const selectedRole = roles.find((r) => r._id === editUser.roleId)

      const userData = {
        username: editUser.username,
        name: editUser.name,
        email: editUser.email,
        role: {
          id: selectedRole._id,
          name: selectedRole.name,
          permissions: selectedRole.permissions,
        },
      }

      const response = await fetch(`/api/users/${editUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to update user")
      }

      const updatedUser = await response.json()
      setUsers((prev) =>
        prev.map((user) => (user._id === updatedUser._id ? updatedUser : user))
      )

      // If current user is updating their own profile, update localStorage
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
      if (currentUser.id === updatedUser._id) {
        localStorage.setItem("user", JSON.stringify({
          ...currentUser,
          role: updatedUser.role
        }))
      }

      toast({
        title: "User Updated",
        description: `User ${editUser.name} has been updated successfully.`,
      })

      setEditUser({ id: "", username: "", name: "", email: "", roleId: "" })
      setIsEditUserDialogOpen(false)
    } catch (error: any) {
      console.error("Failed to update user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update user. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsEditingUser(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    
    // Prevent user from deleting themselves
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
    if (currentUser.id === userToDelete._id) {
      toast({
        title: "Cannot Delete User",
        description: "You cannot delete your own account.",
        variant: "destructive",
      })
      setUserToDelete(null)
      return
    }

    setIsDeletingUser(true)
    try {
      const response = await fetch(`/api/users/${userToDelete._id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete user")
      }

      setUsers((prev) => prev.filter((user) => user._id !== userToDelete._id))
      toast({
        title: "User Deleted",
        description: `User ${userToDelete.name} has been deleted successfully.`,
      })
      
      setUserToDelete(null)
    } catch (error: any) {
      console.error("Failed to delete user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete user. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingUser(false)
    }
  }

  const handleCreateRole = async () => {
    if (!newRole.name || newRole.permissions.length === 0) {
      toast({
        title: "Error",
        description: "Please provide role name and select at least one permission.",
        variant: "destructive",
      })
      return
    }

    setIsCreatingRole(true)
    try {
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newRole),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to create role")
      }

      const createdRole = await response.json()
      setRoles((prev) => [...prev, createdRole])

      toast({
        title: "Role Created",
        description: `Role ${newRole.name} has been created successfully.`,
      })

      setNewRole({
        name: "",
        permissions: [],
      })
      setIsRoleDialogOpen(false)
    } catch (error) {
      console.error("Failed to create role:", error)
      toast({
        title: "Error",
        description: "Failed to create role. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreatingRole(false)
    }
  }

  const handleEditRole = async () => {
    if (!editRole.id || !editRole.name || editRole.permissions.length === 0) {
      toast({
        title: "Error",
        description: "Please provide role name and select at least one permission.",
        variant: "destructive",
      })
      return
    }

    setIsEditingRole(true)
    try {
      const response = await fetch("/api/roles", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editRole.id,
          name: editRole.name,
          permissions: editRole.permissions,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to update role")
      }

      const updatedRole = await response.json()
      setRoles((prev) =>
        prev.map((role) => (role._id === updatedRole._id ? updatedRole : role))
      )

      // Update users with the modified role
      const updatedUsers = users.map(user => {
        if (user.role?.id === updatedRole._id) {
          return {
            ...user,
            role: updatedRole
          }
        }
        return user
      })
      setUsers(updatedUsers)

      // Update current user session if their role was modified
      updateCurrentUserSessionIfNeeded(updatedRole)

      toast({
        title: "Role Updated",
        description: `Role ${editRole.name} has been updated successfully.`,
      })

      setEditRole({ id: "", name: "", permissions: [] })
      setIsEditRoleDialogOpen(false)
    } catch (error: any) {
      console.error("Failed to update role:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update role. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsEditingRole(false)
    }
  }

const handleDeleteRole = async () => {
  if (!roleToDelete) return
  
  try {
    const response = await fetch("/api/roles", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: roleToDelete._id }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || "Failed to delete role")
    }

    setRoles((prev) => prev.filter((role) => role._id !== roleToDelete._id))
    toast({
      title: "Role Deleted",
      description: `Role ${roleToDelete.name} has been deleted successfully.`,
    })
    
    setRoleToDelete(null)
  } catch (error: any) {
    console.error("Failed to delete role:", error)
    toast({
      title: "Error",
      description: error.message || "Failed to delete role. Please try again.",
      variant: "destructive",
    })
  } finally {
    setIsDeletingRole(false)
  }
}

  const openEditUserDialog = (user: any) => {
    setEditUser({
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      roleId: user.role?.id || "",
    })
    setIsEditUserDialogOpen(true)
  }

  const openEditRoleDialog = (role: any) => {
    setEditRole({
      id: role._id,
      name: role.name,
      permissions: role.permissions,
    })
    setIsEditRoleDialogOpen(true)
  }

  const togglePermission = (permission: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditRole((prev) => ({
        ...prev,
        permissions: prev.permissions.includes(permission)
          ? prev.permissions.filter((p) => p !== permission)
          : [...prev.permissions, permission],
      }))
    } else {
      setNewRole((prev) => ({
        ...prev,
        permissions: prev.permissions.includes(permission)
          ? prev.permissions.filter((p) => p !== permission)
          : [...prev.permissions, permission],
      }))
    }
  }

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading users and roles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            User Management
          </h1>
          <p className="text-muted-foreground">Manage users and their roles</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto bg-transparent">
                <Shield className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Role</DialogTitle>
                <DialogDescription>Define a new role with specific permissions</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="roleName">Role Name</Label>
                  <Input
                    id="roleName"
                    placeholder="Enter role name"
                    value={newRole.name}
                    onChange={(e) => setNewRole((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Permissions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availablePermissions.map((permission) => (
                      <div key={permission} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={permission}
                          checked={newRole.permissions.includes(permission)}
                          onChange={() => togglePermission(permission)}
                          className="rounded"
                        />
                        <label htmlFor={permission} className="text-sm">
                          {permission}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateRole} className="flex-1" disabled={isCreatingRole}>
                    {isCreatingRole ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </div>
                    ) : (
                      "Create Role"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>Add a new user to the system</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="Enter username"
                      value={newUser.username}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter full name"
                      value={newUser.name}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    value={newUser.email}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={newUser.password}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.roleId}
                    onValueChange={(value) => setNewUser((prev) => ({ ...prev, roleId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role._id} value={role._id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateUser} className="flex-1" disabled={isCreatingUser}>
                    {isCreatingUser ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </div>
                    ) : (
                      "Create User"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Roles ({roles.length})
          </CardTitle>
          <CardDescription>Available roles and their permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <div key={role._id} className="border rounded-lg p-1">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">{role.name}</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditRoleDialog(role)}
                        className="text-xs px-2 py-1 bg-transparent"
                      >
                        <Edit className="h-2 w-2 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRoleToDelete(role)}
                        className="text-xs px-2 py-1 bg-transparent text-red-500 border-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-2 w-2 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((permission: string) => (
                      <Badge key={permission} variant="secondary" className="text-xs">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role Delete Confirmation Dialog */}
      <Dialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete role "{roleToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 justify-end">
            <Button
              variant="outline"
              onClick={() => setRoleToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRole}
              disabled={isDeletingRole}
            >
              {isDeletingRole ? (
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

      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update the role's name and permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editRoleName">Role Name</Label>
              <Input
                id="editRoleName"
                placeholder="Enter role name"
                value={editRole.name}
                onChange={(e) => setEditRole((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {availablePermissions.map((permission) => (
                  <div key={permission} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`edit-${permission}`}
                      checked={editRole.permissions.includes(permission)}
                      onChange={() => togglePermission(permission, true)}
                      className="rounded"
                    />
                    <label htmlFor={`edit-${permission}`} className="text-sm">
                      {permission}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleEditRole} className="flex-1" disabled={isEditingRole}>
                {isEditingRole ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </div>
                ) : (
                  "Update Role"
                )}
              </Button>
              <Button variant="outline" onClick={() => setIsEditRoleDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editUsername">Username</Label>
                <Input
                  id="editUsername"
                  placeholder="Enter username"
                  value={editUser.username}
                  onChange={(e) => setEditUser((prev) => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editName">Full Name</Label>
                <Input
                  id="editName"
                  placeholder="Enter full name"
                  value={editUser.name}
                  onChange={(e) => setEditUser((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                placeholder="Enter email address"
                value={editUser.email}
                onChange={(e) => setEditUser((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole">Role</Label>
              <Select
                value={editUser.roleId}
                onValueChange={(value) => setEditUser((prev) => ({ ...prev, roleId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role._id} value={role._id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleEditUser} className="flex-1" disabled={isEditingUser}>
                {isEditingUser ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </div>
                ) : (
                  "Update User"
                )}
              </Button>
              <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Delete Confirmation Dialog */}
      <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user "{userToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 justify-end">
            <Button
              variant="outline"
              onClick={() => setUserToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={isDeletingUser}
            >
              {isDeletingUser ? (
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

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-4 w-4" />
            Users ({users.length})
          </CardTitle>
          <CardDescription className="text-sm">System users and their assigned roles</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base font-medium">No users created yet</p>
              <p className="text-xs">Create your first user to get started</p>
            </div>
          ) : (
            <div className="responsive-table max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                      Email
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                      Permissions
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {users.map((user, index) => (
                    <tr
                      key={user._id}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50 hover:bg-blue-50 transition-colors"}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mr-3">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
                            <p className="text-xs text-gray-500">ID: {user._id.slice(-6)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          @{user.username}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <span className="text-gray-900 text-xs truncate max-w-[120px] block" title={user.email}>
                          {user.email}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center">
                          <Shield className="h-3 w-3 text-blue-500 mr-1" />
                          <Badge className="bg-blue-600 text-xs">{user.role?.name || "No Role"}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        {user.role?.permissions && (
                          <div className="flex flex-wrap gap-1">
                            {user.role.permissions.slice(0, 2).map((permission: string) => (
                              <Badge key={permission} variant="secondary" className="text-xs">
                                {permission.split(".")[0]}
                              </Badge>
                            ))}
                            {user.role.permissions.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{user.role.permissions.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs px-3 py-1 bg-transparent"
                            onClick={() => openEditUserDialog(user)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs px-3 py-1 bg-transparent text-red-500 border-red-500 hover:bg-red-50"
                            onClick={() => setUserToDelete(user)}
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
      </Card>
    </div>
  )
}