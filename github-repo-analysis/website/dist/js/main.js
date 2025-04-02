// Main JavaScript for GitHub Repository Manager

// Global variables
let repositories = [];
let selectedRepos = new Set();
let languages = new Set();

// DOM Elements
const repoList = document.getElementById('repo-list');
const searchInput = document.getElementById('search');
const visibilityFilter = document.getElementById('visibility-filter');
const activityFilter = document.getElementById('activity-filter');
const languageFilter = document.getElementById('language-filter');
const selectAllCheckbox = document.getElementById('select-all');
const selectAllBtn = document.getElementById('select-all-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const archiveBtn = document.getElementById('archive-btn');
const deleteBtn = document.getElementById('delete-btn');
const archiveModal = document.getElementById('archive-modal');
const deleteModal = document.getElementById('delete-modal');
const archiveList = document.getElementById('archive-list');
const deleteList = document.getElementById('delete-list');
const confirmArchiveBtn = document.getElementById('confirm-archive');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const cancelArchiveBtn = document.getElementById('cancel-archive');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const loadingIndicator = document.querySelector('.loading');

// Summary elements
const totalReposEl = document.getElementById('total-repos');
const privateReposEl = document.getElementById('private-repos');
const publicReposEl = document.getElementById('public-repos');
const archivedReposEl = document.getElementById('archived-repos');
const inactiveReposEl = document.getElementById('inactive-repos');
const totalSizeEl = document.getElementById('total-size');

// Close buttons for modals
const closeButtons = document.querySelectorAll('.close');

// Initialize the application
async function init() {
    try {
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        
        // Fetch repository data
        const response = await fetch('website_data.json');
        repositories = await response.json();
        
        // Hide loading indicator
        loadingIndicator.style.display = 'none';
        
        // Extract unique languages
        repositories.forEach(repo => {
            if (repo.primaryLanguage && repo.primaryLanguage !== 'None') {
                languages.add(repo.primaryLanguage);
            }
        });
        
        // Populate language filter
        populateLanguageFilter();
        
        // Update summary statistics
        updateSummary();
        
        // Render repositories
        renderRepositories();
        
        // Add event listeners
        addEventListeners();
    } catch (error) {
        console.error('Error initializing application:', error);
        loadingIndicator.style.display = 'none';
        alert('Failed to load repository data. Please try again later.');
    }
}

// Function to refresh repository data using the API
async function refreshRepositoryData() {
    try {
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        
        // Call the refresh API
        const response = await fetch('api/refresh.py', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'action': 'refresh'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Repository data refreshed successfully!\n${data.message}\nTimestamp: ${data.timestamp}`);
            
            // Reload the page to get the updated data
            window.location.reload();
        } else {
            alert(`Error refreshing repository data: ${data.message}`);
        }
    } catch (error) {
        console.error('Error refreshing repository data:', error);
        alert(`Error refreshing repository data: ${error.message}`);
    } finally {
        // Hide loading indicator
        loadingIndicator.style.display = 'none';
    }
}

// Populate language filter dropdown
function populateLanguageFilter() {
    const sortedLanguages = Array.from(languages).sort();
    
    sortedLanguages.forEach(language => {
        const option = document.createElement('option');
        option.value = language;
        option.textContent = language;
        languageFilter.appendChild(option);
    });
}

// Update summary statistics
function updateSummary() {
    const totalRepos = repositories.length;
    const privateRepos = repositories.filter(repo => repo.visibility === 'PRIVATE').length;
    const publicRepos = repositories.filter(repo => repo.visibility === 'PUBLIC').length;
    const archivedRepos = repositories.filter(repo => repo.isArchived).length;
    const inactiveRepos = repositories.filter(repo => repo.inactive).length;
    const totalSize = repositories.reduce((sum, repo) => sum + repo.diskUsageMB, 0).toFixed(2);
    
    totalReposEl.textContent = totalRepos;
    privateReposEl.textContent = privateRepos;
    publicReposEl.textContent = publicRepos;
    archivedReposEl.textContent = archivedRepos;
    inactiveReposEl.textContent = inactiveRepos;
    totalSizeEl.textContent = `${totalSize} MB`;
}

// Render repositories based on current filters
function renderRepositories() {
    // Clear the repository list
    repoList.innerHTML = '';
    
    // Get filter values
    const searchTerm = searchInput.value.toLowerCase();
    const visibilityValue = visibilityFilter.value;
    const activityValue = activityFilter.value;
    const languageValue = languageFilter.value;
    
    // Filter repositories
    const filteredRepos = repositories.filter(repo => {
        // Search filter
        const matchesSearch = 
            repo.name.toLowerCase().includes(searchTerm) || 
            (repo.description && repo.description.toLowerCase().includes(searchTerm));
        
        // Visibility filter
        const matchesVisibility = 
            visibilityValue === 'all' || 
            repo.visibility === visibilityValue;
        
        // Activity filter
        const matchesActivity = 
            activityValue === 'all' || 
            (activityValue === 'active' && !repo.inactive) || 
            (activityValue === 'inactive' && repo.inactive);
        
        // Language filter
        const matchesLanguage = 
            languageValue === 'all' || 
            repo.primaryLanguage === languageValue;
        
        return matchesSearch && matchesVisibility && matchesActivity && matchesLanguage;
    });
    
    // Render each repository
    filteredRepos.forEach(repo => {
        const row = document.createElement('tr');
        
        // Format date
        const pushDate = new Date(repo.pushedAt);
        const formattedDate = pushDate.toLocaleDateString();
        
        // Create status badge
        let statusBadge = '';
        if (repo.isArchived) {
            statusBadge = '<span class="badge badge-archived">Archived</span>';
        } else if (repo.inactive) {
            statusBadge = '<span class="badge badge-inactive">Inactive</span>';
        } else if (repo.visibility === 'PRIVATE') {
            statusBadge = '<span class="badge badge-private">Private</span>';
        } else {
            statusBadge = '<span class="badge badge-public">Public</span>';
        }
        
        // Set row HTML
        row.innerHTML = `
            <td>
                <div class="checkbox-container">
                    <input type="checkbox" class="repo-checkbox" data-repo-name="${repo.name}" ${selectedRepos.has(repo.name) ? 'checked' : ''}>
                </div>
            </td>
            <td><a href="${repo.url}" target="_blank">${repo.name}</a></td>
            <td>${repo.description || ''}</td>
            <td>${statusBadge}</td>
            <td>${formattedDate} (${repo.daysSinceLastPush} days ago)</td>
            <td>${repo.diskUsageMB} MB</td>
            <td>${repo.primaryLanguage}</td>
        `;
        
        repoList.appendChild(row);
    });
    
    // Update checkbox event listeners
    updateCheckboxListeners();
}

// Update checkbox event listeners
function updateCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.repo-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const repoName = this.getAttribute('data-repo-name');
            
            if (this.checked) {
                selectedRepos.add(repoName);
            } else {
                selectedRepos.delete(repoName);
            }
            
            // Update select all checkbox
            updateSelectAllCheckbox();
        });
    });
}

// Update select all checkbox state
function updateSelectAllCheckbox() {
    const checkboxes = document.querySelectorAll('.repo-checkbox');
    const checkedCount = document.querySelectorAll('.repo-checkbox:checked').length;
    
    selectAllCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

// Add event listeners
function addEventListeners() {
    // Set default filter values to ensure all repositories are shown
    searchInput.value = '';
    visibilityFilter.value = 'all';
    activityFilter.value = 'all';
    languageFilter.value = 'all';
    
    // Filter change events
    searchInput.addEventListener('input', renderRepositories);
    visibilityFilter.addEventListener('change', renderRepositories);
    activityFilter.addEventListener('change', renderRepositories);
    languageFilter.addEventListener('change', renderRepositories);
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshRepositoryData);
    }
    
    // Select all checkbox
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.repo-checkbox');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
            const repoName = checkbox.getAttribute('data-repo-name');
            
            if (this.checked) {
                selectedRepos.add(repoName);
            } else {
                selectedRepos.delete(repoName);
            }
        });
    });
    
    // Select all button
    selectAllBtn.addEventListener('click', function() {
        const checkboxes = document.querySelectorAll('.repo-checkbox');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            const repoName = checkbox.getAttribute('data-repo-name');
            selectedRepos.add(repoName);
        });
        
        updateSelectAllCheckbox();
    });
    
    // Deselect all button
    deselectAllBtn.addEventListener('click', function() {
        const checkboxes = document.querySelectorAll('.repo-checkbox');
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            const repoName = checkbox.getAttribute('data-repo-name');
            selectedRepos.delete(repoName);
        });
        
        updateSelectAllCheckbox();
    });
    
    // Archive button
    archiveBtn.addEventListener('click', function() {
        if (selectedRepos.size === 0) {
            alert('Please select at least one repository to archive.');
            return;
        }
        
        // Populate archive list
        archiveList.innerHTML = '';
        selectedRepos.forEach(repoName => {
            const li = document.createElement('li');
            li.textContent = repoName;
            archiveList.appendChild(li);
        });
        
        // Show archive modal
        archiveModal.style.display = 'block';
    });
    
    // Delete button
    deleteBtn.addEventListener('click', function() {
        if (selectedRepos.size === 0) {
            alert('Please select at least one repository to delete.');
            return;
        }
        
        // Populate delete list
        deleteList.innerHTML = '';
        selectedRepos.forEach(repoName => {
            const li = document.createElement('li');
            li.textContent = repoName;
            deleteList.appendChild(li);
        });
        
        // Show delete modal
        deleteModal.style.display = 'block';
    });
    
    // Confirm archive button
    confirmArchiveBtn.addEventListener('click', function() {
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        
        // Close modal
        archiveModal.style.display = 'none';
        
        // Prepare data for archive operation
        const reposToArchive = Array.from(selectedRepos);
        
        // Call the API to archive repositories
        fetch('/api.py', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'action': 'archive',
                'repositories': JSON.stringify(reposToArchive)
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Archive response:', data);
            
            if (data.success) {
                alert(`Successfully archived ${reposToArchive.length} repositories.\nArchive saved to: ${data.archive_path}`);
                
                // Clear selection
                selectedRepos.clear();
                
                // Re-render repositories
                renderRepositories();
            } else {
                alert(`Error archiving repositories: ${data.message}`);
            }
        })
        .catch(error => {
            console.error('Error archiving repositories:', error);
            alert(`Error archiving repositories: ${error.message}`);
        })
        .finally(() => {
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
        });
    });
    
    // Confirm delete button
    confirmDeleteBtn.addEventListener('click', function() {
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        
        // Close modal
        deleteModal.style.display = 'none';
        
        // Prepare data for delete operation
        const reposToDelete = Array.from(selectedRepos);
        
        // Call the API to delete repositories
        fetch('/api.py', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'action': 'delete',
                'repositories': JSON.stringify(reposToDelete)
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Delete response:', data);
            
            if (data.success) {
                // Count successful deletions
                const successCount = data.results ? data.results.filter(r => r.success).length : 0;
                const failCount = reposToDelete.length - successCount;
                
                if (failCount > 0) {
                    alert(`Partially completed: Successfully deleted ${successCount} repositories, but failed to delete ${failCount} repositories.`);
                } else {
                    alert(`Successfully deleted ${successCount} repositories.`);
                }
                
                // Clear selection
                selectedRepos.clear();
                
                // Refresh repository data and re-render
                init();
            } else {
                alert(`Error deleting repositories: ${data.message}`);
            }
        })
        .catch(error => {
            console.error('Error deleting repositories:', error);
            alert(`Error deleting repositories: ${error.message}`);
        })
        .finally(() => {
            // Hide loading indicator
            loadingIndicator.style.display = 'none';
        });
    });
    
    // Cancel buttons
    cancelArchiveBtn.addEventListener('click', function() {
        archiveModal.style.display = 'none';
    });
    
    cancelDeleteBtn.addEventListener('click', function() {
        deleteModal.style.display = 'none';
    });
    
    // Close buttons
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            archiveModal.style.display = 'none';
            deleteModal.style.display = 'none';
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === archiveModal) {
            archiveModal.style.display = 'none';
        }
        if (event.target === deleteModal) {
            deleteModal.style.display = 'none';
        }
    });
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
