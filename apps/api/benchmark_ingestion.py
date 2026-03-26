import asyncio
import time
import hashlib
import json
import logging
import os
import sys

# Configure script path to run in Opscribe context
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from apps.api.ingestors.github.pipeline import GitHubIngestionPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Benchmark")

# A mix of sizes: TS, Py, Go, and Terraform-heavy repositories
BENCHMARK_REPOS = [
    "tiangolo/fastapi", "pallets/flask", "expressjs/express", "vuejs/vue",
    "facebook/react", "vercel/next.js", "nestjs/nest", "axios/axios",
    "lodash/lodash", "prettier/prettier", "webpack/webpack", "reduxjs/redux",
    "moment/moment", "chartjs/Chart.js", "d3/d3", "jquery/jquery",
    "twbs/bootstrap", "tailwindlabs/tailwindcss", "ant-design/ant-design",
    "mui/material-ui", "elastic/elasticsearch", "redis/redis",
    "postgres/postgres", "prometheus/prometheus", "grafana/grafana",
    "hashicorp/terraform", "hashicorp/vault", "hashicorp/consul",
    "kubernetes/kubernetes", "docker/compose", "docker/cli",
    "aws/aws-cli", "boto/boto3", "aws/aws-cdk", "pulumi/pulumi",
    "terraform-aws-modules/terraform-aws-vpc",
    "terraform-aws-modules/terraform-aws-eks",
    "terraform-aws-modules/terraform-aws-rds",
    "terraform-aws-modules/terraform-aws-s3-bucket",
    "terraform-aws-modules/terraform-aws-ec2-instance",
    "antonbabenko/terraform-aws-serverless", "serverless/serverless",
    "django/django", "psf/requests", "scikit-learn/scikit-learn",
    "keras-team/keras", "tensorflow/tensorflow", "pytorch/pytorch",
    "pandas-dev/pandas", "numpy/numpy"
]

async def run_idempotency_test(repo: str, runs: int = 4):
    """Runs ingestion 4 times sequentially and ensures the output graph hash is 100% identical."""
    url = f"https://github.com/{repo}"
    logger.info(f"--- Running Idempotency Test for {repo} ({runs} runs) ---")
    
    hashes = set()
    for i in range(runs):
        pipeline = GitHubIngestionPipeline(
            repo_url=url, branch="main", use_semantic=False
        )
        try:
            start_t = time.time()
            result = await pipeline.run()
            duration = time.time() - start_t
            
            # Serialize deterministically
            res_dict = {
                "nodes": sorted([{"k": n.key, "type": n.node_type} for n in result.nodes], key=lambda x: x["k"]),
                "edges": sorted([{"f": e.from_node_key, "t": e.to_node_key, "type": e.edge_type} for e in result.edges], key=lambda x: f"{x['f']}-{x['t']}")
            }
            res_json = json.dumps(res_dict, sort_keys=True)
            run_hash = hashlib.sha256(res_json.encode()).hexdigest()
            
            hashes.add(run_hash)
            logger.info(f"Run {i+1}: Duration: {duration:.2f}s, Nodes: {len(result.nodes)}, Edges: {len(result.edges)}, Hash: {run_hash}")
        except Exception as e:
            logger.error(f"Idempotency run {i+1} failed: {e}")
            return False

    is_idempotent = len(hashes) == 1
    logger.info(f"Idempotency Check Passed? {is_idempotent}")
    return is_idempotent


async def run_benchmark_suite():
    valid_graphs = 0
    total_run = 0
    
    logger.info(f"Starting Benchmark Suite for {len(BENCHMARK_REPOS)} repositories...")
    
    for repo in BENCHMARK_REPOS[:10]: # Running top 10 for timely evaluation
        url = f"https://github.com/{repo}"
        try:
            pipeline = GitHubIngestionPipeline(repo_url=url, branch="main", use_semantic=False)
            try:
                total_time_start = time.time()
                result = await pipeline.run()
            except Exception as e:
                if "Remote branch main not found" in str(e) or "not found" in str(e).lower() or "reference" in str(e):
                    logger.info(f"{repo} missing main branch, falling back to master...")
                    pipeline = GitHubIngestionPipeline(repo_url=url, branch="master", use_semantic=False)
                    result = await pipeline.run()
                else:
                    raise e

            # Validate Graph Constraints
            total_time = time.time() - total_time_start
            has_data = len(result.nodes) > 0
            
            is_valid = has_data
            if is_valid:
                valid_graphs += 1
                    
            clone_dur = result.metadata.get("clone_duration_sec", 0)
            walk_dur = result.metadata.get("walk_duration_sec", 0)
            
            logger.info(f"[SUCCESS] {repo} - Total: {total_time:.2f}s (Clone: {clone_dur}s, Walk: {walk_dur}s) | Nodes: {len(result.nodes)}")
        except Exception as e:
            logger.error(f"[FAILED] {repo} - {e}")
        
        total_run += 1
        
    validation_rate = (valid_graphs / total_run) * 100
    logger.info(f"\n--- Benchmark Complete ---")
    logger.info(f"Valid Graphs: {validation_rate}% (Target: >= 95%)")
    
    # Run targeted idempotency test on a terraform repo
    await run_idempotency_test("terraform-aws-modules/terraform-aws-vpc", 4)

if __name__ == "__main__":
    asyncio.run(run_benchmark_suite())
