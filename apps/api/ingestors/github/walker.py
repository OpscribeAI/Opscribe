import os
import shutil
import tempfile
import asyncio
import subprocess
import logging
from typing import List, Set, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class FileMetadata:
    path: str
    extension: str
    size_bytes: int

@dataclass
class ParseableFileSet:
    tier_1_files: List[FileMetadata]  # High priority (IaC, manifests)
    tier_2_files: List[FileMetadata]  # App code (for semantic parsing)

class RepositoryWalker:
    """Clones a repository and identifies files relevant for architectural discovery."""
    
    def __init__(self, repo_url: str, branch: str = "main", auth_url: Optional[str] = None):
        self.repo_url = repo_url
        self.branch = branch
        self.auth_url = auth_url or repo_url
        
    async def walk(self, temp_dir: str) -> ParseableFileSet:
        await self._clone_repo(temp_dir)
        
        tier_1 = []
        tier_2 = []
        
        for root, dirs, files in os.walk(temp_dir):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', 'venv', 'dist', 'build')]
            
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, temp_dir)
                ext = os.path.splitext(file)[1].lower()
                
                try:
                    size = os.path.getsize(full_path)
                except OSError:
                    continue
                
                meta = FileMetadata(path=rel_path, extension=ext, size_bytes=size)
                
                if self._is_tier_1(rel_path, file, ext):
                    tier_1.append(meta)
                elif self._is_tier_2(rel_path, file, ext):
                    tier_2.append(meta)
                    
        return ParseableFileSet(tier_1_files=tier_1, tier_2_files=tier_2)

    async def _clone_repo(self, dest: str):
        """Clones the repository using git CLI with short-lived token auth."""
        logger.info(f"Cloning {self.repo_url} (branch: {self.branch}) into {dest}")
        
        cmd = ["git", "clone", "--depth", "1", "--branch", self.branch, self.auth_url, dest]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            error_msg = stderr.decode()
            logger.error(f"Git clone failed: {error_msg}")
            raise Exception(f"Failed to clone repository: {error_msg}")

    def _is_tier_1(self, path: str, filename: str, ext: str) -> bool:
        """Identify critical infrastructure and configuration files (Tier 1)."""
        if ext in ('.tf', '.hcl'): return True
        if 'docker-compose' in filename and ext in ('.yml', '.yaml'): return True
        
        if 'k8s' in path or 'kubernetes' in path:
            if ext in ('.yml', '.yaml'): return True
            
        if '.github/workflows' in path and ext in ('.yml', '.yaml'): return True
        
        if filename in ('package.json', 'requirements.txt', 'go.mod', 'Gemfile', 'pom.xml'): return True
        
        if filename.startswith('.env'): return True
        
        return False

    def _is_tier_2(self, path: str, filename: str, ext: str) -> bool:
        """Identify application source code files for semantic analysis (Tier 2)."""
        if ext in ('.py', '.js', '.ts', '.tsx', '.go', '.java', '.rb', '.php'):
            if 'test' in filename.lower() or 'spec' in filename.lower():
                return False
            return True
        return False
