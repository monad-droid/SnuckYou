import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL not configured" },
      { status: 500 }
    );
  }

  const { sql } = (await request.json()) as { sql: string };
  if (!sql || typeof sql !== "string") {
    return NextResponse.json(
      { error: "sql field is required" },
      { status: 400 }
    );
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const result = await client.query(sql);
    return NextResponse.json({
      success: true,
      rowCount: result.rowCount,
      command: result.command,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await client.end();
  }
}
