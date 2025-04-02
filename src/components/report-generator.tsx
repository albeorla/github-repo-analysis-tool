"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Repository } from "@/types/repository";

interface ReportGeneratorProps {
  repositories: Repository[];
  selectedRepos: Set<string>;
}

export default function ReportGenerator({ repositories, selectedRepos }: ReportGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzeAll, setAnalyzeAll] = useState(true);

  const generateReport = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const githubToken = localStorage.getItem('github_token');
      const openaiToken = localStorage.getItem('openai_token');
      
      if (!openaiToken) {
        setError("OpenAI API key is required for generating reports. Please set your API key in settings.");
        setIsGenerating(false);
        return;
      }
      
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-token': githubToken || '',
          'x-openai-token': openaiToken || ''
        },
        body: JSON.stringify({
          selectedRepositories: Array.from(selectedRepos),
          analyzeAll: analyzeAll
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setReport(result.report);
    } catch (error) {
      console.error('Failed to generate report:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `github-repository-analysis-report-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Repository Analysis Report</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox 
              id="analyze-all" 
              checked={analyzeAll} 
              onCheckedChange={(checked) => setAnalyzeAll(checked as boolean)}
            />
            <label 
              htmlFor="analyze-all" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Analyze all repositories
            </label>
          </div>
          
          {!analyzeAll && selectedRepos.size === 0 && (
            <div className="text-amber-600 mb-4">
              Please select repositories to analyze or enable "Analyze all repositories"
            </div>
          )}
          
          <Button 
            onClick={generateReport} 
            disabled={isGenerating || (!analyzeAll && selectedRepos.size === 0)}
            className="mr-2"
          >
            {isGenerating ? "Generating..." : "Generate Report"}
          </Button>
          
          {report && (
            <Button 
              variant="outline" 
              onClick={downloadReport}
            >
              Download Report
            </Button>
          )}
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {isGenerating && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Generating comprehensive repository analysis...</p>
            <p className="text-gray-500 text-sm mt-2">This may take a minute or two as we analyze your repositories and generate recommendations.</p>
          </div>
        )}
        
        {report && !isGenerating && (
          <div className="border rounded-md p-4 mt-4">
            <div className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(report) }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Simple markdown to HTML converter
function convertMarkdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Convert bold and italic
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  
  // Convert lists
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<ol><li>$1</li></ol>');
  html = html.replace(/^\s*\-\s+(.*$)/gim, '<ul><li>$1</li></ul>');
  
  // Fix duplicate list tags
  html = html.replace(/<\/ol><ol>/gim, '');
  html = html.replace(/<\/ul><ul>/gim, '');
  
  // Convert paragraphs
  html = html.replace(/^([^<].*)\n$/gim, '<p>$1</p>');
  
  // Convert line breaks
  html = html.replace(/\n/gim, '<br>');
  
  return html;
}
