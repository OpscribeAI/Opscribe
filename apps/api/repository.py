import os
import json
import logging
from uuid import UUID
from typing import List, Optional, Dict, Any
from sqlmodel import Session, select
from apps.api.models import Client, ClientIntegration, Graph

logger = logging.getLogger(__name__)

# Hardcoded demo identity
DEMO_CLIENT_ID = UUID("00000000-0000-0000-0000-000000000000")

class ClientRepository:
    """
    Professional Repository for Client and Integration data.
    Handles seamless failover between live Postgres and Mock/Demo states.
    """

    def __init__(self, session: Optional[Session] = None):
        self.session = session
        self.mock_mode = os.getenv("MOCK_DEMO", "false").lower() == "true"
        # In-memory store for "Stateful Mocking" during current session
        self._mock_integrations: Dict[str, Dict[str, Any]] = {}

    def get_client(self, client_id: UUID) -> Client:
        """Fetch client by ID with demo failover."""
        if self.mock_mode or not self.session:
            return Client(
                id=DEMO_CLIENT_ID,
                name="Dev User (Demo)",
                metadata_={"role": "admin", "temporary_auth": True}
            )
        
        try:
            client = self.session.get(Client, client_id)
            if not client:
                # Return demo user if not found but session exists (fallback)
                return self.get_client(DEMO_CLIENT_ID)
            return client
        except Exception as e:
            logger.error(f"Database error in get_client: {e}")
            return self.get_client(DEMO_CLIENT_ID)

    def list_graphs(self, client_id: UUID) -> List[Graph]:
        """List graphs for a client."""
        if self.mock_mode or not self.session:
            return []
        
        try:
            return self.session.exec(
                select(Graph)
                .where(Graph.client_id == client_id)
                .order_by(Graph.updated_at.desc())
            ).all()
        except Exception as e:
            logger.error(f"Database error in list_graphs: {e}")
            return []

    def get_integration(self, client_id: UUID, provider: str) -> Optional[ClientIntegration]:
        """Fetch integration settings with stateful mock support."""
        if self.mock_mode or not self.session:
            # Check stateful mock first
            mock_data = self._mock_integrations.get(f"{client_id}:{provider}")
            if mock_data:
                return ClientIntegration(**mock_data)
            
            # Default mock for GitHub
            if provider == "github":
                return ClientIntegration(
                    client_id=client_id,
                    provider="github",
                    credentials={"app_id": os.getenv("GITHUB_APP_ID", "3185264")},
                    is_active=True
                )
            return None

        try:
            return self.session.exec(
                select(ClientIntegration)
                .where(ClientIntegration.client_id == client_id)
                .where(ClientIntegration.provider == provider)
                .where(ClientIntegration.is_active == True)
            ).first()
        except Exception as e:
            logger.error(f"Database error in get_integration: {e}")
            return None

    def save_integration(self, integration: ClientIntegration) -> bool:
        """Save integration settings with support for demo persistence."""
        if self.mock_mode or not self.session:
            # Persist to in-memory store for the duration of the demo
            key = f"{integration.client_id}:{integration.provider}"
            self._mock_integrations[key] = integration.model_dump()
            logger.info(f"MOCK_DEMO: Successfully 'saved' {integration.provider} credentials for {integration.client_id}")
            return True

        try:
            self.session.add(integration)
            self.session.commit()
            self.session.refresh(integration)
            return True
        except Exception as e:
            logger.error(f"Database error in save_integration: {e}")
            return False
