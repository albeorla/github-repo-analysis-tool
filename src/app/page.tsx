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
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [hasOpenAIToken, setHasOpenAIToken] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        
        const token = localStorage.getItem('github_token');
        let data: Repository[];
        
        if (token) {
          // First check if we have cached data
          const cachedRepos = await db.getRepositories();
          const lastUpdateTime = await db.getLastRepoUpdateTime();
          
          if (cachedRepos.length > 0 && lastUpdateTime) {
            // Use cached data
            console.log(`Using ${cachedRepos.length} repositories from cache, last updated: ${lastUpdateTime}`);
            data = cachedRepos;
            setIsDemo(false);
            
            // Check if cache is older than 1 hour, if so refresh in background
            const lastUpdate = new Date(lastUpdateTime);
            const now = new Date();
            const diffHours = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
            
            if (diffHours > 1) {
              console.log('Cache is older than 1 hour, refreshing in background');
              refreshRepositoriesInBackground(token);
            }
          } else {
            // No cache or empty cache, fetch from GitHub
            const githubRepos = await fetchRepositoriesFromGitHub(token);
            data = await processRepositoryData(githubRepos, token);
            
            // Store in IndexedDB
            await db.storeRepositories(data);
            setIsDemo(false);
          }
        } else {
          // Use mock data if no token is available
          data = [...mockRepositoryData];
          setIsDemo(true);
          // Add a small delay to simulate loading
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        setRepositories(data);
        setFilteredRepos(data);
        
        // Extract unique languages
        const uniqueLanguages = new Set<string>();
        data.forEach(repo => {
          if (repo.primaryLanguage && repo.primaryLanguage !== 'None') {
            uniqueLanguages.add(repo.primaryLanguage);
          }
        });
        setLanguages(Array.from(uniqueLanguages).sort());
        
        // Calculate summary
        const summaryData = calculateRepositorySummary(data);
        setSummary({
          totalRepos: summaryData.totalRepos,
          privateRepos: summaryData.privateRepos,
          publicRepos: summaryData.publicRepos,
          archivedRepos: summaryData.archivedRepos,
          inactiveRepos: summaryData.inactiveRepos,
          totalSizeMB: summaryData.totalSizeMB,
        });
      } catch (error) {
        console.error('Error loading repositories:', error);
        setErrorMessage(`Failed to load repositories: ${error instanceof Error ? error.message : String(error)}`);
        // Use mock data as fallback
        setRepositories([...mockRepositoryData]);
        setFilteredRepos([...mockRepositoryData]);
        setIsDemo(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadRepositories();
  }, []);

  // Background refresh function to update repository data without blocking UI
  const refreshRepositoriesInBackground = async (token: string) => {
    try {
      console.log('Starting background refresh of repositories');
      
      // Fetch from GitHub
      const githubRepos = await fetchRepositoriesFromGitHub(token);
      const freshData = await processRepositoryData(githubRepos, token);
      
      // Store in IndexedDB
      await db.storeRepositories(freshData);
      
      console.log('Background refresh completed, stored', freshData.length, 'repositories');
      
      // Update UI with new data
      setRepositories(freshData);
      
      // Reapply filters to the new data
      applyFilters(freshData);
      
      // Recalculate summary
      const summaryData = calculateRepositorySummary(freshData);
      setSummary({
        totalRepos: summaryData.totalRepos,
        privateRepos: summaryData.privateRepos,
        publicRepos: summaryData.publicRepos,
        archivedRepos: summaryData.archivedRepos,
        inactiveRepos: summaryData.inactiveRepos,
        totalSizeMB: summaryData.totalSizeMB,
      });
      
      // Extract unique languages
      const uniqueLanguages = new Set<string>();
      freshData.forEach(repo => {
        if (repo.primaryLanguage && repo.primaryLanguage !== 'None') {
          uniqueLanguages.add(repo.primaryLanguage);
        }
      });
      setLanguages(Array.from(uniqueLanguages).sort());
      
    } catch (error) {
      console.error('Error in background refresh:', error);
      // Don't show error to user since this is a background operation
    }
  };

  // Filter repositories when filters change
  useEffect(() => {
    applyFilters(repositories);
  }, [searchTerm, visibilityFilter, activityFilter, languageFilter, repositories]);

  // Apply all filters to the repository list
  const applyFilters = (repos: Repository[]) => {
    if (repos.length === 0) return;
    
    const filtered = repos.filter(repo => {
      // Search filter
      const matchesSearch = 
        searchTerm === "" || 
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Visibility filter
      const matchesVisibility = 
        visibilityFilter === "all" || 
        (visibilityFilter === "public" && repo.visibility === "PUBLIC") || 
        (visibilityFilter === "private" && repo.visibility === "PRIVATE");
      
      // Activity filter
      const matchesActivity = 
        activityFilter === "all" || 
        (activityFilter === "active" && !repo.inactive) || 
        (activityFilter === "inactive" && repo.inactive) ||
        (activityFilter === "archived" && repo.isArchived);
      
      // Language filter
      const matchesLanguage = 
        languageFilter === "all" || 
        repo.primaryLanguage === languageFilter;
      
      return matchesSearch && matchesVisibility && matchesActivity && matchesLanguage;
    });
    
    setFilteredRepos(filtered);
  };

  // Handle repository selection
  const toggleRepoSelection = (repoName: string) => {
    const newSelection = new Set(selectedRepos);
    if (newSelection.has(repoName)) {
      newSelection.delete(repoName);
    } else {
      newSelection.add(repoName);
    }
    setSelectedRepos(newSelection);
  };

  // Select or deselect all repositories
  const toggleSelectAll = () => {
    if (selectedRepos.size === filteredRepos.length) {
      // Deselect all
      setSelectedRepos(new Set());
    } else {
      // Select all
      const newSelection = new Set<string>();
      filteredRepos.forEach(repo => newSelection.add(repo.name));
      setSelectedRepos(newSelection);
    }
  };

  // Handle refresh button click
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    
    const token = localStorage.getItem('github_token');
    if (!token) {
      setError('GitHub token not found. Please set your token in settings.');
      setIsRefreshing(false);
      return;
    }
    
    try {
      // Fetch from GitHub
      const githubRepos = await fetchRepositoriesFromGitHub(token);
      const freshData = await processRepositoryData(githubRepos, token);
      
      // Store in IndexedDB
      await db.storeRepositories(freshData);
      
      // Update state
      setRepositories(freshData);
      setIsDemo(false);
      
      // Extract unique languages
      const uniqueLanguages = new Set<string>();
      freshData.forEach(repo => {
        if (repo.primaryLanguage && repo.primaryLanguage !== 'None') {
          uniqueLanguages.add(repo.primaryLanguage);
        }
      });
      setLanguages(Array.from(uniqueLanguages).sort());
      
      // Calculate summary
      const summaryData = calculateRepositorySummary(freshData);
      setSummary({
        totalRepos: summaryData.totalRepos,
        privateRepos: summaryData.privateRepos,
        publicRepos: summaryData.publicRepos,
        archivedRepos: summaryData.archivedRepos,
        inactiveRepos: summaryData.inactiveRepos,
        totalSizeMB: summaryData.totalSizeMB,
      });
    } catch (err) {
      console.error('Error refreshing repositories:', err);
      setError('Failed to refresh repositories. Please check your GitHub token and try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to handle token settings save
  const handleTokenSave = async (githubToken: string, openaiToken: string) => {
    setIsLoading(true);
    setError(null);
    
    // Update OpenAI token state
    setHasOpenAIToken(!!openaiToken);
    
    // Initialize the database
    await db.init();
    
    if (githubToken) {
      try {
        // Fetch repositories with the new token
        const repos = await fetchRepositoriesFromGitHub(githubToken);
        const processedRepos = await processRepositoryData(repos, githubToken);
        
        // Store in IndexedDB
        await db.storeRepositories(processedRepos);
        
        // Update state
        setRepositories(processedRepos);
        setFilteredRepos(processedRepos);
        setIsDemo(false);
        setHasToken(true);
        
        // Extract unique languages
        const uniqueLanguages = new Set<string>();
        processedRepos.forEach(repo => {
          if (repo.primaryLanguage && repo.primaryLanguage !== 'None') {
            uniqueLanguages.add(repo.primaryLanguage);
          }
        });
        setLanguages(Array.from(uniqueLanguages).sort());
        
        // Calculate summary
        const summaryData = calculateRepositorySummary(processedRepos);
        setSummary({
          totalRepos: summaryData.totalRepos,
          privateRepos: summaryData.privateRepos,
          publicRepos: summaryData.publicRepos,
          archivedRepos: summaryData.archivedRepos,
          inactiveRepos: summaryData.inactiveRepos,
          totalSizeMB: summaryData.totalSizeMB,
        });
      } catch (err) {
        console.error('Error fetching repositories:', err);
        setError('Failed to fetch repositories. Please check your GitHub token and try again.');
        
        // Use mock data as fallback
        setRepositories(mockRepositoryData);
        setFilteredRepos(mockRepositoryData);
        setIsDemo(true);
      }
    } else {
      // If no token provided, use demo data
      setRepositories(mockRepositoryData);
      setFilteredRepos(mockRepositoryData);
      setIsDemo(true);
      setHasToken(false);
    }
    
    setIsLoading(false);
  };

  // Handle archive button click
  const handleArchive = () => {
    if (selectedRepos.size === 0) return;
    setShowArchiveDialog(true);
  };

  // Handle delete button click
  const handleDelete = () => {
    if (selectedRepos.size === 0) return;
    setShowDeleteDialog(true);
  };

  // Handle insights button click
  const handleInsights = (repo: Repository) => {
    setSelectedRepository(repo);
    setShowInsightsDialog(true);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Format file size for display
  const formatSize = (sizeInMB: number) => {
    if (sizeInMB < 0.1) return "< 0.1 MB";
    return `${sizeInMB.toFixed(1)} MB`;
  };

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">GitHub Repository Manager</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowTokenDialog(true)}
          >
            {hasToken ? "Change Token" : "Set GitHub Token"}
          </Button>
          <Button 
            onClick={handleRefresh} 
            disabled={isRefreshing || !hasToken}
          >
            {isRefreshing ? "Refreshing..." : "Refresh Repository Data"}
          </Button>
        </div>
      </div>

      {isDemo && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
          <p className="font-medium">Demo Mode</p>
          <p>You're viewing sample repository data. Set your GitHub token to see your actual repositories.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Repository Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{summary.totalRepos}</div>
            <div className="text-sm text-gray-500 mt-2">
              {summary.publicRepos} public / {summary.privateRepos} private
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Storage Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{summary.totalSizeMB.toFixed(1)} MB</div>
            <div className="text-sm text-gray-500 mt-2">
              Across {summary.totalRepos} repositories
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Repository Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{summary.archivedRepos}</div>
            <div className="text-sm text-gray-500 mt-2">
              Archived / {summary.inactiveRepos} Inactive
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Repository List</h2>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <Input
              type="text"
              placeholder="Search repositories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Select activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {languages.map((lang) => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-4 border-t flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="selectAll" 
              checked={selectedRepos.size === filteredRepos.length && filteredRepos.length > 0} 
              onCheckedChange={toggleSelectAll}
            />
            <label htmlFor="selectAll" className="text-sm font-medium">
              {selectedRepos.size === 0 
                ? "Select All" 
                : `Selected ${selectedRepos.size} of ${filteredRepos.length}`}
            </label>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={handleArchive}
              disabled={selectedRepos.size === 0}
            >
              Archive Selected
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={selectedRepos.size === 0}
            >
              Delete Selected
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading repositories...</p>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">No repositories found matching your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Last Push</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRepos.map((repo) => (
                  <TableRow key={repo.name} className={repo.isArchived ? "bg-gray-50" : ""}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedRepos.has(repo.name)} 
                        onCheckedChange={() => toggleRepoSelection(repo.name)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <a 
                          href={repo.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-medium hover:underline"
                        >
                          {repo.name}
                        </a>
                        {repo.isArchived && (
                          <Badge variant="outline" className="ml-2">Archived</Badge>
                        )}
                        {repo.inactive && !repo.isArchived && (
                          <Badge variant="outline" className="ml-2 bg-yellow-50">Inactive</Badge>
                        )}
                        <p className="text-sm text-gray-500 truncate max-w-md">
                          {repo.description || "No description"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={repo.visibility === "PUBLIC" ? "default" : "secondary"}>
                        {repo.visibility.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{repo.primaryLanguage}</TableCell>
                    <TableCell>
                      <div>
                        {formatDate(repo.pushedAt)}
                        <p className="text-sm text-gray-500">
                          {repo.daysSinceLastPush} days ago
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{formatSize(repo.diskUsageMB)}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleInsights(repo)}
                        disabled={!hasOpenAIToken}
                        title={!hasOpenAIToken ? "Set OpenAI API key to enable insights" : "View AI-powered insights"}
                      >
                        Insights
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Archive Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Repositories</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive the selected repositories? This will combine them into a zip file.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500">
              Selected repositories ({selectedRepos.size}):
            </p>
            <ul className="mt-2 text-sm">
              {Array.from(selectedRepos).slice(0, 5).map(name => (
                <li key={name} className="text-gray-700">{name}</li>
              ))}
              {selectedRepos.size > 5 && (
                <li className="text-gray-500">...and {selectedRepos.size - 5} more</li>
              )}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              // Archive logic would go here
              setShowArchiveDialog(false);
              setSelectedRepos(new Set());
            }}>
              Archive Repositories
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Repositories</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the selected repositories? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500">
              Selected repositories ({selectedRepos.size}):
            </p>
            <ul className="mt-2 text-sm">
              {Array.from(selectedRepos).slice(0, 5).map(name => (
                <li key={name} className="text-gray-700">{name}</li>
              ))}
              {selectedRepos.size > 5 && (
                <li className="text-gray-500">...and {selectedRepos.size - 5} more</li>
              )}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => {
              // Delete logic would go here
              setShowDeleteDialog(false);
              setSelectedRepos(new Set());
            }}>
              Delete Repositories
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insights Dialog */}
      <Dialog open={showInsightsDialog} onOpenChange={setShowInsightsDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Repository Insights</DialogTitle>
            <DialogDescription>
              AI-powered analysis for {selectedRepository?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedRepository && (
            <div className="py-4">
              <RepositoryInsights
                repositoryName={selectedRepository.name}
                repositoryUrl={selectedRepository.url}
                repositoryDescription={selectedRepository.description || ''}
                primaryLanguage={selectedRepository.primaryLanguage}
                createdAt={selectedRepository.createdAt}
                updatedAt={selectedRepository.updatedAt}
              />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowInsightsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Settings Dialog */}
      <TokenSettingsDialog
        isOpen={showTokenDialog}
        onClose={() => setShowTokenDialog(false)}
        onSave={handleTokenSave}
      />
    </div>
  );
}
