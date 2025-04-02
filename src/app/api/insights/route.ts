import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { repositoryName, repositoryUrl, repositoryDescription, primaryLanguage, createdAt, updatedAt } = await request.json();
    
    // Get OpenAI API key from environment variable instead of request header
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { success: false, message: 'OpenAI API key is not configured in environment variables' },
        { status: 401 }
      );
    }
    
    // Initialize OpenAI API with updated syntax
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });
    
    // Generate insights using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a GitHub repository analysis expert that provides insights and recommendations. Your task is to analyze repository information and provide actionable insights."
        },
        {
          role: "user",
          content: `Please analyze this GitHub repository and provide insights:
          
          Repository Name: ${repositoryName}
          Repository URL: ${repositoryUrl}
          Description: ${repositoryDescription || 'No description provided'}
          Primary Language: ${primaryLanguage || 'Unknown'}
          Created: ${new Date(createdAt).toLocaleDateString()}
          Last Updated: ${new Date(updatedAt).toLocaleDateString()}
          
          Please provide:
          1. A brief summary of what this repository appears to be
          2. Potential improvements that could be made
          3. Maintenance recommendations
          4. Any security concerns based on the repository type and language
          
          Format your response in markdown with clear headings and bullet points.`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    const insights = response.choices[0].message.content;
    
    return NextResponse.json({
      success: true,
      insights
    });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      { success: false, message: `Error generating insights: ${error}` },
      { status: 500 }
    );
  }
}
