import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 120; // Increase timeout to 120 seconds for more complex reports

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Destructure with default values to prevent undefined errors
    const { selectedRepositories = [], analyzeAll = true } = requestBody;
    
    // Get tokens from environment variables
    const githubToken = process.env.GITHUB_TOKEN || '';
    const openaiToken = process.env.OPENAI_API_KEY || '';
    
    if (!openaiToken) {
      console.log('OpenAI API key not configured in environment variables');
      return NextResponse.json(
        { success: false, message: 'OpenAI API key is not configured in environment variables' },
        { status: 401 }
      );
    }

    // Fetch repositories data
    let repositories = [];
    try {
      console.log('Fetching repositories from API');
      const repoResponse = await fetch(`${request.nextUrl.origin}/api/repositories`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!repoResponse.ok) {
        throw new Error(`Error fetching repositories: ${repoResponse.status} ${repoResponse.statusText}`);
      }
      
      const repoData = await repoResponse.json();
      
      // Validate repository data
      if (!Array.isArray(repoData)) {
        throw new Error('Repository data is not an array');
      }
      
      repositories = repoData;
      console.log(`Successfully fetched ${repositories.length} repositories`);
      
      // Filter repositories if specific ones are selected
      if (!analyzeAll && Array.isArray(selectedRepositories) && selectedRepositories.length > 0) {
        repositories = repositories.filter(repo => 
          selectedRepositories.includes(repo.name)
        );
        console.log(`Filtered to ${repositories.length} selected repositories`);
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
        { success: false, message: `Error fetching repository data: ${error.message}` },
        { status: 500 }
      );
    }

    // Limit the number of repositories to analyze to prevent timeouts
    const MAX_REPOS_TO_ANALYZE = 5; // Reduced from 10 to 5 for faster processing
    let reposToAnalyze = repositories;
    let repoCountMessage = '';
    
    if (repositories.length > MAX_REPOS_TO_ANALYZE) {
      // Sort by most recently updated
      repositories.sort((a, b) => {
        const dateA = new Date(a.updatedAt || 0).getTime();
        const dateB = new Date(b.updatedAt || 0).getTime();
        return dateB - dateA;
      });
      reposToAnalyze = repositories.slice(0, MAX_REPOS_TO_ANALYZE);
      repoCountMessage = `Note: Analyzing only the ${MAX_REPOS_TO_ANALYZE} most recently updated repositories out of ${repositories.length} total repositories to prevent timeout.`;
      console.log(repoCountMessage);
    }

    // Prepare repository data for analysis - only essential data to reduce payload size
    const repoAnalysisData = reposToAnalyze.map(repo => {
      // Ensure all properties exist with fallbacks to prevent undefined errors
      return {
        name: repo.name || 'Unnamed Repository',
        description: repo.description || 'No description',
        visibility: repo.visibility || 'UNKNOWN',
        createdAt: repo.createdAt || new Date().toISOString(),
        updatedAt: repo.updatedAt || new Date().toISOString(),
        pushedAt: repo.pushedAt || new Date().toISOString(),
        daysSinceLastPush: repo.daysSinceLastPush || 0,
        inactive: repo.inactive || false,
        isArchived: repo.isArchived || false,
        primaryLanguage: repo.primaryLanguage || 'Unknown'
      };
    });

    // Calculate repository statistics with error handling
    try {
      console.log('Calculating repository statistics');
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
        console.log('Initializing OpenAI client');
        const openai = new OpenAI({
          apiKey: openaiToken,
        });
        
        console.log('Sending request to OpenAI API');
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // Fallback to GPT-3.5 which is more reliable for production
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
          max_tokens: 1500 // Further reduced token count to prevent timeouts
        });
        
        if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
          throw new Error('Invalid response from OpenAI API');
        }
        
        const reportContent = response.choices[0].message.content || 'Error: No content generated';
        console.log('Successfully generated report content');
        
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
      } catch (openaiError) {
        console.error('Error generating report with OpenAI:', openaiError);
        // Provide more specific error message based on OpenAI error
        let errorMessage = 'Error generating report';
        if (openaiError.status === 429) {
          errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
        } else if (openaiError.status === 401) {
          errorMessage = 'Invalid OpenAI API key. Please check your API key configuration.';
        } else if (openaiError.status === 500) {
          errorMessage = 'OpenAI API server error. Please try again later.';
        } else {
          errorMessage = `Error generating report: ${openaiError.message || 'Unknown error'}`;
        }
        
        return NextResponse.json(
          { success: false, message: errorMessage },
          { status: openaiError.status || 500 }
        );
      }
    } catch (statsError) {
      console.error('Error calculating repository statistics:', statsError);
      return NextResponse.json(
        { success: false, message: `Error calculating repository statistics: ${statsError.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing report request:', error);
    return NextResponse.json(
      { success: false, message: `Error processing request: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
