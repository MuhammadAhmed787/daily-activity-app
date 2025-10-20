// app/api/login/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User"; // User model (registered here)
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export async function POST(req: Request) {
  try {
    // 1) ensure DB connection
    await dbConnect();

    // 2) ensure Role model is registered BEFORE populate is called.
    //    This dynamic import guarantees the model file is evaluated now.
    //    (You can also keep a static import at the top, but dynamic import avoids ordering issues.)
    await import("@/models/Role");

    // Debug: print registered models to verify Role is present
    console.log("[db.debug] registered models:", mongoose.modelNames());

    // 3) parse + basic validation
    const body = await req.json().catch(() => ({}));
    const username = (body.username || "").trim();
    const password = body.password || "";

    if (!username || !password) {
      return NextResponse.json({ message: "Username and password required" }, { status: 400 });
    }

    // 4) find user and populate role.id
    //    use .populate({ path: "role.id", model: "Role" }) to be explicit about the model name
    const user = await User.findOne({ username })
      .populate({ path: "role.id", model: "Role" })
      .exec();

    if (!user) {
      return NextResponse.json({ message: "Invalid username or password" }, { status: 401 });
    }

    // 5) check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ message: "Invalid username or password" }, { status: 401 });
    }

    // 6) prepare return object (exclude password)
    const userToReturn = {
      _id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role, // role.id should now be populated
      createdAt: user.createdAt,
    };

    // Optional: sign JWT if secret present
    const jwtSecret = process.env.JWT_SECRET;
    let token: string | undefined;
    if (jwtSecret) {
      token = jwt.sign({ sub: user._id.toString(), username: user.username }, jwtSecret, {
        expiresIn: "7d",
      });
    }

    return NextResponse.json(token ? { user: userToReturn, token } : { user: userToReturn });
  } catch (err) {
    console.error("Error during login:", err);
    return NextResponse.json({ message: "Failed to authenticate" }, { status: 500 });
  }
}
