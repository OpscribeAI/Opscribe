"""
GitHub Repository Ingestion Pipeline

Connects the RepositoryWalker → Parsers → SignalAggregator pipeline
and produces a unified DiscoveryResult with nodes and edges.

Flow:
    1. Walker clones repo → produces ParseableFileSet (tier 1 + tier 2 files)
    2. Read file contents from the cloned repo
    3. Tier 1 files → IaCParser + DependencyParser (deterministic)
    4. Tier 2 files → SemanticParser (LLM-assisted)
    5. All signals → SignalAggregator (deduplication)
    6. InfrastructureSignal → DiscoveryNode + DiscoveryEdge
    7. Return DiscoveryResult(source="github", ...)
"""

import os
import asyncio
import tempfile
import subprocess
import logging
from typing import List, Optional
from urllib.parse import urlparse

import time
from apps.api.ingestors.github.walker import RepositoryWalker
from apps.api.ingestors.github.deterministic import IaCParser, DependencyParser
from apps.api.ingestors.github.semantic import SemanticParser
from apps.api.ingestors.github.aggregator import SignalAggregator
from apps.api.ingestors.github.models import InfrastructureSignal, FileMetadata
from apps.api.ingestors.aws.schemas import DiscoveryResult, DiscoveryNode, DiscoveryEdge

logger = logging.getLogger(__name__)


# Mapping from InfrastructureSignal component_type → DiscoveryNode node_type
COMPONENT_TO_NODE_TYPE = {
    "Database": "datastore",
    "Cache": "datastore",
    "Queue": "integration",
    "Worker": "compute",
    "Cloud-Service": "compute",
    "Compute": "compute",
    "Storage": "storage",
    "Service": "compute",
    "Resource": "compute",
    "API": "network",
}


class GitHubIngestionPipeline:
    """
    Full pipeline: clone repo → parse → aggregate → produce DiscoveryResult.
    """

    def __init__(
        self,
        repo_url: str,
        branch: str,
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
        # GitHub App installation tokens require 'x-access-token' as the username
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
            branch=self.branch
        )
        
        with tempfile.TemporaryDirectory() as temp_dir:
            clone_start_time = time.time()
            auth_url = self._get_auth_url()
            process = await asyncio.create_subprocess_exec(
                "git", "clone", "--depth=1", "--branch", self.branch, auth_url, ".",
                cwd=temp_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=60.0)
            except asyncio.TimeoutError:
                process.kill()
                raise Exception("Git clone timed out after 60 seconds (repository may be too large or network slow).")

            if process.returncode != 0:
                raise Exception(f"Failed to clone repository: {stderr.decode()}")

            clone_duration = round(time.time() - clone_start_time, 2)
            logger.info(f"Cloned {self.repo_url} successfully in {clone_duration}s")

            walk_start_time = time.time()
            file_set = await walker.walk_local(temp_dir)
            walk_duration = round(time.time() - walk_start_time, 2)

            logger.info(
                f"Walked repository in {walk_duration}s. Found {len(file_set.tier_1_files)} Tier 1 and "
                f"{len(file_set.tier_2_files)} Tier 2 files"
            )

            all_signals: List[InfrastructureSignal] = []

            iac_parser = IaCParser()
            dep_parser = DependencyParser()

            for file_meta in file_set.tier_1_files:
                full_path = os.path.join(temp_dir, file_meta.path)
                if not os.path.isfile(full_path):
                    continue
                try:
                    with open(full_path, "r", errors="replace") as f:
                        content = f.read()
                except Exception:
                    continue

                filename = os.path.basename(file_meta.path).lower()

                if file_meta.extension == ".tf":
                    all_signals.extend(iac_parser.parse_terraform(file_meta.path, content))
                elif "docker-compose" in filename and file_meta.extension in (".yml", ".yaml"):
                    all_signals.extend(iac_parser.parse_compose(file_meta.path, content))
                elif filename == "package.json":
                    all_signals.extend(dep_parser.parse_package_json(file_meta.path, content))
                elif "requirements" in filename and file_meta.extension == ".txt":
                    all_signals.extend(dep_parser.parse_requirements_txt(file_meta.path, content))

            logger.info(f"Deterministic parsing yielded {len(all_signals)} signals")

            if self.use_semantic and file_set.tier_2_files:
                try:
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
                        logger.info(f"Semantic parsing yielded {len(semantic_signals)} additional signals from app code")
                except Exception as e:
                    logger.warning(f"Semantic parsing failed (non-fatal): {e}")

            # Step 5: Aggregate / deduplicate
            aggregator = SignalAggregator(match_threshold=70)
            final_signals = aggregator.aggregate(all_signals)
            logger.info(f"After aggregation: {len(final_signals)} unique signals")

            # Step 6: Convert to DiscoveryNodes + DiscoveryEdges
            nodes = self._signals_to_nodes(final_signals)
            
            # Step 7: Extrapolate Macro Components
            macro_nodes = self._infer_macro_blocks(final_signals)
            nodes.extend(macro_nodes)

            edges = [] # Dropping Edge extraction per architectural pivot

            # The validator natively supports Edge arrays being empty now
            from apps.api.ingestors.github.validator import GraphValidator
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
                    "tier_1_count": len(file_set.tier_1_files),
                    "tier_2_count": len(file_set.tier_2_files),
                    "raw_signal_count": len(all_signals),
                    "deduplicated_count": len(final_signals),
                    "clone_duration_sec": clone_duration,
                    "walk_duration_sec": walk_duration,
                },
            )

    def _signals_to_nodes(self, signals: List[InfrastructureSignal]) -> List[DiscoveryNode]:
        """Convert InfrastructureSignals to DiscoveryNodes."""
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
        """Automatically extrapolates high-level architectural blocks based on dependency gravity."""
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
                properties={"role": "Frontend Component", "description": "Auto-classified UI application based on dependencies"},
                source_metadata={"repo_url": self.repo_url, "extraction_method": "deterministic"}
            ))

        if is_backend:
            nodes.append(DiscoveryNode(
                key="macro:backend",
                display_name="Backend API",
                node_type="Backend API",
                properties={"role": "Backend API", "description": "Auto-classified Backend routing API explicitly mapped"},
                source_metadata={"repo_url": self.repo_url, "extraction_method": "deterministic"}
            ))
            
        return nodes
