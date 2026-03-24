import { NextRequest, NextResponse } from "next/server";
import { extractReceiptItems } from "@/lib/receipt-parser";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const { text } = await pdfParse(buffer);

    const items = extractReceiptItems(text);

    return NextResponse.json({ items, rawLineCount: text.split("\n").length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("PDF parse error:", message, err);
    return NextResponse.json(
      { error: `Failed to parse PDF: ${message}` },
      { status: 500 }
    );
  }
}
