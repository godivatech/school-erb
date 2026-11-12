import "dotenv/config";
import dns from "node:dns";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Resilient DNS resolver with in-memory TTL cache for cloud database endpoints (e.g. Neon / AWS)
// when local Wi-Fi router or ISP DNS returns ENOTFOUND or RCODE_REFUSED
if (typeof dns.lookup === "function") {
  const globalDnsKey = Symbol.for("__crescent_resilient_dns_patched__");
  const globalAny = globalThis as any;

  if (!globalAny[globalDnsKey]) {
    globalAny[globalDnsKey] = true;
    const fallbackResolver = new dns.Resolver();
    fallbackResolver.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

    const dnsCache = new Map<string, { addrs: string[]; expires: number }>();
    const origLookup = dns.lookup.bind(dns);

    const returnResolved = (addrs: string[], opts: any, cb: any) => {
      if (opts && opts.all) {
        return cb(
          null,
          addrs.map((a: string) => ({ address: a, family: 4 }))
        );
      }
      return cb(null, addrs[0], 4);
    };

    const resilientLookup = function (
      hostname: string,
      options: any,
      callback?: any
    ) {
      let cb = callback;
      let opts = options;
      if (typeof options === "function") {
        cb = options;
        opts = {};
      }

      // Check cache first (TTL 5 minutes)
      const cached = dnsCache.get(hostname);
      if (cached && cached.expires > Date.now()) {
        return returnResolved(cached.addrs, opts, cb);
      }

      // Fast-path: cloud databases like neon.tech frequently encounter ISP DNS refusal
      if (hostname.includes("neon.tech") || hostname.includes("aws.neon")) {
        fallbackResolver.resolve4(hostname, (rErr, addrs) => {
          if (!rErr && addrs && addrs.length > 0) {
            dnsCache.set(hostname, { addrs, expires: Date.now() + 300000 });
            return returnResolved(addrs, opts, cb);
          }
          origLookup(hostname, opts, cb as any);
        });
        return;
      }

      origLookup(hostname, opts, (err: any, address: any, family: any) => {
        if (err && (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN")) {
          fallbackResolver.resolve4(hostname, (rErr, addrs) => {
            if (!rErr && addrs && addrs.length > 0) {
              dnsCache.set(hostname, { addrs, expires: Date.now() + 300000 });
              return returnResolved(addrs, opts, cb);
            }
            cb(err, address, family);
          });
        } else {
          cb(err, address, family);
        }
      }) as any;
    };

    (resilientLookup as any).__promisify__ = (origLookup as any).__promisify__;
    (dns as any).lookup = resilientLookup;
  }
}

const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

function getCleanConnectionString(): string {
  const url =
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/school_erp";
  if (url.includes("sslmode=require")) {
    return url.replace("sslmode=require", "sslmode=verify-full");
  }
  return url;
}

const pool =
  globalForDb.conn ??
  new Pool({
    connectionString: getCleanConnectionString(),
    max: process.env.NODE_ENV === "production" ? 10 : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

// Unconditionally preserve pool on globalThis across all environments
// to prevent serverless Lambda / worker pool exhaustion
globalForDb.conn = pool;

export const db = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

export type Database = typeof db;
export { pool };
