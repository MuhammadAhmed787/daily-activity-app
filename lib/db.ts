// lib/db.ts
import mongoose from "mongoose";
import dns from "dns/promises";

const MONGODB_URI = process.env.MONGODB_URI ?? "";

if (!MONGODB_URI) {
  // fail loudly instead of silently falling back to localhost (helps catch missing env)
  throw new Error("MONGODB_URI is not defined. Set it in .env.local or in your deployment settings.");
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = global as unknown as { _mongoose?: MongooseCache };

if (!globalWithMongoose._mongoose) {
  globalWithMongoose._mongoose = { conn: null, promise: null };
}

const cached: MongooseCache = globalWithMongoose._mongoose!;

function summarizeUri(uri: string): string {
  try {
    const safe = uri.replace(/^mongodb\+srv:\/\//i, "http://");
    const u = new URL(safe);
    const hostAndPath = u.host + (u.pathname || "");
    if (u.username || u.password) {
      return `${u.protocol}//<redacted>@${hostAndPath}`;
    }
    return hostAndPath;
  } catch {
    return uri.length > 120 ? uri.slice(0, 120) + "..." : uri;
  }
}

async function checkSrvResolutionIfNeeded(uri: string) {
  if (/^mongodb\+srv:\/\//i.test(uri)) {
    try {
      const safe = uri.replace(/^mongodb\+srv:\/\//i, "http://");
      const u = new URL(safe);
      const hostname = u.hostname; // ✅ only the cluster host
      console.log("[db] SRV check for", hostname);
      const records = await dns.resolveSrv(`_mongodb._tcp.${hostname}`);
      console.log("[db] SRV records:", records);
    } catch (err) {
      console.error(
        "[db] SRV DNS resolution failed — this often means DNS/SRV requests are blocked on this network.",
        err
      );
      throw err;
    }
  }
}

export default async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    console.log("[db] Using cached mongoose connection");
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // adjust up in production as needed
    };

    console.log("[db] Attempting to connect to MongoDB:", summarizeUri(MONGODB_URI));

    // run SRV check first if needed
    cached.promise = (async () => {
      try {
        await checkSrvResolutionIfNeeded(MONGODB_URI);
      } catch (err) {
        // ensure the rejection contains useful info
        throw err;
      }

      try {
        const m = await mongoose.connect(MONGODB_URI, opts);
        console.log("[db] MongoDB connected");
        console.log("[db] connection.readyState =", mongoose.connection.readyState);
        return m;
      } catch (err: any) {
        console.error("[db] MongoDB connection error → name:", err.name, "message:", err.message);
        if (err.reason) {
          console.error("[db] reason:", err.reason);
        }
        console.error(err.stack);
        throw err;
      }
    })();
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export async function checkDbHealth() {
  try {
    await dbConnect();
    const state = mongoose.connection.readyState;
    const db = mongoose.connection.db;
    if (!db) return { ok: false, state };

    const admin = db.admin();
    const pingRes = await admin.ping();
    const cols = await db.listCollections().toArray();
    const collectionNames = cols.map((c) => c.name);

    return { ok: true, state, ping: pingRes, collections: collectionNames };
  } catch (err: unknown) {
    const errStr = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[db] checkDbHealth error:", err);
    return { ok: false, state: mongoose.connection.readyState, error: errStr };
  }
}

export function debugEnvAndConnection(): void {
  console.log("[db.debug] MONGODB_URI (redacted):", summarizeUri(MONGODB_URI));
  console.log("[db.debug] NODE_ENV:", process.env.NODE_ENV ?? "undefined");
  console.log("[db.debug] mongoose.connection.readyState =", mongoose.connection.readyState);
  console.log("[db.debug] mongoose.connections length =", mongoose.connections?.length ?? 0);
}
