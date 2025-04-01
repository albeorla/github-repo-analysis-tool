export const dynamic = "force-static";

import { NextResponse } from 'next/server';

export async function POST() {
  // Static response for archive functionality in static export
  return NextResponse.json({
    success: true,
    message: `Successfully archived 3 repositories`,
    archive_path: "/archives/github-repos-archive-2025-04-01.json"
  });
}
