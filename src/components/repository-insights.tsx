"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getRepositoryDatabase } from "@/lib/db";

interface RepositoryInsightsProps {
  repositoryName: string;
  repositoryUrl: string;
  repositoryDescription: string;
  primaryLanguage: string;
  createdAt: string;
  updatedAt: string;
}

export default function RepositoryInsights({
  repositoryName,
  repositoryUrl,
  repositoryDescription,
  primaryLanguage,
  createdAt,
  updatedAt
}: RepositoryInsightsProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const db = getRepositoryDatabase();

  // Load insights from IndexedDB on component mount
  useEffect(() => {
    const loadInsight = async () => {
      try {
        await db.init();
        const cachedInsight = await db.getInsight(repositoryName);
        
        if (cachedInsight) {
          setInsight(cachedInsight.insight);
          setLastGenerated(new Date(cachedInsight.generatedAt).toLocaleString());
          
          // Check if insight is expired
          if (db.isInsightExpired(cachedInsight.generatedAt)) {
            // If expired, generate new insight in background
            generateInsight(true);
          }
        } else {
          // No cached insight, generate new one
          generateInsight();
        }
      } catch (err) {
        console.error("Error loading insight from IndexedDB:", err);
        setError("Failed to load insights from cache");
      }
    };
    
    loadInsight();
  }, [repositoryName]);

  // Generate new insight using OpenAI API
  const generateInsight = async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
      setError(null);
    }
    
    const openaiToken = localStorage.getItem('openai_token');
    
    if (!openaiToken) {
      if (!isBackground) {
        setError("OpenAI API key not found. Please set your API key in settings.");
        setIsLoading(false);
      }
      return;
    }
    
    try {
      // Prepare repository data for the prompt
      const repoData = {
        name: repositoryName,
        description: repositoryDescription,
        url: repositoryUrl,
        language: primaryLanguage,
        createdAt: new Date(createdAt).toLocaleDateString(),
        updatedAt: new Date(updatedAt).toLocaleDateString()
      };
      
      // Call OpenAI API directly from client
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiToken}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a GitHub repository analyzer that provides insightful analysis and recommendations. Your analysis should be concise but comprehensive."
            },
            {
              role: "user",
              content: `Analyze this GitHub repository and provide insights:\n\nRepository: ${repoData.name}\nDescription: ${repoData.description}\nPrimary Language: ${repoData.language}\nCreated: ${repoData.createdAt}\nLast Updated: ${repoData.updatedAt}\n\nPlease provide:\n1. A brief assessment of the repository's purpose and potential value\n2. Maintenance recommendations based on activity patterns\n3. Suggestions for improvements or best practices\n4. Any potential concerns or issues to address`
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      const generatedInsight = data.choices[0].message.content;
      
      // Store in IndexedDB
      await db.storeInsight(repositoryName, generatedInsight);
      
      // Update state if not a background refresh
      if (!isBackground) {
        setInsight(generatedInsight);
        setLastGenerated(new Date().toLocaleString());
      } else if (isBackground && !insight) {
        // If it was a background refresh but we don't have any insight displayed yet, show this one
        setInsight(generatedInsight);
        setLastGenerated(new Date().toLocaleString());
      }
    } catch (err) {
      console.error("Error generating insight:", err);
      if (!isBackground) {
        setError("Failed to generate insights. Please check your OpenAI API key and try again.");
      }
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Repository Insights</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => generateInsight()}
            disabled={isLoading}
          >
            {isLoading ? "Generating..." : "Refresh Insights"}
          </Button>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {isLoading && !insight ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : insight ? (
          <div>
            <div className="prose max-w-none">
              {insight.split('\n').map((paragraph, index) => (
                <p key={index} className={paragraph.startsWith('•') ? 'ml-4' : ''}>
                  {paragraph}
                </p>
              ))}
            </div>
            {lastGenerated && (
              <div className="text-xs text-gray-500 mt-4">
                Last generated: {lastGenerated}
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-500 italic">
            No insights available. Click "Refresh Insights" to generate.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
