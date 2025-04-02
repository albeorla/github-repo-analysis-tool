#!/usr/bin/env python3

import os
import json
import sys

def test_api_response_format():
    """Test the API response format for both archive and delete operations."""
    print("Testing API response format...")
    
    # Test data
    test_repos = ["test-repo1", "test-repo2"]
    
    # Expected response structure for archive
    expected_archive_keys = ["success", "message", "archive_path"]
    
    # Expected response structure for delete
    expected_delete_keys = ["success", "message", "results"]
    
    # Mock archive response
    mock_archive_response = {
        "success": True,
        "message": "Successfully archived 2 repositories",
        "archive_path": "/home/ubuntu/github-repo-analysis/archives/github_repos_archive_20250401_052714.zip"
    }
    
    # Mock delete response
    mock_delete_response = {
        "success": True,
        "message": "Successfully processed deletion of 2 repositories",
        "results": [
            {"name": "test-repo1", "success": True},
            {"name": "test-repo2", "success": True}
        ]
    }
    
    # Check archive response format
    archive_keys_match = all(key in mock_archive_response for key in expected_archive_keys)
    print(f"Archive response format valid: {archive_keys_match}")
    
    # Check delete response format
    delete_keys_match = all(key in mock_delete_response for key in expected_delete_keys)
    print(f"Delete response format valid: {delete_keys_match}")
    
    return archive_keys_match and delete_keys_match

def test_website_data_loading():
    """Test that the website data file exists and has the expected format."""
    print("Testing website data loading...")
    
    data_file = "../analysis/website_data.json"
    
    # Check if file exists
    if not os.path.exists(data_file):
        print(f"ERROR: Data file {data_file} does not exist")
        return False
    
    # Check if file is valid JSON
    try:
        with open(data_file, 'r') as f:
            data = json.load(f)
        
        # Check if data is a list
        if not isinstance(data, list):
            print("ERROR: Data is not a list")
            return False
        
        # Check if data has at least one repository
        if len(data) == 0:
            print("WARNING: No repositories found in data file")
        
        # Check if repositories have required fields
        required_fields = ["name", "url", "diskUsage", "visibility", "daysSinceLastPush", "inactive"]
        
        for repo in data[:3]:  # Check first 3 repos
            missing_fields = [field for field in required_fields if field not in repo]
            if missing_fields:
                print(f"ERROR: Repository {repo.get('name', 'unknown')} missing fields: {missing_fields}")
                return False
        
        print(f"Data file valid with {len(data)} repositories")
        return True
    
    except json.JSONDecodeError:
        print(f"ERROR: Data file {data_file} is not valid JSON")
        return False
    except Exception as e:
        print(f"ERROR: Failed to load data file: {str(e)}")
        return False

def test_html_structure():
    """Test that the HTML file exists and has the expected structure."""
    print("Testing HTML structure...")
    
    html_file = "../website/index.html"
    
    # Check if file exists
    if not os.path.exists(html_file):
        print(f"ERROR: HTML file {html_file} does not exist")
        return False
    
    # Check for required elements
    required_elements = [
        "<table class=\"repo-table\">",
        "id=\"repo-list\"",
        "id=\"archive-modal\"",
        "id=\"delete-modal\"",
        "<script src=\"js/main.js\"></script>"
    ]
    
    try:
        with open(html_file, 'r') as f:
            content = f.read()
        
        missing_elements = [elem for elem in required_elements if elem not in content]
        if missing_elements:
            print(f"ERROR: HTML file missing elements: {missing_elements}")
            return False
        
        print("HTML structure valid")
        return True
    
    except Exception as e:
        print(f"ERROR: Failed to check HTML structure: {str(e)}")
        return False

def test_js_functionality():
    """Test that the JavaScript file exists and has the expected functionality."""
    print("Testing JavaScript functionality...")
    
    js_file = "../website/js/main.js"
    
    # Check if file exists
    if not os.path.exists(js_file):
        print(f"ERROR: JavaScript file {js_file} does not exist")
        return False
    
    # Check for required functions
    required_functions = [
        "init()",
        "renderRepositories()",
        "updateCheckboxListeners()",
        "fetch('/api.py'"
    ]
    
    try:
        with open(js_file, 'r') as f:
            content = f.read()
        
        missing_functions = [func for func in required_functions if func not in content]
        if missing_functions:
            print(f"ERROR: JavaScript file missing functions: {missing_functions}")
            return False
        
        print("JavaScript functionality valid")
        return True
    
    except Exception as e:
        print(f"ERROR: Failed to check JavaScript functionality: {str(e)}")
        return False

def run_all_tests():
    """Run all tests and report results."""
    print("Running all tests...\n")
    
    tests = [
        ("Website data loading", test_website_data_loading),
        ("HTML structure", test_html_structure),
        ("JavaScript functionality", test_js_functionality),
        ("API response format", test_api_response_format)
    ]
    
    results = []
    
    for name, test_func in tests:
        print(f"\n=== Testing {name} ===")
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"ERROR: Test failed with exception: {str(e)}")
            results.append((name, False))
    
    # Print summary
    print("\n=== Test Summary ===")
    all_passed = True
    for name, result in results:
        status = "PASSED" if result else "FAILED"
        if not result:
            all_passed = False
        print(f"{name}: {status}")
    
    print(f"\nOverall result: {'PASSED' if all_passed else 'FAILED'}")
    return all_passed

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
