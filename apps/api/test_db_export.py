import asyncio
import uuid
import logging

from apps.api.database import engine
from sqlmodel import Session
from apps.api.models import Client
from apps.api.ingestors.github.pipeline import GitHubIngestionPipeline
from apps.api.ingestors.pipeline.db_exporter import DbExporter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Test")

async def test_db_export():
    # 1. Create a dummy client
    client_id = uuid.uuid4()
    with Session(engine) as session:
        client = Client(id=client_id, name="Test Client")
        session.add(client)
        session.commit()
    
    # 2. Extract repository
    pipeline = GitHubIngestionPipeline(repo_url="https://github.com/expressjs/express", branch="master", use_semantic=False)
    result = await pipeline.run()
    
    # 3. Export to Db
    exporter = DbExporter()
    graph_id = await exporter.export(client_id=str(client_id), results=[result], label="Express Nodes")
    
    logger.info(f"Test Successful! Inserted graph: {graph_id}")

if __name__ == "__main__":
    asyncio.run(test_db_export())
