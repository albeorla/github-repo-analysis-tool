"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TokenSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTokensUpdated: () => void;
}

export default function TokenSettingsDialog({ 
  open, 
  onOpenChange,
  onTokensUpdated
}: TokenSettingsDialogProps) {
  const [githubToken, setGithubToken] = useState("");
  const [openaiToken, setOpenaiToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Load tokens from localStorage on component mount
  useEffect(() => {
    if (open) {
      const storedGithubToken = localStorage.getItem('github_token') || "";
      const storedOpenaiToken = localStorage.getItem('openai_token') || "";
      
      setGithubToken(storedGithubToken);
      setOpenaiToken(storedOpenaiToken);
    }
  }, [open]);
  
  const saveTokens = () => {
    setIsSaving(true);
    
    try {
      // Save tokens to localStorage
      localStorage.setItem('github_token', githubToken);
      
      if (openaiToken) {
        localStorage.setItem('openai_token', openaiToken);
      }
      
      // Notify parent component that tokens have been updated
      onTokensUpdated();
      
      // Close dialog
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving tokens:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API Token Settings</DialogTitle>
          <DialogDescription>
            Enter your API tokens to enable full functionality.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="github-token">GitHub Personal Access Token</Label>
            <Input
              id="github-token"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="Enter your GitHub token"
            />
            <p className="text-xs text-gray-500">
              Required for fetching your repositories.
              Create at: <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">GitHub &gt; Settings &gt; Developer settings &gt; Personal access tokens</a>
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="openai-token">OpenAI API Key</Label>
            <Input
              id="openai-token"
              type="password"
              value={openaiToken}
              onChange={(e) => setOpenaiToken(e.target.value)}
              placeholder="Enter your OpenAI API key (optional)"
            />
            <p className="text-xs text-gray-500">
              Optional. Enables enhanced repository insights.
              Get your API key from: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI API Keys</a>
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button onClick={saveTokens} disabled={isSaving || !githubToken}>
            {isSaving ? "Saving..." : "Save Tokens"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
