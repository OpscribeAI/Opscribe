"""
Ingestion Intelligence Service

Provides comprehensive monitoring and reporting for GitHub ingestion operations.
Implements resilient credential handling and health monitoring.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from uuid import UUID
from sqlmodel import Session, select, func

from apps.api.models import Client, ConnectedRepository, ClientIntegration
from apps.api.ingestors.github.app_auth import get_app_jwt, get_installation_token
from apps.api.ingestors.github.client import GitHubClient

logger = logging.getLogger(__name__)


class CredentialHealthStatus:
    """Represents the health status of GitHub credentials."""
    
    def __init__(self, is_valid: bool, error_message: Optional[str] = None, 
                 installation_valid: bool = False, last_checked: datetime = None):
        self.is_valid = is_valid
        self.error_message = error_message
        self.installation_valid = installation_valid
        self.last_checked = last_checked or datetime.utcnow()


class IngestionMetrics:
    """Metrics for ingestion operations."""
    
    def __init__(self, total_repos: int = 0, successful_ingestions: int = 0, 
                 failed_ingestions: int = 0, pending_ingestions: int = 0,
                 avg_ingestion_time: Optional[float] = None,
                 last_ingestion: Optional[datetime] = None):
        self.total_repos = total_repos
        self.successful_ingestions = successful_ingestions
        self.failed_ingestions = failed_ingestions
        self.pending_ingestions = pending_ingestions
        self.avg_ingestion_time = avg_ingestion_time
        self.last_ingestion = last_ingestion
        
    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage."""
        if self.total_repos == 0:
            return 0.0
        return (self.successful_ingestions / self.total_repos) * 100


class IngestionIntelligenceService:
    """Service for monitoring and reporting on GitHub ingestion intelligence."""
    
    def __init__(self, session: Session):
        self.session = session
    
    async def get_credential_health(self, client_id: UUID) -> CredentialHealthStatus:
        """
        Check the health of GitHub app credentials for a client.
        Implements resilient checking with graceful fallback.
        """
        try:
            # Check if integration exists
            integration = self.session.exec(
                select(ClientIntegration).where(
                    ClientIntegration.client_id == client_id,
                    ClientIntegration.provider == "github_app",
                    ClientIntegration.is_active == True
                )
            ).first()
            
            if not integration:
                return CredentialHealthStatus(
                    is_valid=False,
                    error_message="GitHub App integration not configured"
                )
            
            # Test JWT generation
            try:
                app_jwt = get_app_jwt(str(client_id), self.session)
            except Exception as e:
                logger.warning(f"JWT generation failed for client {client_id}: {e}")
                return CredentialHealthStatus(
                    is_valid=False,
                    error_message=f"Invalid GitHub App credentials: {str(e)}"
                )
            
            # Check installation status
            client = self.session.get(Client, client_id)
            installation_id = None
            installation_valid = False
            
            if client and client.metadata_:
                installation_id = client.metadata_.get("github_installation_id") if client.metadata_ else None
                
                if installation_id:
                    try:
                        # Test installation token generation
                        token = await get_installation_token(installation_id, str(client_id), self.session)
                        
                        # Test API access with the token
                        gh_client = GitHubClient(access_token=token)
                        await gh_client._request_with_retry("GET", "/installation/repositories?per_page=1")
                        installation_valid = True
                        
                    except Exception as e:
                        logger.warning(f"Installation validation failed for client {client_id}: {e}")
                        installation_valid = False
            
            return CredentialHealthStatus(
                is_valid=True,
                installation_valid=installation_valid,
                last_checked=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Credential health check failed for client {client_id}: {e}")
            return CredentialHealthStatus(
                is_valid=False,
                error_message=f"Health check failed: {str(e)}"
            )
    
    def get_ingestion_metrics(self, client_id: UUID) -> IngestionMetrics:
        """Calculate ingestion metrics for a client."""
        try:
            repos = self.session.exec(
                select(ConnectedRepository).where(
                    ConnectedRepository.client_id == client_id
                )
            ).all() or []
            
            total_repos = len(repos)
            successful = sum(1 for r in repos if r.ingestion_status == "success")
            failed = sum(1 for r in repos if r.ingestion_status == "failed")
            pending = sum(1 for r in repos if r.ingestion_status in ["pending", "running"])
            
            # Calculate average ingestion time (mock for now - would need timing data)
            avg_time = None
            last_ingestion = None
            
            if repos:
                # Get the most recent ingestion
                repos_with_ingestion = [r for r in repos if r.last_ingested_at is not None]
                if repos_with_ingestion:
                    repo_with_last_ingestion = max(repos_with_ingestion, key=lambda x: x.last_ingested_at)
                    last_ingestion = repo_with_last_ingestion.last_ingested_at
                    avg_time = 45.0  # Mock average time in seconds
            
            return IngestionMetrics(
                total_repos=total_repos,
                successful_ingestions=successful,
                failed_ingestions=failed,
                pending_ingestions=pending,
                avg_ingestion_time=avg_time,
                last_ingestion=last_ingestion
            )
            
        except Exception as e:
            logger.error(f"Failed to calculate ingestion metrics for client {client_id}: {e}")
            return IngestionMetrics()
    
    async def get_intelligence_report(self, client_id: UUID) -> Dict[str, Any]:
        """
        Generate comprehensive ingestion intelligence report.
        Combines credential health, metrics, and recommendations.
        """
        try:
            # Get credential health
            credential_health = await self.get_credential_health(client_id)
            
            # Get ingestion metrics
            metrics = self.get_ingestion_metrics(client_id)
            
            # Get repository details
            repos = self.session.exec(
                select(ConnectedRepository).where(
                    ConnectedRepository.client_id == client_id
                ).order_by(ConnectedRepository.updated_at.desc())
            ).all() or []
            
            # Generate recommendations
            recommendations = self._generate_recommendations(credential_health, metrics)
            
            # Calculate overall health score
            health_score = self._calculate_health_score(credential_health, metrics)
            
            return {
                "client_id": str(client_id),
                "timestamp": datetime.utcnow().isoformat(),
                "health_score": health_score,
                "credential_health": {
                    "is_valid": credential_health.is_valid,
                    "installation_valid": credential_health.installation_valid,
                    "error_message": credential_health.error_message,
                    "last_checked": credential_health.last_checked.isoformat()
                },
                "metrics": {
                    "total_repositories": metrics.total_repos,
                    "successful_ingestions": metrics.successful_ingestions,
                    "failed_ingestions": metrics.failed_ingestions,
                    "pending_ingestions": metrics.pending_ingestions,
                    "success_rate": round(metrics.success_rate, 2),
                    "avg_ingestion_time_seconds": metrics.avg_ingestion_time,
                    "last_ingestion": metrics.last_ingestion.isoformat() if metrics.last_ingestion else None
                },
                "repositories": [
                    {
                        "id": str(repo.id),
                        "repo_url": repo.repo_url,
                        "default_branch": repo.default_branch,
                        "ingestion_status": repo.ingestion_status,
                        "last_ingested_at": repo.last_ingested_at.isoformat() if repo.last_ingested_at else None,
                        "created_at": repo.created_at.isoformat(),
                        "updated_at": repo.updated_at.isoformat()
                    }
                    for repo in repos
                ],
                "recommendations": recommendations,
                "alerts": self._generate_alerts(credential_health, metrics)
            }
            
        except Exception as e:
            logger.error(f"Failed to generate intelligence report for client {client_id}: {e}")
            return {
                "client_id": str(client_id),
                "timestamp": datetime.utcnow().isoformat(),
                "error": f"Failed to generate report: {str(e)}",
                "health_score": 0,
                "credential_health": {"is_valid": False, "error_message": "Report generation failed"},
                "metrics": {"total_repositories": 0, "success_rate": 0},
                "repositories": [],
                "recommendations": ["Check system logs for errors"],
                "alerts": [{"severity": "error", "message": "Intelligence report generation failed"}]
            }
    
    def _generate_recommendations(self, credential_health: CredentialHealthStatus, 
                                metrics: IngestionMetrics) -> List[str]:
        """Generate actionable recommendations based on current state."""
        recommendations = []
        
        if not credential_health.is_valid:
            recommendations.append("Configure GitHub App credentials in Provider Settings")
            if credential_health.error_message:
                recommendations.append(f"Credential issue: {credential_health.error_message}")
        
        if not credential_health.installation_valid and credential_health.is_valid:
            recommendations.append("Reinstall GitHub App to restore repository access")
        
        if metrics.success_rate < 80:
            recommendations.append("Review failed ingestion logs and fix configuration issues")
        
        if metrics.pending_ingestions > 0:
            recommendations.append(f"Monitor {metrics.pending_ingestions} pending ingestion(s)")
        
        if metrics.total_repos == 0:
            recommendations.append("Connect repositories to start monitoring ingestion")
        
        if not recommendations:
            recommendations.append("All systems operating normally")
        
        return recommendations
    
    def _generate_alerts(self, credential_health: CredentialHealthStatus, 
                        metrics: IngestionMetrics) -> List[Dict[str, str]]:
        """Generate alerts for critical issues."""
        alerts = []
        
        if not credential_health.is_valid:
            alerts.append({
                "severity": "error",
                "message": "GitHub App credentials are invalid or missing"
            })
        
        if credential_health.is_valid and not credential_health.installation_valid:
            alerts.append({
                "severity": "warning", 
                "message": "GitHub App installation is invalid - repository access limited"
            })
        
        if metrics.failed_ingestions > metrics.successful_ingestions:
            alerts.append({
                "severity": "error",
                "message": "High failure rate detected in ingestion operations"
            })
        
        return alerts
    
    def _calculate_health_score(self, credential_health: CredentialHealthStatus, 
                              metrics: IngestionMetrics) -> int:
        """Calculate overall health score (0-100)."""
        score = 0
        
        # Credential health (40 points)
        if credential_health.is_valid:
            score += 20
            if credential_health.installation_valid:
                score += 20
        
        # Ingestion success rate (40 points)
        if metrics.total_repos > 0:
            score += int((metrics.successful_ingestions / metrics.total_repos) * 40)
        else:
            score += 20  # Neutral score for no repos
        
        # Recent activity (20 points)
        if metrics.last_ingestion:
            days_since_last = (datetime.utcnow() - metrics.last_ingestion).days
            if days_since_last <= 1:
                score += 20
            elif days_since_last <= 7:
                score += 15
            elif days_since_last <= 30:
                score += 10
            else:
                score += 5
        
        return min(100, max(0, score))
