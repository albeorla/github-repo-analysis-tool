export const dynamic = "force-static";

import { NextResponse } from 'next/server';

export async function POST() {
  // Static response for delete functionality in static export
  return NextResponse.json({
    success: true,
    message: `Successfully processed 2 repositories for deletion`,
    results: [
      {
        name: "example-repo-1",
        success: true,
        message: "Repository example-repo-1 would be deleted in production"
      },
      {
        name: "archived-repo",
        success: true,
        message: "Repository archived-repo would be deleted in production"
      }
    ]
  });
}
