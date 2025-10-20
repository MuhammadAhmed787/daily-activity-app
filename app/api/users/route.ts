import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import Role from "@/models/Role"
import bcrypt from "bcryptjs"

export async function GET() {
  await dbConnect()
  try {
    const users = await User.find({})
    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ message: "Failed to fetch users", error }, { status: 500 })
  }
}

export async function POST(req: Request) {
  await dbConnect()
  try {
    const body = await req.json()
    const { username, name, email, password, roleId } = body

    // Validate input
    if (!username || !name || !email || !password || !roleId) {
      return NextResponse.json({ message: "All fields are required, including role ID" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] })
    if (existingUser) {
      return NextResponse.json({ message: "Username or email already exists" }, { status: 400 })
    }

    // Get the role details
    const role = await Role.findById(roleId)
    if (!role) {
      return NextResponse.json({ message: "Role not found" }, { status: 404 })
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create new user with role details
    const newUser = new User({
      username,
      name,
      email,
      password: hashedPassword,
      role: {
        id: role._id,
        name: role.name,
        permissions: role.permissions,
      },
    })

    await newUser.save()
    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ message: "Failed to create user", error }, { status: 500 })
  }
}