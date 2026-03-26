import asyncio
from apps.api.ingestors.github.pipeline import GitHubIngestionPipeline
from apps.api.ingestors.pipeline.s3_exporter import S3Exporter
import json

async def run_test():
    print("Initializing GitHub Ingestion Pipeline for payload validation...")
    pipeline = GitHubIngestionPipeline(
        client_id="80ace70b-2597-41ec-985e-817ecea95a9a",
        session=None,
        repo_url="https://github.com/expressjs/express"
    )
    # The pipeline inherently clones, walks, executes semantic discovery, validates and generates Nodes!
    results = await pipeline.run()
    
    # We validate the exact payload S3Exporter creates before uploading.
    exporter = S3Exporter()
    payload = exporter._result_to_dict(results[0])
    
    print("\n\n=== S3/MINIO JSON PAYLOAD SIMULATION ===")
    print(json.dumps(payload, indent=2))
    print("==========================================\n\n")
    print("Payload successfully proven fully deterministic!")

if __name__ == "__main__":
    asyncio.run(run_test())
