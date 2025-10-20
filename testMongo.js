// testMongo.js (CommonJS version)
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI;

async function testConnection() {
  try {
    console.log("[db] Trying to connect to:", uri);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("[db] ? Connected successfully to MongoDB Atlas!");
    process.exit(0);
  } catch (err) {
    console.error("[db] ? Connection failed:", err.message);
    process.exit(1);
  }
}

testConnection();
