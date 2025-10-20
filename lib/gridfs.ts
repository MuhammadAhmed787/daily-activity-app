// lib/gridfs.ts
import mongoose from "mongoose";
import dbConnect from "./db";

let gfs: mongoose.mongo.GridFSBucket | null = null;

export async function getGridFS(): Promise<mongoose.mongo.GridFSBucket> {
  if (gfs) return gfs;

  // Ensure mongoose is connected
  await dbConnect();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection is not established.");
  }

  gfs = new mongoose.mongo.GridFSBucket(db, {
    bucketName: "uploads",
  });

  return gfs;
}
