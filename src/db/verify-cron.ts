import "dotenv/config";
import { GET, POST } from "../app/api/cron/outbox/route";
import { db, pool } from "./index";
import * as schema from "./schema";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ CRON ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runCronSuite() {
  console.log("\n================================================================================");
  console.log("⏱️ BACKGROUND OUTBOX CRON ROUTE VERIFICATION SUITE");
  console.log("================================================================================\n");

  // 1. Test GET invocation
  console.log("📌 TEST 1: Invoke GET /api/cron/outbox");
  const getReq = new Request("http://localhost:3000/api/cron/outbox?batchSize=10", {
    method: "GET",
  });
  const getRes = await GET(getReq);
  const getBody = await getRes.json();

  console.log("  Response:", getBody);
  assert(getRes.status === 200, "GET /api/cron/outbox returned HTTP 200");
  assert(getBody.success === true, "Response payload indicates success: true");
  assert(typeof getBody.processed === "number", "Returned numeric processed count");
  assert(typeof getBody.durationMs === "number", "Returned execution duration in ms");
  console.log("✅ TEST 1 PASSED: GET handler operates cleanly.\n");

  // 2. Test POST invocation
  console.log("📌 TEST 2: Invoke POST /api/cron/outbox");
  const postReq = new Request("http://localhost:3000/api/cron/outbox?batchSize=25", {
    method: "POST",
  });
  const postRes = await POST(postReq);
  const postBody = await postRes.json();

  console.log("  Response:", postBody);
  assert(postRes.status === 200, "POST /api/cron/outbox returned HTTP 200");
  assert(postBody.success === true, "Response payload indicates success: true");
  assert(postBody.batchSize === 25, "Custom batchSize 25 was respected");
  console.log("✅ TEST 2 PASSED: POST handler operates cleanly.\n");

  // 3. Test Security Guard with invalid CRON_SECRET in production simulation
  console.log("📌 TEST 3: CRON_SECRET Security Authorization Guard");
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.CRON_SECRET;
  try {
    (process.env as any).NODE_ENV = "production";
    process.env.CRON_SECRET = "super_secure_cron_token_xyz999";

    // Request without secret -> must return 401
    const unauthReq = new Request("http://localhost:3000/api/cron/outbox", {
      method: "GET",
    });
    const unauthRes = await GET(unauthReq);
    assert(unauthRes.status === 401, "Unauthenticated request correctly rejected with HTTP 401");

    // Request with valid Bearer token -> must return 200
    const authReq = new Request("http://localhost:3000/api/cron/outbox", {
      method: "GET",
      headers: {
        Authorization: "Bearer super_secure_cron_token_xyz999",
      },
    });
    const authRes = await GET(authReq);
    assert(authRes.status === 200, "Valid Bearer token request accepted with HTTP 200");
    console.log("✅ TEST 3 PASSED: CRON_SECRET authentication strictly enforced.\n");
  } finally {
    (process.env as any).NODE_ENV = prevEnv;
    process.env.CRON_SECRET = prevSecret;
  }

  console.log("================================================================================");
  console.log("🎉 OUTBOX CRON ROUTE VERIFIED SUCCESSFULLY!");
  console.log("================================================================================\n");

  await pool.end();
}

runCronSuite().catch((err) => {
  console.error("Cron verification failure:", err);
  process.exit(1);
});
