import mongoose, { Schema, Document } from "mongoose";

interface ISoftwareInfo {
  softwareType: string;
  version: string;
  lastUpdated: Date;
}

interface ICompany extends Document {
  code: string;
  companyName: string;
  city: string;
  phoneNumber: string;
  address: string;
  support: string;
  designatedDeveloper: string;
  companyRepresentative: string;
  softwareInformation: ISoftwareInfo[];
  createdAt: Date;
  createdBy: string;
}

const CompanySchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    companyName: { type: String, required: true },
    city: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    address: { type: String, required: true },
    support: { type: String, enum: ["Active", "In-Active"], required: true },
    designatedDeveloper: { type: String, default: "N/A" },
    companyRepresentative: { type: String, default: "N/A" },
    softwareInformation: [
      {
        softwareType: { type: String, enum: ["Finance Manager", "Finance Controller", "Power Accounting", "Ems Finance Manager Urdu", "Pos"], required: true },
        version: { type: String, enum: ["v1.00", "v2.00", "v3.00"], required: true },
        lastUpdated: { type: Date, required: true },
      },
    ],
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.CompanyInformation ||
  mongoose.model<ICompany>("CompanyInformation", CompanySchema);