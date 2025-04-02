import { NextRequest, NextResponse } from 'next/server';
import { Repository } from '@/types/repository';

interface ReportOptions {
  selectedRepositories?: string[];
  analyzeAll?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { selectedRepositories, analyzeAll = true } = await request.json() as ReportOptions;
    
    // Get GitHub token from request headers
    const githubToken = request.headers.get('x-github-token') || '';
    const openaiToken = request.headers.get('x-openai-token') || '';
    
    if (!openaiToken) {
      return NextResponse.json(
        { success: false, message: 'OpenAI API key is required for generating reports' },
        { status: 401 }
      );
    }

    // Fetch repositories data
    let repositories: Repository[] = [];
    try {
      const repoResponse = await fetch(`${request.nextUrl.origin}/api/repositories`, {
        headers: {
          'x-github-token': githubToken
        }
      });
      
      if (!repoResponse.ok) {
        throw new Error(`Error fetching repositories: ${repoResponse.statusText}`);
      }
      
      repositories = await repoResponse.json();
      
      // Filter repositories if specific ones are selected
      if (!analyzeAll && selectedRepositories && selectedRepositories.length > 0) {
        repositories = repositories.filter(repo => 
          selectedRepositories.includes(repo.name)
        );
      }
      
      if (repositories.length === 0) {
        return NextResponse.json(
          { success: false, message: 'No repositories found to analyze' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Error fetching repository data:', error);
      return NextResponse.json(
        { success: false, message: `Error fetching repository data: ${error}` },
        { status: 500 }
      );
    }

    // Prepare repository data for analysis
    const repoAnalysisData = repositories.map(repo => ({
      name: repo.name,
      description: repo.description,
      url: repo.url,
      isArchived: repo.isArchived,
      visibility: repo.visibility,
      createdAt: repo.createdAt,
      updatedAt: repo.updatedAt,
      pushedAt: repo.pushedAt,
      daysSinceLastPush: repo.daysSinceLastPush,
      inactive: repo.inactive,
      diskUsageMB: repo.diskUsageMB,
      primaryLanguage: repo.primaryLanguage
    }));

    // Calculate repository statistics
    const totalRepos = repositories.length;
    const privateRepos = repositories.filter(repo => repo.visibility === 'PRIVATE').length;
    const publicRepos = repositories.filter(repo => repo.visibility === 'PUBLIC').length;
    const archivedRepos = repositories.filter(repo => repo.isArchived).length;
    const inactiveRepos = repositories.filter(repo => repo.inactive).length;
    const totalSizeMB = repositories.reduce((sum, repo) => sum + repo.diskUsageMB, 0);
    
    // Count repositories by language
    const languages: Record<string, number> = {};
    repositories.forEach(repo => {
      if (repo.primaryLanguage && repo.primaryLanguage !== 'None') {
        languages[repo.primaryLanguage] = (languages[repo.primaryLanguage] || 0) + 1;
      }
    });

    // Generate report using OpenAI API
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiToken}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a GitHub repository analysis expert that provides detailed reports and recommendations. 
              Your task is to analyze repository data and provide actionable insights on how repositories should be managed.
              Format your response in markdown with clear sections, headings, and bullet points.
              Focus on identifying repositories that should be archived, deleted, or maintained based on activity, size, and purpose.
              Look for consolidation opportunities where similar repositories could be merged.
              Provide specific, actionable recommendations for each repository.`
            },
            {
              role: "user",
              content: `Please analyze the following GitHub repositories and generate a detailed report with recommendations.
              
              Repository Statistics:
              - Total Repositories: ${totalRepos}
              - Private Repositories: ${privateRepos}
              - Public Repositories: ${publicRepos}
              - Already Archived Repositories: ${archivedRepos}
              - Inactive Repositories (no pushes in last 6 months): ${inactiveRepos}
              - Total Size: ${totalSizeMB.toFixed(2)} MB
              
              Languages Used:
              ${Object.entries(languages).map(([lang, count]) => `- ${lang}: ${count} repositories`).join('\n')}
              
              Repository Details:
              ${JSON.stringify(repoAnalysisData, null, 2)}
              
              Please provide:
              1. Executive Summary
              2. Repository Analysis (categorized by activity, importance, and maintenance needs)
              3. Specific Recommendations for each repository (archive, delete, maintain, consolidate)
              4. Action Plan with prioritized steps
              
              Format the report in markdown with clear headings and sections.`
            }
          ],
          temperature: 0.7,
          max_tokens: 4000
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      const reportContent = data.choices[0].message.content;
      
      // Add report metadata
      const reportDate = new Date().toISOString();
      const reportTitle = `# GitHub Repository Analysis Report\n\n*Generated on: ${new Date().toLocaleString()}*\n\n`;
      const finalReport = reportTitle + reportContent;
      
      return NextResponse.json({
        success: true,
        report: finalReport,
        metadata: {
          generatedAt: reportDate,
          repositoryCount: totalRepos,
          inactiveCount: inactiveRepos
        }
      });
    } catch (error) {
      console.error('Error generating report with OpenAI:', error);
      return NextResponse.json(
        { success: false, message: `Error generating report: ${error}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing report request:', error);
    return NextResponse.json(
      { success: false, message: `Error processing request: ${error}` },
      { status: 500 }
    );
  }
}
