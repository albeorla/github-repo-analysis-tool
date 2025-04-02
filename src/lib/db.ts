"use client";

// IndexedDB utility for repository data and insights storage
export class RepositoryDatabase {
  private db: IDBDatabase | null = null;
  private dbName = 'github-repo-analysis';
  private version = 1;

  // Initialize the database
  async init(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = (event) => {
        console.error('Error opening IndexedDB:', event);
        reject(false);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log('IndexedDB opened successfully');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create repositories store
        if (!db.objectStoreNames.contains('repositories')) {
          const repoStore = db.createObjectStore('repositories', { keyPath: 'name' });
          repoStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          repoStore.createIndex('visibility', 'visibility', { unique: false });
        }
        
        // Create insights store
        if (!db.objectStoreNames.contains('insights')) {
          const insightsStore = db.createObjectStore('insights', { keyPath: 'repoName' });
          insightsStore.createIndex('generatedAt', 'generatedAt', { unique: false });
        }
        
        // Create metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  // Store repository data
  async storeRepositories(repositories: any[]): Promise<boolean> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(false);
        return;
      }

      const transaction = this.db.transaction('repositories', 'readwrite');
      const store = transaction.objectStore('repositories');
      
      // Store last updated timestamp
      const metadataTransaction = this.db.transaction('metadata', 'readwrite');
      const metadataStore = metadataTransaction.objectStore('metadata');
      metadataStore.put({ key: 'lastRepoUpdate', value: new Date().toISOString() });

      let count = 0;
      repositories.forEach(repo => {
        const request = store.put(repo);
        request.onsuccess = () => {
          count++;
          if (count === repositories.length) {
            resolve(true);
          }
        };
        request.onerror = () => {
          reject(false);
        };
      });

      transaction.oncomplete = () => {
        console.log('All repositories stored successfully');
      };

      transaction.onerror = (event) => {
        console.error('Error storing repositories:', event);
        reject(false);
      };
    });
  }

  // Get all repositories
  async getRepositories(): Promise<any[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject([]);
        return;
      }

      const transaction = this.db.transaction('repositories', 'readonly');
      const store = transaction.objectStore('repositories');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = (event) => {
        console.error('Error getting repositories:', event);
        reject([]);
      };
    });
  }

  // Get repository by name
  async getRepository(name: string): Promise<any | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(null);
        return;
      }

      const transaction = this.db.transaction('repositories', 'readonly');
      const store = transaction.objectStore('repositories');
      const request = store.get(name);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = (event) => {
        console.error(`Error getting repository ${name}:`, event);
        reject(null);
      };
    });
  }

  // Store repository insights
  async storeInsight(repoName: string, insight: string): Promise<boolean> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(false);
        return;
      }

      const transaction = this.db.transaction('insights', 'readwrite');
      const store = transaction.objectStore('insights');
      
      const insightData = {
        repoName,
        insight,
        generatedAt: new Date().toISOString()
      };
      
      const request = store.put(insightData);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (event) => {
        console.error(`Error storing insight for ${repoName}:`, event);
        reject(false);
      };
    });
  }

  // Get repository insight
  async getInsight(repoName: string): Promise<{ insight: string, generatedAt: string } | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(null);
        return;
      }

      const transaction = this.db.transaction('insights', 'readonly');
      const store = transaction.objectStore('insights');
      const request = store.get(repoName);

      request.onsuccess = () => {
        if (request.result) {
          resolve({
            insight: request.result.insight,
            generatedAt: request.result.generatedAt
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = (event) => {
        console.error(`Error getting insight for ${repoName}:`, event);
        reject(null);
      };
    });
  }

  // Check if insight is expired (older than 7 days)
  isInsightExpired(generatedAt: string): boolean {
    const generatedDate = new Date(generatedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - generatedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 7; // Expire after 7 days
  }

  // Check if data is expired (older than 1 day)
  isDataExpired(): boolean {
    return this.isLastUpdateOlderThan(1);
  }

  // Check if last update is older than specified days
  async isLastUpdateOlderThan(days: number): Promise<boolean> {
    const lastUpdate = await this.getLastRepoUpdateTime();
    if (!lastUpdate) return true;
    
    const lastUpdateDate = new Date(lastUpdate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastUpdateDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > days;
  }

  // Get last repository update time
  async getLastRepoUpdateTime(): Promise<string | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(null);
        return;
      }

      const transaction = this.db.transaction('metadata', 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get('lastRepoUpdate');

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.value);
        } else {
          resolve(null);
        }
      };

      request.onerror = (event) => {
        console.error('Error getting last repo update time:', event);
        reject(null);
      };
    });
  }

  // Clear all data (for testing or reset)
  async clearAll(): Promise<boolean> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(false);
        return;
      }

      const transaction = this.db.transaction(['repositories', 'insights', 'metadata'], 'readwrite');
      const repoStore = transaction.objectStore('repositories');
      const insightsStore = transaction.objectStore('insights');
      const metadataStore = transaction.objectStore('metadata');

      repoStore.clear();
      insightsStore.clear();
      metadataStore.clear();

      transaction.oncomplete = () => {
        console.log('All data cleared successfully');
        resolve(true);
      };

      transaction.onerror = (event) => {
        console.error('Error clearing data:', event);
        reject(false);
      };
    });
  }
}

// Create a singleton instance
let dbInstance: RepositoryDatabase | null = null;

export function getRepositoryDatabase(): RepositoryDatabase {
  if (!dbInstance) {
    dbInstance = new RepositoryDatabase();
  }
  return dbInstance;
}
