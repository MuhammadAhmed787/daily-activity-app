import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Role from "@/models/Role"
import User from "@/models/User"

export async function GET() {
  await dbConnect()
  try {
    const roles = await Role.find({})
    return NextResponse.json(roles)
  } catch (error: any) {
    console.error("Error fetching roles:", error)
    return NextResponse.json({ message: "Failed to fetch roles", error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  await dbConnect()
  try {
    const { name, permissions } = await req.json()

    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ message: "Name and permissions array are required" }, { status: 400 })
    }

    const validPermissions = [
      "dashboard",
      "tasks.create",
      "tasks.assign",
      "tasks.complete",
      "tasks.manage",
      "tasks.developer_working",
      "tasks.unpost",
      "users.manage",
      "reports.view",
      "company_information.manage", // Updated permission
    ]
    const invalidPermissions = permissions.filter((p: string) => !validPermissions.includes(p))
    if (invalidPermissions.length > 0) {
      return NextResponse.json(
        { message: `Invalid permissions: ${invalidPermissions.join(", ")}` },
        { status: 400 }
      )
    }

    const existingRole = await Role.findOne({ name })
    if (existingRole) {
      return NextResponse.json({ message: "Role with this name already exists" }, { status: 400 })
    }

    const newRole = new Role({ name, permissions })
    await newRole.save()
    return NextResponse.json(newRole, { status: 201 })
  } catch (error: any) {
    console.error("Error creating role:", error)
    return NextResponse.json({ message: "Failed to create role", error: error.message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  await dbConnect()
  try {
    const { id, name, permissions } = await req.json()

    if (!id || !name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ message: "ID, name, and permissions array are required" }, { status: 400 })
    }

    const validPermissions = [
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
    const invalidPermissions = permissions.filter((p: string) => !validPermissions.includes(p))
    if (invalidPermissions.length > 0) {
      return NextResponse.json(
        { message: `Invalid permissions: ${invalidPermissions.join(", ")}` },
        { status: 400 }
      )
    }

    const updatedRole = await Role.findByIdAndUpdate(
      id,
      { name, permissions },
      { new: true }
    )
    if (!updatedRole) {
      return NextResponse.json({ message: "Role not found" }, { status: 404 })
    }

    // Update all users with this role to have the latest role information
    await User.updateMany(
      { "role.id": id },
      { 
        $set: { 
          "role.name": name,
          "role.permissions": permissions
        } 
      }
    )

    return NextResponse.json(updatedRole)
  } catch (error: any) {
    console.error("Error updating role:", error)
    return NextResponse.json({ message: "Failed to update role", error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  await dbConnect()
  try {
    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ message: "Role ID is required" }, { status: 400 })
    }

    // Check if any users have this role
    const usersWithRole = await User.countDocuments({ "role.id": id })
    if (usersWithRole > 0) {
      return NextResponse.json(
        { message: `Cannot delete role as it is assigned to ${usersWithRole} user(s)` }, 
        { status: 400 }
      )
    }

    const deletedRole = await Role.findByIdAndDelete(id)
    if (!deletedRole) {
      return NextResponse.json({ message: "Role not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Role deleted successfully" })
  } catch (error: any) {
    console.error("Error deleting role:", error)
    return NextResponse.json({ message: "Failed to delete role", error: error.message }, { status: 500 })
  }
}