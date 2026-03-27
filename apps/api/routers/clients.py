from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import Session, select
from typing import List
import logging
import os
from uuid import UUID, uuid4

from apps.api.database import get_repo
from apps.api.repository import ClientRepository
from apps.api.models import Client, Graph
from apps.api import schemas

# Hardcoded dev user ID until Auth0 is fully integrated
DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000000")

router = APIRouter(
    prefix="/clients",
    tags=["clients"]
)

@router.get("/", response_model=List[schemas.ClientRead])
async def read_clients(
    repo: ClientRepository = Depends(get_repo),
    skip: int = 0,
    limit: int = 100,
):
    clients = repo.list_clients(skip=skip, limit=limit)
    return clients

@router.get("/me", response_model=schemas.ClientRead)
async def get_current_user(repo: ClientRepository = Depends(get_repo)):
    """
    Temporary placeholder for a JWT-based /me endpoint.
    Returns a consistent 'Dev User' client until auth is fully implemented.
    """
    if os.getenv("MOCK_DEMO") == "true":
        return Client(
            id=DEV_USER_ID,
            name="Dev User (Demo)",
            metadata_={"role": "admin", "temporary_auth": True, "github_installation_id": "12345678"},
        )

    # If repo is None (shouldn't happen with Depends, but as a fallback)
    if repo is None:
        return Client(
            id=DEV_USER_ID,
            name="Dev User (Fallback)",
            metadata_={"role": "admin", "temporary_auth": True},
        )

    client = repo.get_client(DEV_USER_ID)
    if not client:
        new_client = Client(
            id=DEV_USER_ID,
            name="Dev User",
            metadata_={"role": "admin", "temporary_auth": True},
        )
        client = repo.create_client(new_client) # Assuming create_client handles adding and committing
    
    return client


@router.post("/", response_model=schemas.ClientRead)
async def create_client(client: schemas.ClientCreate, repo: ClientRepository = Depends(get_repo)):
    db_client = Client.model_validate(client)
    db_client = repo.create_client(db_client) # Assuming create_client handles adding and committing
    return db_client

@router.get("/{client_id}", response_model=schemas.ClientRead)
async def read_client(client_id: UUID, repo: ClientRepository = Depends(get_repo)):
    if os.getenv("MOCK_DEMO") == "true":
        return Client(id=client_id, name="Demo Client")
        
    client = repo.get_client(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.get("/{client_id}/graphs", response_model=List[schemas.GraphRead])
def list_client_graphs(client_id: UUID, repo: ClientRepository = Depends(get_repo)):
    """List all infrastructure designs (graphs) for a client. Use this for the dashboard."""
    if os.getenv("MOCK_DEMO") == "true":
        return []

    graphs = repo.list_graphs(client_id)
    return graphs
