import { NextRequest } from "next/server"
import jwt from "jsonwebtoken"

export async function verifyAuth(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!token) {
    throw new Error("No token provided")
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined")
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
      id: string
      username: string
      role: { id: string; name: string; permissions: string[] }
    }
    return decoded
  } catch (error) {
    throw new Error("Invalid token")
  }
}