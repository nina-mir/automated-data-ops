import simpleGit from 'simple-git';
// import { resolve } from 'path';

// Initialize git in the project directory
const git = simpleGit(process.cwd());

// Configure remote with token authentication
const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_USERNAME = process.env.GITHUB_USERNAME;
const REPO_NAME = process.env.GITHUB_REPO;
const REPO_URL = `https://${GH_USERNAME}:${GH_TOKEN}@github.com/${GH_USERNAME}/${REPO_NAME}.git`;



export async function robustGitPush(files = [], commitMessage = 'Update files') {
    try {
      // Step 1: Ensure we're in a git repository
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        await git.init();
        await git.addRemote('origin', REPO_URL);
      }
  
      // Step 2: Pull latest changes first (avoid conflicts)
      try {
        await git.pull('origin', 'main');
      } catch (pullError) {
        console.log('Pull failed (might be first push):', pullError.message);
      }
  
      // Step 3: Add specific files or all changes
      if (files.length > 0) {
        await git.add(files);
      } else {
        await git.add('.');
      }
  
      // Step 4: Check for changes
      const status = await git.status();
      if (status.files.length === 0) {
        console.log('No changes to commit');
        return { success: true, message: 'No changes' };
      }
  
      // Step 5: Commit with timestamp
      const timestamp = new Date().toISOString();
      const fullMessage = `${commitMessage} - ${timestamp}`;
      await git.commit(fullMessage);
  
      // Step 6: Push changes
      await git.push('origin', 'main');
  
      return { success: true, message: 'Successfully pushed to GitHub' };
  
    } catch (error) {
      console.error('Git push failed:', error);
      return { success: false, error: error.message };
    }
  }