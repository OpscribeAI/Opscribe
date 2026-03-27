import os
import asyncio
import subprocess
import logging
import tempfile
from time import time
from typing import List, Optional
from urllib.parse import urlparse

from apps.api.ingestors.github.walker import RepositoryWalker
from apps.api.ingestors.github.deterministic import IaCParser, DependencyParser
from apps.api.ingestors.github.aggregator import SignalAggregator
from apps.api.ingestors.github.models import InfrastructureSignal, DiscoveryResult, DiscoveryNode
from apps.api.ingestors.github.validator import GraphValidator

logger = logging.getLogger(__name__)

COMPONENT_TO_NODE_TYPE = {
    "Compute": "compute",
    "Database": "database",
    "Cache": "cache",
    "Queue": "queue",
    "Storage": "storage",
    "API": "api",
    "Worker": "compute",
    "Cloud-Service": "api",
}

class GitHubIngestionPipeline:
    """
    Orchestrates the discovery process for a GitHub repository.
    Handles cloning, multi-tier parsing (deterministic + semantic), 
    and result aggregation.
    """
    
    def __init__(
        self, 
        repo_url: str, 
        branch: str = "main", 
        access_token: Optional[str] = None,
        use_semantic: bool = False,
        semantic_model: str = "llama3.2",
    ):
        self.repo_url = repo_url.rstrip("/")
        self.branch = branch
        self.access_token = access_token
        self.use_semantic = use_semantic
        self.semantic_model = semantic_model

    def _get_auth_url(self) -> str:
        if not self.access_token:
            return self.repo_url
        parsed = urlparse(self.repo_url)
        return parsed._replace(netloc=f"x-access-token:{self.access_token}@{parsed.netloc}").geturl()

    async def get_remote_sha(self) -> Optional[str]:
        auth_url = self._get_auth_url()
        try:
            process = await asyncio.create_subprocess_exec(
                "git", "ls-remote", auth_url, self.branch,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10.0)
            if process.returncode == 0:
                output = stdout.decode().strip()
                if output:
                    return output.split()[0]
        except Exception as e:
            logger.warning(f"Failed to get remote SHA for {self.repo_url}: {e}")
        return None

    async def run(self) -> DiscoveryResult:
        """Execute the full ingestion pipeline and return a DiscoveryResult."""
        commit_sha = await self.get_remote_sha()
        logger.info(f"Starting GitHub ingestion for {self.repo_url} on branch {self.branch} (SHA: {commit_sha})")

        walker = RepositoryWalker(
            repo_url=self.repo_url, 
            branch=self.branch, 
            auth_url=self._get_auth_url()
        )
        
        start_time = time()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            file_set = await walker.walk(temp_dir)
            clone_duration = time() - start_time
            
            iac_parser = IaCParser()
            dep_parser = DependencyParser()
            all_signals: List[InfrastructureSignal] = []
            
            # Step 3 & 4: Process Tier 1 files (Deterministic)
            for file_meta in file_set.tier_1_files:
                full_path = os.path.join(temp_dir, file_meta.path)
                if not os.path.isfile(full_path):
                    continue
                
                try:
                    with open(full_path, "r", errors="replace") as f:
                        content = f.read()
                except Exception:
                    continue
                
                filename = os.path.basename(file_meta.path)
                
                if file_meta.extension in (".tf", ".hcl"):
                    all_signals.extend(iac_parser.parse_terraform(file_meta.path, content))
                elif "docker-compose" in filename and file_meta.extension in (".yml", ".yaml"):
                    all_signals.extend(iac_parser.parse_compose(file_meta.path, content))
                elif (".github/workflows" in file_meta.path or "workflow" in filename) and file_meta.extension in (".yml", ".yaml"):
                    all_signals.extend(iac_parser.parse_github_actions(file_meta.path, content))
                elif ("k8s" in file_meta.path or "kubernetes" in file_meta.path or "deployment" in filename or "service" in filename) and file_meta.extension in (".yml", ".yaml"):
                    all_signals.extend(iac_parser.parse_kubernetes(file_meta.path, content))
                elif filename == "package.json":
                    all_signals.extend(dep_parser.parse_package_json(file_meta.path, content))
                elif "requirements" in filename and file_meta.extension == ".txt":
                    all_signals.extend(dep_parser.parse_requirements_txt(file_meta.path, content))
                elif filename.startswith(".env"):
                    all_signals.extend(dep_parser.parse_env_file(file_meta.path, content))

            logger.info(f"Deterministic parsing yielded {len(all_signals)} signals")

            if self.use_semantic and file_set.tier_2_files:
                try:
                    from apps.api.ingestors.github.semantic import SemanticParser
                    semantic_parser = SemanticParser(model=self.semantic_model)
                    tier_2_files_content = []
                    for file_meta in file_set.tier_2_files[:20]:
                        full_path = os.path.join(temp_dir, file_meta.path)
                        if not os.path.isfile(full_path):
                            continue
                        try:
                            with open(full_path, "r", errors="replace") as f:
                                content = f.read()
                            tier_2_files_content.append({"path": file_meta.path, "content": content})
                        except Exception:
                            continue

                    if tier_2_files_content:
                        semantic_signals = await semantic_parser.parse_application_code(tier_2_files_content)
                        all_signals.extend(semantic_signals)
                        logger.info(f"Semantic parsing yielded {len(semantic_signals)} additional signals")
                except Exception as e:
                    logger.warning(f"Semantic parsing failed: {e}")

            # Step 5: Aggregate / deduplicate
            aggregator = SignalAggregator(match_threshold=70)
            final_signals = aggregator.aggregate(all_signals)

            # Step 6: Convert to DiscoveryNodes
            nodes = self._signals_to_nodes(final_signals)
            macro_nodes = self._infer_macro_blocks(final_signals)
            nodes.extend(macro_nodes)

            edges = []
            validator = GraphValidator()
            nodes, _ = validator.sanitize(nodes, edges)

            return DiscoveryResult(
                source="github",
                nodes=nodes,
                edges=edges,
                metadata={
                    "repo_url": self.repo_url,
                    "branch": self.branch,
                    "commit_sha": commit_sha,
                    "raw_signal_count": len(all_signals),
                    "deduplicated_count": len(final_signals),
                },
            )

    def _signals_to_nodes(self, signals: List[InfrastructureSignal]) -> List[DiscoveryNode]:
        nodes = []
        for sig in signals:
            node_type = COMPONENT_TO_NODE_TYPE.get(sig.component_type, "compute")
            key = f"github:{sig.component_type.lower()}:{sig.name}"

            nodes.append(
                DiscoveryNode(
                    key=key,
                    display_name=sig.name,
                    node_type=node_type,
                    properties={
                        "role": sig.component_type,
                        "related_files": [sig.source_location],
                        "confidence_score": sig.confidence_score,
                        **sig.config,
                    },
                    source_metadata={
                        "repo_url": self.repo_url,
                        "extraction_method": "deterministic" if sig.confidence_score >= 0.8 else "semantic",
                    },
                )
            )
        return nodes

    def _infer_macro_blocks(self, final_signals: List[InfrastructureSignal]) -> List[DiscoveryNode]:
        nodes = []
        is_frontend = False
        is_backend = False
        
        for sig in final_signals:
            pkg = sig.config.get("package", "").lower()
            if pkg in ("react", "next", "vue", "angular", "svelte"):
                is_frontend = True
            elif pkg in ("express", "fastapi", "flask", "django", "nest"):
                is_backend = True

        if is_frontend:
            nodes.append(DiscoveryNode(
                key="macro:frontend",
                display_name="Frontend Application",
                node_type="Frontend Component",
                properties={"role": "Frontend Component"},
                source_metadata={"repo_url": self.repo_url, "extraction_method": "deterministic"}
            ))

        if is_backend:
            nodes.append(DiscoveryNode(
                key="macro:backend",
                display_name="Backend API",
                node_type="Backend API",
                properties={"role": "Backend API"},
                source_metadata={"repo_url": self.repo_url, "extraction_method": "deterministic"}
            ))
            
        return nodes

