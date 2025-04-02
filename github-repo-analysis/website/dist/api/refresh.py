#!/usr/bin/env python3

import os
import sys
import json
import subprocess
import datetime
import cgi
import cgitb

# Enable CGI error reporting
cgitb.enable()

def fetch_repository_data():
    """Fetch repository data using GitHub CLI with personal access token."""
    try:
        # Get the GitHub personal access token from environment
        gh_token = os.environ.get('GH_PAT_TOKEN')
        
        if not gh_token:
            return {
                "success": False,
                "message": "GitHub personal access token not found in environment variables"
            }
        
        # Create a temporary directory for the operation
        temp_dir = "/tmp/github-repo-refresh"
        os.makedirs(temp_dir, exist_ok=True)
        
        # Set up environment with the token
        env = os.environ.copy()
        env['GITHUB_TOKEN'] = gh_token
        
        # Fetch repository data using GitHub CLI
        result = subprocess.run(
            ["gh", "repo", "list", "--limit", "100", "--json", 
             "name,description,url,createdAt,updatedAt,pushedAt,isArchived,diskUsage,visibility,languages,defaultBranchRef",
             "--jq", "."],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        # Parse the JSON output
        repos = json.loads(result.stdout)
        
        # Process the repository data
        now = datetime.datetime.now(datetime.timezone.utc)
        website_data = []
        
        for repo in repos:
            last_push = datetime.datetime.fromisoformat(repo['pushedAt'].replace('Z', '+00:00'))
            days_since_push = (now - last_push).days
            
            # Get primary language
            primary_language = 'None'
            if repo.get('languages') and len(repo['languages']) > 0:
                primary_language = repo['languages'][0].get('node', {}).get('name', 'None')
            
            website_data.append({
                'name': repo['name'],
                'url': repo['url'],
                'description': repo['description'],
                'isArchived': repo['isArchived'],
                'diskUsage': repo['diskUsage'],
                'diskUsageMB': round(repo['diskUsage'] / 1000, 2),
                'visibility': repo['visibility'],
                'createdAt': repo['createdAt'],
                'updatedAt': repo['updatedAt'],
                'pushedAt': repo['pushedAt'],
                'daysSinceLastPush': days_since_push,
                'inactive': days_since_push > 180,
                'primaryLanguage': primary_language
            })
        
        # Save the website data
        with open('website_data.json', 'w') as f:
            json.dump(website_data, f, indent=2)
        
        return {
            "success": True,
            "message": f"Successfully fetched data for {len(repos)} repositories",
            "count": len(repos),
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    
    except subprocess.CalledProcessError as e:
        return {
            "success": False,
            "message": f"Error fetching repository data: {e.stderr}"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }

def main():
    """Main function to handle CGI requests."""
    # Print content type header
    print("Content-Type: application/json")
    print()
    
    # Get form data
    form = cgi.FieldStorage()
    
    # Get action
    action = form.getvalue("action", "")
    
    # Validate input
    if not action:
        result = {
            "success": False,
            "message": "Missing required parameter: action"
        }
        print(json.dumps(result))
        return
    
    # Handle the action
    if action == "refresh":
        result = fetch_repository_data()
    else:
        result = {
            "success": False,
            "message": f"Unknown action: {action}"
        }
    
    # Return the result as JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main()
