#!/usr/bin/env python3

import os
import sys
import json
import shutil
import tempfile
import subprocess
from datetime import datetime

def load_repo_data():
    """Load repository data from the JSON file."""
    with open('../analysis/website_data.json', 'r') as f:
        return json.load(f)

def archive_repositories(repo_names):
    """Archive the specified repositories into a zip file."""
    # Create a timestamp for the archive filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_dir = os.path.join(os.getcwd(), '../archives')
    os.makedirs(archive_dir, exist_ok=True)
    
    # Create a temporary directory for cloning repositories
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"Created temporary directory: {temp_dir}")
        
        # Load repository data to get URLs
        repos = load_repo_data()
        repo_urls = {repo['name']: repo['url'] for repo in repos}
        
        # Clone each repository to the temporary directory
        for repo_name in repo_names:
            if repo_name not in repo_urls:
                print(f"Warning: Repository {repo_name} not found in data")
                continue
                
            repo_url = repo_urls[repo_name]
            repo_dir = os.path.join(temp_dir, repo_name)
            
            print(f"Cloning {repo_name} from {repo_url}...")
            try:
                subprocess.run(
                    ["gh", "repo", "clone", repo_url, repo_dir],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                print(f"Successfully cloned {repo_name}")
                
                # Remove .git directory to save space
                git_dir = os.path.join(repo_dir, '.git')
                if os.path.exists(git_dir):
                    shutil.rmtree(git_dir)
            except subprocess.CalledProcessError as e:
                print(f"Error cloning {repo_name}: {e}")
                print(f"STDERR: {e.stderr.decode()}")
                continue
        
        # Create the archive filename
        archive_name = f"github_repos_archive_{timestamp}"
        archive_path = os.path.join(archive_dir, archive_name)
        
        # Create the zip archive
        print(f"Creating archive {archive_path}.zip...")
        shutil.make_archive(archive_path, 'zip', temp_dir)
        
        print(f"Archive created successfully: {archive_path}.zip")
        return f"{archive_path}.zip"

def delete_repositories(repo_names):
    """Delete the specified repositories."""
    results = []
    
    for repo_name in repo_names:
        print(f"Deleting repository {repo_name}...")
        try:
            # Use GitHub CLI to delete the repository
            result = subprocess.run(
                ["gh", "repo", "delete", repo_name, "--yes"],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            print(f"Successfully deleted {repo_name}")
            results.append({"name": repo_name, "success": True})
        except subprocess.CalledProcessError as e:
            print(f"Error deleting {repo_name}: {e}")
            print(f"STDERR: {e.stderr.decode()}")
            results.append({"name": repo_name, "success": False, "error": e.stderr.decode()})
    
    return results

def main():
    """Main function to handle command line arguments."""
    if len(sys.argv) < 3:
        print("Usage: python repo_manager.py [archive|delete] repo1,repo2,repo3...")
        sys.exit(1)
    
    action = sys.argv[1].lower()
    repo_names = sys.argv[2].split(',')
    
    if not repo_names:
        print("No repositories specified")
        sys.exit(1)
    
    if action == "archive":
        archive_path = archive_repositories(repo_names)
        result = {"success": True, "archive_path": archive_path, "repositories": repo_names}
        print(json.dumps(result))
    elif action == "delete":
        results = delete_repositories(repo_names)
        result = {"success": True, "results": results}
        print(json.dumps(result))
    else:
        print(f"Unknown action: {action}")
        print("Usage: python repo_manager.py [archive|delete] repo1,repo2,repo3...")
        sys.exit(1)

if __name__ == "__main__":
    main()
