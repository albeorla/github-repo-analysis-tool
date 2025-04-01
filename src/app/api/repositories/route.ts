export const dynamic = "force-static";

import { NextResponse } from 'next/server';

// Pre-generated static data for repositories
const staticRepositories = [
  {
    name: "example-repo-1",
    url: "https://github.com/user/example-repo-1",
    description: "An example repository for demonstration",
    isArchived: false,
    diskUsage: 1024,
    diskUsageMB: 1.02,
    visibility: "PUBLIC",
    createdAt: "2023-01-15T10:30:00Z",
    updatedAt: "2023-03-20T14:45:00Z",
    pushedAt: "2023-03-20T14:45:00Z",
    daysSinceLastPush: 378,
    inactive: true,
    primaryLanguage: "JavaScript"
  },
  {
    name: "example-repo-2",
    url: "https://github.com/user/example-repo-2",
    description: "Another example repository",
    isArchived: false,
    diskUsage: 2048,
    diskUsageMB: 2.05,
    visibility: "PRIVATE",
    createdAt: "2023-02-10T09:15:00Z",
    updatedAt: "2023-12-05T11:30:00Z",
    pushedAt: "2023-12-05T11:30:00Z",
    daysSinceLastPush: 118,
    inactive: false,
    primaryLanguage: "TypeScript"
  },
  {
    name: "archived-repo",
    url: "https://github.com/user/archived-repo",
    description: "An archived repository",
    isArchived: true,
    diskUsage: 512,
    diskUsageMB: 0.51,
    visibility: "PUBLIC",
    createdAt: "2022-05-20T16:45:00Z",
    updatedAt: "2022-08-15T13:20:00Z",
    pushedAt: "2022-08-15T13:20:00Z",
    daysSinceLastPush: 595,
    inactive: true,
    primaryLanguage: "Python"
  }
];

export async function GET() {
  return NextResponse.json(staticRepositories);
}
