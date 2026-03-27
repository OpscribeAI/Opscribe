from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
import httpx
import os
import json
import logging
from uuid import UUID
from datetime import datetime

logger = logging.getLogger(__name__)

from apps.api.database import get_session
from apps.api.models import Client, ConnectedRepository, PlatformConfig
from apps.api.ingestors.github.app_auth import get_installation_token
from apps.api.ingestors.github.client import GitHubClient
from apps.api.ingestors.pipeline.s3_exporter import S3Exporter
from apps.api.ingestors.pipeline.ingestors import GitHubIngestor
from apps.api.routers.pipeline import run_export
from apps.api.routers.clients import DEV_USER_ID

router = APIRouter(
    prefix="/github",
    tags=["github"]
)

@router.get("/config")
def github_config(client_id: UUID, session: Session = Depends(get_session)):
    """Returns the custom GitHub App configuration needed by the frontend for this specific client."""
    from apps.api.models import ClientIntegration
    from apps.api.utils.encryption import decrypt_dict
    from apps.api.routers.integrations import SENSITIVE_KEYS

    statement = select(ClientIntegration).where(
        ClientIntegration.client_id == client_id,
        ClientIntegration.provider == "github_app",
        ClientIntegration.is_active == True
    )
    integration = session.exec(statement).first()
    
    if not integration:
        return {"configured": False, "app_install_url": None}

    creds = decrypt_dict(integration.credentials, SENSITIVE_KEYS)
    slug = creds.get("github_app_slug") 
    
    if not slug:
        return {"configured": False, "app_install_url": None}
        
    return {
        "configured": True,
        "app_install_url": f"https://github.com/apps/{slug}/installations/new",
    }

@router.get("/app/callback")
async def github_app_callback(
    installation_id: str, 
    setup_action: str = None, 
    state: str = None, 
    client_id: str = None,
    session: Session = Depends(get_session)
):
    """
    Handles the redirect after a user installs the GitHub App.
    Parameterizes the redirect URL to include client_id for maintaining context.
    """
    effective_client_id = state or client_id
    if effective_client_id:
        try:
            client_uuid = UUID(effective_client_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid client ID format")
    else:
        client_uuid = DEV_USER_ID

    db_client = session.get(Client, client_uuid)
    if not db_client:
        raise HTTPException(status_code=404, detail="Client not found")

    db_client.metadata_ = dict(db_client.metadata_ or {})
    db_client.metadata_["github_installation_id"] = installation_id
    session.add(db_client)
    session.commit()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend_url}/?github_app_installed=true&client_id={effective_client_id}")

@router.get("/repos")
async def get_repositories(client_id: UUID, session: Session = Depends(get_session)):
    """Fetches available repositories for this GitHub App Installation."""
    if os.getenv("MOCK_DEMO") == "true":
        return [
            {"id": "123456789", "name": "opscribe/demo-api", "default_branch": "main"},
            {"id": "234567890", "name": "opscribe/demo-web", "default_branch": "main"},
            {"id": "345678901", "name": "opscribe/demo-infra", "default_branch": "master"}
        ]

    db_client = session.get(Client, client_id)
    if not db_client or not db_client.metadata_ or "github_installation_id" not in db_client.metadata_:
        raise HTTPException(status_code=401, detail="GitHub App not installed")

    installation_id = db_client.metadata_["github_installation_id"]

    try:
        token = await get_installation_token(installation_id, str(client_id), session)
        gh_client = GitHubClient(access_token=token)

        all_repos = []
        page = 1
        while True:
            response = await gh_client._request_with_retry("GET", f"/installation/repositories?per_page=100&page={page}")
            data = response.json()
            page_repos = data.get("repositories", [])
            if not page_repos: break
            all_repos.extend(page_repos)
            if len(page_repos) < 100: break
            page += 1
                
        return [
            {"id": str(r["id"]), "name": r["full_name"], "default_branch": r["default_branch"]}
            for r in all_repos
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/connected-repos")
async def get_connected_repos(client_id: UUID, session: Session = Depends(get_session)):
    """Fetches connected repositories for status tracking."""
    return session.exec(select(ConnectedRepository).where(ConnectedRepository.client_id == client_id)).all()

from pydantic import BaseModel
class ConnectRepoRequest(BaseModel):
    client_id: UUID
    repo_url: str
    target_repo_id: str
    default_branch: str

@router.post("/connect")
async def connect_repository(
    request: ConnectRepoRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    """Saves repo selection and triggers baseline ingestion."""
    db_client = session.get(Client, request.client_id)
    if not db_client or not db_client.metadata_ or "github_installation_id" not in db_client.metadata_:
        raise HTTPException(status_code=401, detail="GitHub App not installed")

    # Check for existing connection to avoid duplicates
    existing = session.exec(
        select(ConnectedRepository).where(
            ConnectedRepository.client_id == request.client_id,
            ConnectedRepository.repo_url == request.repo_url
        )
    ).first()

    if existing:
        existing.ingestion_status = "pending"
        existing.updated_at = datetime.utcnow()
        repo = existing
    else:
        repo = ConnectedRepository(
            client_id=request.client_id,
            repo_url=request.repo_url,
            default_branch=request.default_branch,
            installation_id=db_client.metadata_["github_installation_id"],
            target_repo_id=request.target_repo_id,
            ingestion_status="pending"
        )
    
    session.add(repo)
    session.commit()
    session.refresh(repo)

    ingestor = GitHubIngestor(client_id=str(request.client_id), session=session, repo_url=request.repo_url)
    background_tasks.add_task(run_export, client_id=str(request.client_id), ingestors=[ingestor], exporter=S3Exporter())

    return {"status": "success", "repo_id": str(repo.id)}

@router.post("/webhook")
async def github_webhook(
    request: Request, 
    background_tasks: BackgroundTasks, 
    session: Session = Depends(get_session),
    client_id: str = Query(...)
):
    """Processes GitHub webhooks with signature verification."""
    from apps.api.models import ClientIntegration
    from apps.api.utils.encryption import decrypt_dict
    from apps.api.routers.integrations import SENSITIVE_KEYS
    import hmac, hashlib

    stmt = select(ClientIntegration).where(ClientIntegration.client_id == client_id, ClientIntegration.provider == "github_app")
    integration = session.exec(stmt).first()
    
    if integration:
        creds = decrypt_dict(integration.credentials, SENSITIVE_KEYS)
        secret = creds.get("github_webhook_secret")
        if secret:
            signature = request.headers.get("X-Hub-Signature-256")
            if not signature or not hmac.compare_digest(signature, "sha256=" + hmac.new(secret.encode(), await request.body(), hashlib.sha256).hexdigest()):
                raise HTTPException(status_code=401)

    event = request.headers.get("X-GitHub-Event")
    if event != "push": return {"status": "ignored"}

    payload = await request.json()
    repo_url = payload.get("repository", {}).get("html_url")
    ref = payload.get("ref", "")
    installation_id = str(payload.get("installation", {}).get("id", ""))

    stmt = select(ConnectedRepository).where(ConnectedRepository.repo_url == repo_url, ConnectedRepository.installation_id == installation_id, ConnectedRepository.client_id == client_id)
    for connected in session.exec(stmt).all():
        if ref == f"refs/heads/{connected.default_branch}":
            connected.ingestion_status = "pending"
            session.add(connected)
            ingestor = GitHubIngestor(client_id=str(client_id), session=session, repo_url=repo_url)
            background_tasks.add_task(run_export, client_id=str(client_id), ingestors=[ingestor], exporter=S3Exporter())

    session.commit()
    return {"status": "success"}
