"""
Pipeline Router — Triggers per-tenant data export to S3.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, List

from apps.api.database import get_session
from apps.api.models import Client, ConnectedRepository
from apps.api.ingestors.aws.detector import AWSDetector
from apps.api.ingestors.aws.schemas import DiscoveryResult
from apps.api.ingestors.github.pipeline import GitHubIngestionPipeline
from apps.api.ingestors.github.security import decrypt_token
from apps.api.ingestors.pipeline.s3_exporter import S3Exporter

router = APIRouter(
    prefix="/pipeline",
    tags=["Pipeline"],
)


class ExportRequest(BaseModel):
    client_id: str
    include_aws: bool = True
    include_github: bool = True
    aws_region: str = "us-east-1"


class GithubLinkRequest(BaseModel):
    repo_url: str
    client_id: str
    branch: str = "main"


class ExportResponse(BaseModel):
    status: str
    message: str


async def run_export(
    client_id: str,
    include_aws: bool,
    include_github: bool,
    aws_region: str,
    session: Session,
):
    """Background task to run full export pipeline."""
    results: List[DiscoveryResult] = []

    # AWS Discovery
    if include_aws:
        try:
            detector = AWSDetector(region_name=aws_region)
            aws_result = await detector.discover()
            results.append(aws_result)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"AWS discovery failed: {e}")

    # GitHub Repo Ingestion
    if include_github:
        statement = select(ConnectedRepository).where(
            ConnectedRepository.client_id == client_id,
        )
        repos = session.exec(statement).all()

        for repo in repos:
            try:
                token = decrypt_token(repo.github_access_token)
                pipeline = GitHubIngestionPipeline(
                    repo_url=repo.clone_url,
                    branch=repo.default_branch or "main",
                    access_token=token,
                )
                github_result = await pipeline.run()
                results.append(github_result)
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(
                    f"GitHub ingestion failed for {repo.clone_url}: {e}"
                )

    # Export to S3
    if results:
        exporter = S3Exporter()
        await exporter.export(client_id=client_id, results=results)


@router.post("/export", response_model=ExportResponse)
async def trigger_export(
    request: ExportRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    """Trigger a background export of combined AWS + GitHub data to S3."""
    # Verify client exists
    client = session.get(Client, request.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    background_tasks.add_task(
        run_export,
        client_id=request.client_id,
        include_aws=request.include_aws,
        include_github=request.include_github,
        aws_region=request.aws_region,
        session=session,
    )

    return ExportResponse(
        status="started",
        message=f"Export pipeline started for client {request.client_id}. Data will be exported to S3.",
    )


async def run_github_link(
    client_id: str,
    repo_url: str,
    branch: str,
    session: Session,
):
    try:
        pipeline = GitHubIngestionPipeline(
            repo_url=repo_url,
            branch=branch,
            access_token="",
        )
        github_result = await pipeline.run()
        
        # Export to S3
        exporter = S3Exporter()
        label = f"github_link_export_{repo_url.split('/')[-1] if '/' in repo_url else 'repo'}"
        await exporter.export(client_id=client_id, results=[github_result], label=label)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"GitHub link ingestion failed for {repo_url}: {e}")


@router.post("/github-link", response_model=ExportResponse)
async def trigger_github_link(
    request: GithubLinkRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    """Trigger a background ingestion of a public GitHub URL directly to S3."""
    client = session.get(Client, request.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    background_tasks.add_task(
        run_github_link,
        client_id=request.client_id,
        repo_url=request.repo_url,
        branch=request.branch,
        session=session,
    )

    return ExportResponse(
        status="started",
        message=f"GitHub link ingestion started for client {request.client_id}. Data will be exported to S3.",
    )
