import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import CompanyInformation from "@/models/CompanyInformation";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const body = await req.json();
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }

    const updatedCompany = await CompanyInformation.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    ).lean();

    if (!updatedCompany) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    return NextResponse.json(updatedCompany, { status: 200 });
  } catch (error) {
    console.error("Error updating company:", error);
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }

    const deletedCompany = await CompanyInformation.findByIdAndDelete(id);

    if (!deletedCompany) {
      return NextResponse.json({ message: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Company deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting company:", error);
    return NextResponse.json({ message: "Failed to delete company" }, { status: 500 });
  }
}