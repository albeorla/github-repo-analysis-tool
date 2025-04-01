import { Repository } from "@/types/repository";

export async function generateRepositoryInsights(repository: Repository): Promise<string> {
  try {
    const response = await fetch('/api/insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repository }),
    });
    
    if (!response.ok) {
      throw new Error(`Error generating insights: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.insights || 'No insights available';
  } catch (error) {
    console.error('Failed to generate repository insights:', error);
    return 'Unable to generate insights at this time.';
  }
}
