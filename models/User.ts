import mongoose, { Schema, type Document } from "mongoose"

export interface IUser extends Document {
  username: string
  name: string
  email: string
  password: string
  role: { type: Schema.Types.ObjectId, ref: "Role", required: true },
  createdAt: Date
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    id: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    name: { type: String, required: true },
    permissions: [{ type: String }],
  },
  createdAt: { type: Date, default: Date.now },
})

const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema)

export default User