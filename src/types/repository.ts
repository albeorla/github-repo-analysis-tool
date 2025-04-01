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
  insights?: string; // For LLM-generated insights
}

export interface RepositorySummary {
  totalRepos: number;
  privateRepos: number;
  publicRepos: number;
  archivedRepos: number;
  inactiveRepos: number;
  totalSizeMB: number;
  languages: Record<string, number>;
}
