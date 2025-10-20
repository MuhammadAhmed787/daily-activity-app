import mongoose, { Schema, type Document } from "mongoose"

export interface IRole extends Document {
  name: string
  permissions: string[]
  createdAt: Date
}

const RoleSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  permissions: [{ type: String, required: true }],
  createdAt: { type: Date, default: Date.now },
})

const Role = mongoose.models.Role || mongoose.model<IRole>("Role", RoleSchema)

export default Role