import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import Role from "@/models/Role"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  await dbConnect()
  try {
    const user = await User.findById(params.id)
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }
    return NextResponse.json(user)
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ message: "Failed to fetch user", error }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await dbConnect()
  try {
    const updateData = await req.json()
    
    // If role is being updated, get the full role details
    if (updateData.roleId) {
      const role = await Role.findById(updateData.roleId)
      if (!role) {
        return NextResponse.json({ message: "Role not found" }, { status: 404 })
      }
      
      // Replace roleId with full role object
      updateData.role = {
        id: role._id,
        name: role.name,
        permissions: role.permissions,
      }
      delete updateData.roleId
    }
    
    const updatedUser = await User.findByIdAndUpdate(params.id, updateData, { new: true })
    if (!updatedUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }
    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ message: "Failed to update user", error }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await dbConnect()
  try {
    // Prevent deletion of the last admin user
    const userToDelete = await User.findById(params.id)
    if (!userToDelete) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }
    
    // Check if user is an admin
    if (userToDelete.role.name === "Admin") {
      // Count remaining admin users
      const adminUsers = await User.find({ "role.name": "Admin" })
      if (adminUsers.length <= 1) {
        return NextResponse.json(
          { message: "Cannot delete the last admin user" }, 
          { status: 400 }
        )
      }
    }
    
    const deletedUser = await User.findByIdAndDelete(params.id)
    if (!deletedUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }
    
    return NextResponse.json({ 
      message: "User deleted successfully",
      deletedUser: { id: deletedUser._id, name: deletedUser.name }
    })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ message: "Failed to delete user", error }, { status: 500 })
  }
}