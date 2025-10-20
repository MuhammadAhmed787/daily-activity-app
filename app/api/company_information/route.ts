import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import CompanyInformation from "@/models/CompanyInformation";

export async function GET() {
  try {
    await dbConnect();
    const companies = await CompanyInformation.find({}).lean();
    return NextResponse.json(companies, { status: 200 });
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const company = new CompanyInformation(body);
    const savedCompany = await company.save();
    return NextResponse.json(savedCompany, { status: 201 });
  } catch (error) {
    console.error("Error creating company:", error);
    return NextResponse.json(
      { error: "Failed to create company" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const { _id, ...updateData } = body;
    const updatedCompany = await CompanyInformation.findByIdAndUpdate(
      _id,
      { $set: updateData },
      { new: true }
    ).lean();
    if (!updatedCompany) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(updatedCompany, { status: 200 });
  } catch (error) {
    console.error("Error updating company:", error);
    return NextResponse.json(
      { error: "Failed to update company" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }
    const deletedCompany = await CompanyInformation.findByIdAndDelete(id).lean();
    if (!deletedCompany) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: "Company deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting company:", error);
    return NextResponse.json(
      { error: "Failed to delete company" },
      { status: 500 }
    );
  }
}