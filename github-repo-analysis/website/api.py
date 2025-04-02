#!/usr/bin/env python3

import os
import sys
import json
import cgi
import cgitb
import subprocess

# Enable CGI error reporting
cgitb.enable()

def handle_archive(repo_names):
    """Handle archiving repositories."""
    try:
        # Call the repo_manager.py script to archive repositories
        cmd = ["./repo_manager.py", "archive", ",".join(repo_names)]
        result = subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Parse the JSON output
        response = json.loads(result.stdout)
        return {
            "success": True,
            "message": f"Successfully archived {len(repo_names)} repositories",
            "archive_path": response.get("archive_path", "")
        }
    except subprocess.CalledProcessError as e:
        return {
            "success": False,
            "message": f"Error archiving repositories: {e.stderr}"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }

def handle_delete(repo_names):
    """Handle deleting repositories."""
    try:
        # Call the repo_manager.py script to delete repositories
        cmd = ["./repo_manager.py", "delete", ",".join(repo_names)]
        result = subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Parse the JSON output
        response = json.loads(result.stdout)
        return {
            "success": True,
            "message": f"Successfully processed deletion of {len(repo_names)} repositories",
            "results": response.get("results", [])
        }
    except subprocess.CalledProcessError as e:
        return {
            "success": False,
            "message": f"Error deleting repositories: {e.stderr}"
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
    
    # Get action and repositories
    action = form.getvalue("action", "")
    repos_json = form.getvalue("repositories", "[]")
    
    try:
        repositories = json.loads(repos_json)
    except json.JSONDecodeError:
        repositories = []
    
    # Validate input
    if not action or not repositories:
        result = {
            "success": False,
            "message": "Missing required parameters: action and repositories"
        }
        print(json.dumps(result))
        return
    
    # Handle the action
    if action == "archive":
        result = handle_archive(repositories)
    elif action == "delete":
        result = handle_delete(repositories)
    else:
        result = {
            "success": False,
            "message": f"Unknown action: {action}"
        }
    
    # Return the result as JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main()
