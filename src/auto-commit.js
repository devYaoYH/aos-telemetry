/**
 * AOS Auto-Commit - Automatic workspace git commits integrated with telemetry
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class AutoCommit {
  constructor(workspaceDir = '/root/.openclaw/workspace') {
    this.workspaceDir = workspaceDir;
  }

  /**
   * Auto-commit workspace changes before tracking a turn
   */
  commitBeforeTurn(turnId) {
    try {
      // Check if workspace has git
      const hasGit = fs.existsSync(path.join(this.workspaceDir, '.git'));
      if (!hasGit) {
        return { committed: false, reason: 'No git repository' };
      }

      // Stage changes
      execSync('git add -u', { cwd: this.workspaceDir, stdio: 'pipe' });

      // Check if there are changes to commit
      const status = execSync('git status --porcelain', {
        cwd: this.workspaceDir,
        encoding: 'utf8'
      });

      if (!status.trim()) {
        return { committed: false, reason: 'No changes to commit' };
      }

      // Commit with turn ID in message
      const timestamp = new Date().toISOString();
      const message = `AOS auto-commit: ${turnId}\n\nTimestamp: ${timestamp}`;
      
      execSync(`git commit -m "${message}"`, {
        cwd: this.workspaceDir,
        stdio: 'pipe'
      });

      // Get commit hash
      const commitHash = execSync('git rev-parse HEAD', {
        cwd: this.workspaceDir,
        encoding: 'utf8'
      }).trim();

      return {
        committed: true,
        commitHash,
        timestamp,
        changes: status.trim().split('\n').length
      };
    } catch (error) {
      return {
        committed: false,
        reason: error.message,
        error: true
      };
    }
  }

  /**
   * Get current workspace status
   */
  getStatus() {
    try {
      const hasGit = fs.existsSync(path.join(this.workspaceDir, '.git'));
      if (!hasGit) {
        return { hasGit: false };
      }

      const status = execSync('git status --porcelain', {
        cwd: this.workspaceDir,
        encoding: 'utf8'
      }).trim();

      const currentHash = execSync('git rev-parse HEAD', {
        cwd: this.workspaceDir,
        encoding: 'utf8'
      }).trim();

      return {
        hasGit: true,
        clean: !status,
        currentHash,
        uncommittedChanges: status ? status.split('\n').length : 0
      };
    } catch (error) {
      return {
        hasGit: true,
        error: error.message
      };
    }
  }
}

module.exports = { AutoCommit };
