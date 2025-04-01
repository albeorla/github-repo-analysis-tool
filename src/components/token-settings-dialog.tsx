"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TokenSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (githubToken: string, openaiToken: string) => void;
}

export default function TokenSettingsDialog({ isOpen, onClose, onSave }: TokenSettingsDialogProps) {
  const [githubToken, setGithubToken] = useState('');
  const [openaiToken, setOpenaiToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load existing tokens when dialog opens
  useEffect(() => {
    if (isOpen) {
      const savedGithubToken = localStorage.getItem('github_token') || '';
      const savedOpenaiToken = localStorage.getItem('openai_token') || '';
      setGithubToken(savedGithubToken);
      setOpenaiToken(savedOpenaiToken);
    }
  }, [isOpen]);

  const handleSave = () => {
    setIsSaving(true);
    
    // Save tokens to localStorage
    if (githubToken) {
      localStorage.setItem('github_token', githubToken);
    } else {
      localStorage.removeItem('github_token');
    }
    
    if (openaiToken) {
      localStorage.setItem('openai_token', openaiToken);
    } else {
      localStorage.removeItem('openai_token');
    }
    
    setIsSaving(false);
    onSave(githubToken, openaiToken);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>API Token Settings</DialogTitle>
          <DialogDescription>
            Enter your API tokens to enable full functionality.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="github-token" className="text-right">
              GitHub Token
            </Label>
            <Input
              id="github-token"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="github_pat_..."
              className="col-span-3"
            />
          </div>
          <div className="col-span-4 pl-[25%]">
            <p className="text-sm text-gray-500">
              Required for fetching your repositories.
              <br />
              Create at: GitHub &gt; Settings &gt; Developer settings &gt; Personal access tokens
            </p>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4 mt-4">
            <Label htmlFor="openai-token" className="text-right">
              OpenAI API Key
            </Label>
            <Input
              id="openai-token"
              type="password"
              value={openaiToken}
              onChange={(e) => setOpenaiToken(e.target.value)}
              placeholder="sk-..."
              className="col-span-3"
            />
          </div>
          <div className="col-span-4 pl-[25%]">
            <p className="text-sm text-gray-500">
              Optional. Enables enhanced repository insights.
              <br />
              Get your API key from: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenAI API Keys</a>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Tokens"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
