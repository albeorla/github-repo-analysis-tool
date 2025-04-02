import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 60; // Increase timeout to 60 seconds

export async function POST(request: NextRequest) {
  try {
    const { selectedRepositories, analyzeAll = true } = await request.json();
    
    // Get tokens from environment variables
    const githubToken = process.env.GITHUB_TOKEN || '';
    const openaiToken = process.env.OPENAI_API_KEY || '';
    
    if (!openaiToken) {
      return NextResponse.json(
        { success: false, message: 'OpenAI API key is not configured in environment variables' },
        { status: 401 }
      );
    }

    // Fetch repositories data
    let repositories = [];
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

    // Limit the number of repositories to analyze to prevent timeouts
    const MAX_REPOS_TO_ANALYZE = 10;
    let reposToAnalyze = repositories;
    let repoCountMessage = '';
    
    if (repositories.length > MAX_REPOS_TO_ANALYZE) {
      // Sort by most recently updated
      repositories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      reposToAnalyze = repositories.slice(0, MAX_REPOS_TO_ANALYZE);
      repoCountMessage = `Note: Analyzing only the ${MAX_REPOS_TO_ANALYZE} most recently updated repositories out of ${repositories.length} total repositories to prevent timeout.`;
    }

    // Prepare repository data for analysis - only essential data to reduce payload size
    const repoAnalysisData = reposToAnalyze.map(repo => ({
      name: repo.name,
      description: repo.description,
      visibility: repo.visibility,
      createdAt: repo.createdAt,
      updatedAt: repo.updatedAt,
      pushedAt: repo.pushedAt,
      daysSinceLastPush: repo.daysSinceLastPush,
      inactive: repo.inactive,
      isArchived: repo.isArchived,
      primaryLanguage: repo.primaryLanguage
    }));

    // Calculate repository statistics
    const totalRepos = repositories.length;
    const privateRepos = repositories.filter(repo => repo.visibility === 'PRIVATE').length;
    const publicRepos = repositories.filter(repo => repo.visibility === 'PUBLIC').length;
    const archivedRepos = repositories.filter(repo => repo.isArchived).length;
    const inactiveRepos = repositories.filter(repo => repo.inactive).length;
    
    // Count repositories by language (limit to top 5 languages)
    const languageCounts = {};
    repositories.forEach(repo => {
      if (repo.primaryLanguage && repo.primaryLanguage !== 'None') {
        languageCounts[repo.primaryLanguage] = (languageCounts[repo.primaryLanguage] || 0) + 1;
      }
    });
    
    const topLanguages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, count]) => `${lang}: ${count} repositories`);

    // Generate report using OpenAI API with optimized prompt
    try {
      const openai = new OpenAI({
        apiKey: openaiToken,
      });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a GitHub repository analysis expert that provides concise, actionable reports.
            Analyze repository data and provide recommendations on which repositories should be archived, deleted, or maintained.
            Format your response in markdown with clear sections and bullet points.
            Be direct and specific in your recommendations.`
          },
          {
            role: "user",
            content: `Please analyze these GitHub repositories and generate a report with recommendations.
            
            Repository Statistics:
            - Total Repositories: ${totalRepos}
            - Private Repositories: ${privateRepos}
            - Public Repositories: ${publicRepos}
            - Already Archived: ${archivedRepos}
            - Inactive (no pushes in 6+ months): ${inactiveRepos}
            
            Top Languages:
            ${topLanguages.join('\n')}
            
            ${repoCountMessage}
            
            Repository Details:
            ${JSON.stringify(repoAnalysisData, null, 2)}
            
            Please provide:
            1. Executive Summary (2-3 sentences)
            2. Key Recommendations (bullet points)
            3. Repository Analysis by Category:
               - Candidates for Archiving
               - Candidates for Deletion
               - Active Repositories to Maintain
            4. Action Plan (prioritized steps)
            
            Format in markdown with clear headings.`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000 // Reduced token count to prevent timeouts
      });
      
      const reportContent = response.choices[0].message.content;
      
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
          analyzedCount: reposToAnalyze.length,
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
