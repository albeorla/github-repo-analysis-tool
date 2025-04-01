export interface GitHubRepo {
  name: string;
  description: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  isArchived: boolean;
  diskUsage: number;
  visibility: string;
  languages: Array<{
    node: {
      name: string;
    }
  }>;
  defaultBranchRef: any;
}

export interface Repository {
  name: string;
  url: string;
  description: string | null;
  isArchived: boolean;
  diskUsage: number;
  diskUsageMB: number;
  visibility: 'PRIVATE' | 'PUBLIC';
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  daysSinceLastPush: number;
  inactive: boolean;
  primaryLanguage: string;
  insights?: string;
}
