import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Create archives directory if it doesn't exist
const ARCHIVES_DIR = path.join(process.cwd(), 'archives');
if (!fs.existsSync(ARCHIVES_DIR)) {
  fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const { repositories } = await request.json();
    
    if (!repositories || !Array.isArray(repositories) || repositories.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No repositories specified' },
        { status: 400 }
      );
    }

    // Create a timestamp for the archive filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `github_repos_archive_${timestamp}`;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-repos-'));
    
    // Get GitHub token from request headers or localStorage
    const githubToken = request.headers.get('x-github-token') || '';
    
    if (!githubToken) {
      return NextResponse.json(
        { success: false, message: 'GitHub token is required' },
        { status: 401 }
      );
    }

    // Clone each repository to the temporary directory
    const cloneResults = [];
    for (const repo of repositories) {
      const repoName = typeof repo === 'string' ? repo : repo.name;
      
      try {
        // Clone the repository using git command
        await execAsync(`git clone https://${githubToken}@github.com/${repoName}.git ${path.join(tempDir, repoName)}`);
        
        // Remove .git directory to save space
        const gitDir = path.join(tempDir, repoName, '.git');
        if (fs.existsSync(gitDir)) {
          fs.rmSync(gitDir, { recursive: true, force: true });
        }
        
        cloneResults.push({ name: repoName, success: true });
      } catch (error) {
        console.error(`Error cloning ${repoName}:`, error);
        cloneResults.push({ name: repoName, success: false, error: String(error) });
      }
    }

    // Create the archive
    const archivePath = path.join(ARCHIVES_DIR, archiveName);
    
    // Create a zip archive using the system's zip command
    try {
      await execAsync(`cd ${tempDir} && zip -r ${archivePath}.zip .`);
      
      // Clean up the temporary directory
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return NextResponse.json({
        success: true,
        message: `Successfully archived ${repositories.length} repositories`,
        archivePath: `${archivePath}.zip`,
        results: cloneResults
      });
    } catch (error) {
      console.error('Error creating archive:', error);
      
      // Clean up the temporary directory
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return NextResponse.json(
        { success: false, message: `Error creating archive: ${error}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing archive request:', error);
    return NextResponse.json(
      { success: false, message: `Error processing request: ${error}` },
      { status: 500 }
    );
  }
}
