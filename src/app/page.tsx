"use client";

import { useState, useEffect } from "react";
import { Repository } from "@/types/repository";
import { calculateRepositorySummary } from "@/lib/repository-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RepositoryInsights from "@/components/repository-insights";
import TokenSettingsDialog from "@/components/token-settings-dialog";
import ReportGenerator from "@/components/report-generator";
import { getRepositoryDatabase } from "@/lib/db";

// Direct GitHub API client-side functions
async function fetchRepositoriesFromGitHub(token: string): Promise<any[]> {
  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=100', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching repositories from GitHub:', error);
    throw error;
  }
}

async function fetchRepositoryLanguages(repo: any, token: string): Promise<Record<string, number>> {
  try {
    const response = await fetch(repo.languages_url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching languages for ${repo.name}:`, error);
    return {};
  }
}

// Process GitHub API data into our Repository format
async function processRepositoryData(repos: any[], token: string): Promise<Repository[]> {
  const now = new Date();
  const processedRepos: Repository[] = [];
  
  for (const repo of repos) {
    // Get primary language
    let primaryLanguage = 'None';
    try {
      const languages = await fetchRepositoryLanguages(repo, token);
      const entries = Object.entries(languages);
      if (entries.length > 0) {
        // Sort by byte count (descending)
        entries.sort((a, b) => b[1] - a[1]);
        primaryLanguage = entries[0][0];
      }
    } catch (error) {
      console.error(`Error processing languages for ${repo.name}:`, error);
    }
    
    const lastPushDate = new Date(repo.pushed_at);
    const daysSinceLastPush = Math.floor((now.getTime() - lastPushDate.getTime()) / (1000 * 60 * 60 * 24));
    
    processedRepos.push({
      name: repo.name,
      description: repo.description || '',
      url: repo.html_url,
      createdAt: repo.created_at,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
      isArchived: repo.archived,
      diskUsage: repo.size,
      diskUsageMB: repo.size / 1024, // Convert KB to MB
      visibility: repo.private ? 'PRIVATE' : 'PUBLIC',
      primaryLanguage,
      daysSinceLastPush,
      inactive: daysSinceLastPush > 180 // Inactive if no pushes in 6 months
    });
  }
  
  return processedRepos;
}

// Mock data for initial load when no token is available
const mockRepositoryData: Repository[] = [
  {
    name: "example-repo-1",
    description: "An example repository (demo data)",
    url: "https://github.com/user/example-repo-1",
    createdAt: "2023-01-15T12:00:00Z",
    updatedAt: "2023-06-20T15:30:00Z",
    pushedAt: "2023-06-20T15:30:00Z",
    isArchived: false,
    diskUsage: 5200,
    diskUsageMB: 5.2,
    visibility: "PUBLIC",
    primaryLanguage: "JavaScript",
    daysSinceLastPush: 285,
    inactive: true
  },
  {
    name: "example-repo-2",
    description: "Another example repository (demo data)",
    url: "https://github.com/user/example-repo-2",
    createdAt: "2023-03-10T09:15:00Z",
    updatedAt: "2024-03-05T11:45:00Z",
    pushedAt: "2024-03-05T11:45:00Z",
    isArchived: false,
    diskUsage: 12700,
    diskUsageMB: 12.7,
    visibility: "PRIVATE",
    primaryLanguage: "TypeScript",
    daysSinceLastPush: 27,
    inactive: false
  },
  {
    name: "archived-example",
    description: "An archived example repository (demo data)",
    url: "https://github.com/user/archived-example",
    createdAt: "2022-05-20T14:20:00Z",
    updatedAt: "2022-11-12T10:10:00Z",
    pushedAt: "2022-11-12T10:10:00Z",
    isArchived: true,
    diskUsage: 3800,
    diskUsageMB: 3.8,
    visibility: "PUBLIC",
    primaryLanguage: "Python",
    daysSinceLastPush: 506,
    inactive: true
  }
];

export default function RepositoryManager() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<Repository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [languages, setLanguages] = useState<string[]>([]);
  const [summary, setSummary] = useState({
    totalRepos: 0,
    privateRepos: 0,
    publicRepos: 0,
    archivedRepos: 0,
    inactiveRepos: 0,
    totalSizeMB: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInsightsDialog, setShowInsightsDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [hasOpenAIToken, setHasOpenAIToken] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'repositories' | 'report'>('repositories');

  // Initialize database
  const db = getRepositoryDatabase();

  // Check for tokens on component mount
  useEffect(() => {
    const githubToken = localStorage.getItem('github_token');
    const openaiToken = localStorage.getItem('openai_token');
    setHasToken(!!githubToken);
    setHasOpenAIToken(!!openaiToken);
    
    // If no token is found, show the token dialog
    if (!githubToken) {
      setIsDemo(true);
    }
  }, []);

  // Fetch repository data on component mount
  useEffect(() => {
    const loadRepositories = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      
      try {
        // Initialize the database
        await db.init();
        
        // Check if we have a GitHub token
        const githubToken = localStorage.getItem('github_token');
        
        if (!githubToken) {
          // If no token, use mock data
          setRepositories(mockRepositoryData);
          setIsDemo(true);
          setIsLoading(false);
          return;
        }
        
        // Try to load from cache first
        const cachedRepos = await db.getRepositories();
        
        if (cachedRepos && cachedRepos.length > 0) {
          setRepositories(cachedRepos);
          setIsDemo(false);
          
          // Check if cache is expired
          if (db.isDataExpired()) {
            // If expired, refresh in background
            refreshRepositoriesInBackground();
          }
        } else {
          // No cache, fetch from GitHub API
          const repos = await fetchRepositoriesFromGitHub(githubToken);
          const processedRepos = await processRepositoryData(repos, githubToken);
          
          // Store in IndexedDB
          await db.storeRepositories(processedRepos);
          
          setRepositories(processedRepos);
          setIsDemo(false);
        }
      } catch (error) {
        console.error('Error loading repositories:', error);
        setErrorMessage('Failed to load repositories. Please check your GitHub token and try again.');
        setRepositories(mockRepositoryData);
        setIsDemo(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadRepositories();
  }, []);

  // Background refresh function
  const refreshRepositoriesInBackground = async () => {
    try {
      const githubToken = localStorage.getItem('github_token');
      
      if (!githubToken) {
        return;
      }
      
      const repos = await fetchRepositoriesFromGitHub(githubToken);
      const processedRepos = await processRepositoryData(repos, githubToken);
      
      // Store in IndexedDB
      await db.storeRepositories(processedRepos);
      
      // Update state
      setRepositories(processedRepos);
      setIsDemo(false);
    } catch (error) {
      console.error('Error refreshing repositories in background:', error);
    }
  };

  // Refresh repositories
  const refreshRepositories = async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    
    try {
      const githubToken = localStorage.getItem('github_token');
      
      if (!githubToken) {
        setErrorMessage('GitHub token is required. Please set your token in settings.');
        setIsRefreshing(false);
        return;
      }
      
      const repos = await fetchRepositoriesFromGitHub(githubToken);
      const processedRepos = await processRepositoryData(repos, githubToken);
      
      // Store in IndexedDB
      await db.storeRepositories(processedRepos);
      
      setRepositories(processedRepos);
      setIsDemo(false);
    } catch (error) {
      console.error('Error refreshing repositories:', error);
      setErrorMessage('Failed to refresh repositories. Please check your GitHub token and try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Apply filters to repositories
  const applyFilters = () => {
    let filtered = [...repositories];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(repo => 
        repo.name.toLowerCase().includes(term) || 
        (repo.description && repo.description.toLowerCase().includes(term))
      );
    }
    
    // Apply visibility filter
    if (visibilityFilter !== 'all') {
      filtered = filtered.filter(repo => 
        repo.visibility === visibilityFilter
      );
    }
    
    // Apply activity filter
    if (activityFilter !== 'all') {
      if (activityFilter === 'active') {
        filtered = filtered.filter(repo => !repo.inactive);
      } else if (activityFilter === 'inactive') {
        filtered = filtered.filter(repo => repo.inactive);
      } else if (activityFilter === 'archived') {
        filtered = filtered.filter(repo => repo.isArchived);
      }
    }
    
    // Apply language filter
    if (languageFilter !== 'all') {
      filtered = filtered.filter(repo => 
        repo.primaryLanguage === languageFilter
      );
    }
    
    setFilteredRepos(filtered);
  };

  // Update filters when repositories or filter values change
  useEffect(() => {
    applyFilters();
    
    // Extract unique languages
    const uniqueLanguages = new Set<string>();
    repositories.forEach(repo => {
      if (repo.primaryLanguage && repo.primaryLanguage !== 'None') {
        uniqueLanguages.add(repo.primaryLanguage);
      }
    });
    setLanguages(Array.from(uniqueLanguages).sort());
    
    // Calculate summary
    const summaryData = calculateRepositorySummary(repositories);
    setSummary(summaryData);
  }, [repositories, searchTerm, visibilityFilter, activityFilter, languageFilter]);

  // Toggle repository selection
  const toggleRepositorySelection = (repoName: string) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(repoName)) {
      newSelected.delete(repoName);
    } else {
      newSelected.add(repoName);
    }
    setSelectedRepos(newSelected);
  };

  // Select/deselect all repositories
  const toggleSelectAll = () => {
    if (selectedRepos.size === filteredRepos.length) {
      // Deselect all
      setSelectedRepos(new Set());
    } else {
      // Select all
      const newSelected = new Set<string>();
      filteredRepos.forEach(repo => newSelected.add(repo.name));
      setSelectedRepos(newSelected);
    }
  };

  // Archive selected repositories
  const archiveSelectedRepositories = async () => {
    if (selectedRepos.size === 0) return;
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const githubToken = localStorage.getItem('github_token');
      
      if (!githubToken) {
        setErrorMessage('GitHub token is required. Please set your token in settings.');
        setIsLoading(false);
        return;
      }
      
      const response = await fetch('/api/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-token': githubToken
        },
        body: JSON.stringify({ repositories: Array.from(selectedRepos) }),
      });
      
      if (!response.ok) {
        throw new Error(`Error archiving repositories: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh repositories after archiving
        await refreshRepositories();
        setSelectedRepos(new Set());
        setShowArchiveDialog(false);
      } else {
        throw new Error(result.message || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error archiving repositories:', error);
      setErrorMessage(`Failed to archive repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete selected repositories
  const deleteSelectedRepositories = async () => {
    if (selectedRepos.size === 0) return;
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const githubToken = localStorage.getItem('github_token');
      
      if (!githubToken) {
        setErrorMessage('GitHub token is required. Please set your token in settings.');
        setIsLoading(false);
        return;
      }
      
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-token': githubToken
        },
        body: JSON.stringify({ repositories: Array.from(selectedRepos) }),
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting repositories: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh repositories after deletion
        await refreshRepositories();
        setSelectedRepos(new Set());
        setShowDeleteDialog(false);
      } else {
        throw new Error(result.message || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error deleting repositories:', error);
      setErrorMessage(`Failed to delete repositories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Show repository insights
  const showInsights = (repository: Repository) => {
    setSelectedRepository(repository);
    setShowInsightsDialog(true);
  };

  return (
    <main className="container mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold mb-6">GitHub Repository Manager</h1>
      
      {/* Error message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {errorMessage}
        </div>
      )}
      
      {/* Demo mode warning */}
      {isDemo && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded mb-6">
          <p className="font-medium">Demo Mode</p>
          <p>You're viewing example data. Set your GitHub token to see your actual repositories.</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowTokenDialog(true)}
            className="mt-2"
          >
            Set GitHub Token
          </Button>
        </div>
      )}
      
      {/* Repository summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Repositories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRepos}</div>
            <p className="text-xs text-gray-500">
              {summary.publicRepos} public, {summary.privateRepos} private
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Repository Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.archivedRepos}</div>
            <p className="text-xs text-gray-500">
              Archived repositories
            </p>
            <div className="text-2xl font-bold mt-2">{summary.inactiveRepos}</div>
            <p className="text-xs text-gray-500">
              Inactive repositories (no pushes in 6 months)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalSizeMB.toFixed(2)} MB</div>
            <p className="text-xs text-gray-500">
              Across all repositories
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'repositories' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('repositories')}
        >
          Repositories
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'report' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('report')}
        >
          Analysis Report
        </button>
      </div>
      
      {activeTab === 'repositories' ? (
        <>
          {/* Repository filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search repositories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Visibility</SelectItem>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                  <SelectItem value="PRIVATE">Private</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Activity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  {languages.map(lang => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                onClick={refreshRepositories}
                disabled={isRefreshing || isLoading}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
          
          {/* Repository actions */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <Checkbox 
                id="select-all" 
                checked={selectedRepos.size > 0 && selectedRepos.size === filteredRepos.length}
                onCheckedChange={toggleSelectAll}
                className="mr-2"
              />
              <label 
                htmlFor="select-all" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {selectedRepos.size === 0 ? "Select All" : 
                  selectedRepos.size === filteredRepos.length ? "Deselect All" : 
                  `Selected ${selectedRepos.size} of ${filteredRepos.length}`}
              </label>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowTokenDialog(true)}
              >
                Settings
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setShowArchiveDialog(true)}
                disabled={selectedRepos.size === 0}
              >
                Archive Selected
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(true)}
                disabled={selectedRepos.size === 0}
                className="text-red-600 hover:text-red-700"
              >
                Delete Selected
              </Button>
            </div>
          </div>
          
          {/* Repository table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Last Push</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading repositories...
                    </TableCell>
                  </TableRow>
                ) : filteredRepos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No repositories found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRepos.map(repo => (
                    <TableRow key={repo.name}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedRepos.has(repo.name)}
                          onCheckedChange={() => toggleRepositorySelection(repo.name)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{repo.name}</div>
                        <div className="text-sm text-gray-500">{repo.description || 'No description'}</div>
                        <div className="text-xs text-blue-600 mt-1">
                          <a href={repo.url} target="_blank" rel="noopener noreferrer">
                            View on GitHub
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        {repo.isArchived ? (
                          <Badge variant="outline" className="bg-gray-100">Archived</Badge>
                        ) : repo.inactive ? (
                          <Badge variant="outline" className="bg-amber-100">Inactive</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-100">Active</Badge>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {repo.visibility === 'PUBLIC' ? 'Public' : 'Private'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {repo.primaryLanguage !== 'None' ? (
                          <Badge variant="outline">{repo.primaryLanguage}</Badge>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{new Date(repo.pushedAt).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">
                          {repo.daysSinceLastPush} days ago
                        </div>
                      </TableCell>
                      <TableCell>
                        {repo.diskUsageMB.toFixed(2)} MB
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => showInsights(repo)}
                          disabled={!hasOpenAIToken && !isDemo}
                        >
                          Insights
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <ReportGenerator repositories={repositories} selectedRepos={selectedRepos} />
      )}
      
      {/* Token settings dialog */}
      <TokenSettingsDialog 
        open={showTokenDialog} 
        onOpenChange={setShowTokenDialog}
        onTokensUpdated={() => {
          setHasToken(!!localStorage.getItem('github_token'));
          setHasOpenAIToken(!!localStorage.getItem('openai_token'));
          refreshRepositories();
        }}
      />
      
      {/* Archive confirmation dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Repositories</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive {selectedRepos.size} repositories? This will create a backup zip file.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[200px] overflow-y-auto">
            <ul className="list-disc pl-6">
              {Array.from(selectedRepos).map(repoName => (
                <li key={repoName}>{repoName}</li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>Cancel</Button>
            <Button onClick={archiveSelectedRepositories} disabled={isLoading}>
              {isLoading ? "Archiving..." : "Archive Repositories"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Repositories</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedRepos.size} repositories? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[200px] overflow-y-auto">
            <ul className="list-disc pl-6">
              {Array.from(selectedRepos).map(repoName => (
                <li key={repoName}>{repoName}</li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button 
              onClick={deleteSelectedRepositories} 
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Deleting..." : "Delete Repositories"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Repository insights dialog */}
      <Dialog open={showInsightsDialog} onOpenChange={setShowInsightsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Repository Insights</DialogTitle>
            <DialogDescription>
              AI-powered analysis and recommendations for {selectedRepository?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRepository && (
            <RepositoryInsights
              repositoryName={selectedRepository.name}
              repositoryUrl={selectedRepository.url}
              repositoryDescription={selectedRepository.description}
              primaryLanguage={selectedRepository.primaryLanguage}
              createdAt={selectedRepository.createdAt}
              updatedAt={selectedRepository.updatedAt}
            />
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInsightsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
