import "dotenv/config";
import mongoose from "mongoose";

const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
if (!email) {
  console.error("Set ADMIN_EMAIL to the existing account email you want to make admin.");
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is required.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const users = mongoose.connection.db.collection("users");
const result = await users.updateOne({ email }, { $set: { role: "admin" } });
console.log(result.matchedCount ? `Admin role set for ${email}` : `No user found for ${email}`);
await mongoose.disconnect();
