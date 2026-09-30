import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is not configured");
  mongoose.set("strictQuery", false);
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
