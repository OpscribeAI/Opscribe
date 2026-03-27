"""
Ingestion Intelligence API Router

Provides endpoints for accessing ingestion intelligence reports and monitoring.
Implements resilient error handling and graceful degradation.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
import logging
from typing import Dict, Any

from apps.api.database import get_repo
from apps.api.repository import ClientRepository
from apps.api.services.ingestion_intelligence import IngestionIntelligenceService
from apps.api.models import Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ingestion-intelligence",
    tags=["ingestion-intelligence"]
)


@router.get("/report/{client_id}")
async def get_intelligence_report(
    client_id: str,
    repo: ClientRepository = Depends(get_repo)
) -> Dict[str, Any]:
    """
    Get comprehensive ingestion intelligence report for a client.
    
    This endpoint provides:
    - Credential health status
    - Ingestion metrics and performance
    - Repository status and history
    - Actionable recommendations
    - Critical alerts
    
    Implements resilient error handling - will return partial data
    even if some components fail.
    """
    try:
        # Validate client exists
        from uuid import UUID
        try:
            client_uuid = UUID(client_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid client ID format")
        
        client = repo.get_client(client_uuid)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Generate intelligence report
        service = IngestionIntelligenceService(repo.session if hasattr(repo, "session") else None)
        report = await service.get_intelligence_report(client_uuid)
        
        return report
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate intelligence report for client {client_id}: {e}")
        # Return a minimal error response instead of failing completely
        return {
            "client_id": client_id,
            "timestamp": "2024-01-01T00:00:00",
            "error": f"Report generation failed: {str(e)}",
            "health_score": 0,
            "credential_health": {
                "is_valid": False,
                "installation_valid": False,
                "error_message": "Service temporarily unavailable"
            },
            "metrics": {
                "total_repositories": 0,
                "successful_ingestions": 0,
                "failed_ingestions": 0,
                "pending_ingestions": 0,
                "success_rate": 0
            },
            "repositories": [],
            "recommendations": ["Try again later or contact support"],
            "alerts": [{
                "severity": "error",
                "message": "Intelligence service temporarily unavailable"
            }]
        }


@router.get("/health/{client_id}")
async def get_credential_health(
    client_id: str,
    repo: ClientRepository = Depends(get_repo)
) -> Dict[str, Any]:
    """
    Get credential health status for a client.
    
    Lightweight endpoint for checking if GitHub credentials are working.
    """
    try:
        from uuid import UUID
        try:
            client_uuid = UUID(client_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid client ID format")
        
        client = repo.get_client(client_uuid)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        service = IngestionIntelligenceService(repo.session if hasattr(repo, "session") else None)
        health = await service.get_credential_health(client_uuid)
        
        return {
            "client_id": client_id,
            "credential_health": {
                "is_valid": health.is_valid,
                "installation_valid": health.installation_valid,
                "error_message": health.error_message,
                "last_checked": health.last_checked.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to check credential health for client {client_id}: {e}")
        return {
            "client_id": client_id,
            "credential_health": {
                "is_valid": False,
                "installation_valid": False,
                "error_message": "Health check failed",
                "last_checked": "2024-01-01T00:00:00"
            }
        }


@router.get("/metrics/{client_id}")
async def get_ingestion_metrics(
    client_id: str,
    repo: ClientRepository = Depends(get_repo)
) -> Dict[str, Any]:
    """
    Get ingestion metrics for a client.
    
    Provides performance metrics without credential checking.
    """
    try:
        from uuid import UUID
        try:
            client_uuid = UUID(client_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid client ID format")
        
        client = repo.get_client(client_uuid)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        service = IngestionIntelligenceService(repo.session if hasattr(repo, "session") else None)
        metrics = service.get_ingestion_metrics(client_uuid)
        
        return {
            "client_id": client_id,
            "metrics": {
                "total_repositories": metrics.total_repos,
                "successful_ingestions": metrics.successful_ingestions,
                "failed_ingestions": metrics.failed_ingestions,
                "pending_ingestions": metrics.pending_ingestions,
                "success_rate": round(metrics.success_rate, 2),
                "avg_ingestion_time_seconds": metrics.avg_ingestion_time,
                "last_ingestion": metrics.last_ingestion.isoformat() if metrics.last_ingestion else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get ingestion metrics for client {client_id}: {e}")
        return {
            "client_id": client_id,
            "metrics": {
                "total_repositories": 0,
                "successful_ingestions": 0,
                "failed_ingestions": 0,
                "pending_ingestions": 0,
                "success_rate": 0,
                "avg_ingestion_time_seconds": None,
                "last_ingestion": None
            }
        }
