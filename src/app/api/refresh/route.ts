export const dynamic = "force-static";

import { NextResponse } from 'next/server';

export async function POST() {
  // Static response for refresh functionality in static export
  return NextResponse.json({
    success: true,
    message: `Successfully refreshed repository data`,
    timestamp: new Date().toISOString(),
    count: 3
  });
}
