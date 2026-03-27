import json
import logging
import os
from typing import List, Dict, Optional, Any

import hcl2
from ruamel.yaml import YAML

from apps.api.ingestors.github.models import InfrastructureSignal

logger = logging.getLogger(__name__)

DEPENDENCY_MAPPING: Dict[str, str] = {
    "redis": "Cache",
    "redis-py": "Cache",
    "ioredis": "Cache",
    "memcached": "Cache",
    "postgresql": "Database",
    "mongodb": "Database",
    "mysql": "Database",
    "mariadb": "Database",
    "mongoose": "Database",
    "sequelize": "Database",
    "sqlalchemy": "Database",
    "pg": "Database",
    "psycopg2": "Database",
    "mysql2": "Database",
    "celery": "Worker",
    "rq": "Worker",
    "bull": "Worker",
    "amqplib": "Queue",
    "pika": "Queue",
    "kafkajs": "Queue",
    "confluent-kafka": "Queue",
    "aws-sdk": "Cloud-Service",
    "boto3": "Cloud-Service",
    "@aws-sdk/client-s3": "Storage",
    "@google-cloud/storage": "Storage",
    "firebase-admin": "Cloud-Service",
}

class IaCParser:
    """Parses explicit Infrastructure-as-Code (IaC) files like Terraform, Kubernetes, and Docker Compose."""
    
    def __init__(self) -> None:
        self.yaml = YAML(typ="safe")
        
    def parse_terraform(self, file_path: str, content: str) -> List[InfrastructureSignal]:
        signals: List[InfrastructureSignal] = []
        try:
            parsed = hcl2.loads(content)
            resources = parsed.get("resource", [])
            for res_block in resources:
                for res_type, res_mapping in res_block.items():
                    for res_name, res_config in res_mapping.items():
                        component_type = self._map_tf_type_to_component(res_type)
                        if component_type:
                            signals.append(
                                InfrastructureSignal(
                                    component_type=component_type,
                                    name=res_name,
                                    config={"resource_type": res_type, **res_config},
                                    source_location=file_path,
                                    confidence_score=1.0,
                                )
                            )
        except Exception as e:
            logger.warning(f"Failed to parse Terraform file %s: %s", file_path, e)
        return signals

    def parse_kubernetes(self, file_path: str, content: str) -> List[InfrastructureSignal]:
        signals: List[InfrastructureSignal] = []
        try:
            docs = list(self.yaml.load_all(content))
            for doc in docs:
                if not doc or not isinstance(doc, dict):
                    continue
                
                kind = doc.get("kind")
                metadata = doc.get("metadata", {})
                name = metadata.get("name", "unknown")
                
                if kind in ("Deployment", "StatefulSet", "DaemonSet", "Job"):
                    signals.append(InfrastructureSignal(
                        component_type="Compute",
                        name=name,
                        config={"kind": kind, "api_version": doc.get("apiVersion")},
                        source_location=file_path,
                        confidence_score=1.0
                    ))
                elif kind == "Service":
                    signals.append(InfrastructureSignal(
                        component_type="API",
                        name=name,
                        config={"kind": kind, "service_type": doc.get("spec", {}).get("type")},
                        source_location=file_path,
                        confidence_score=0.9
                    ))
                elif kind == "Ingress":
                    signals.append(InfrastructureSignal(
                        component_type="API",
                        name=name,
                        config={"kind": kind, "rules": doc.get("spec", {}).get("rules")},
                        source_location=file_path,
                        confidence_score=1.0
                    ))
        except Exception as e:
            logger.warning(f"Failed to parse Kubernetes file %s: %s", file_path, e)
        return signals

    def parse_github_actions(self, file_path: str, content: str) -> List[InfrastructureSignal]:
        signals: List[InfrastructureSignal] = []
        try:
            parsed = self.yaml.load(content)
            if not parsed or not isinstance(parsed, dict):
                return signals
                
            name = parsed.get("name", os.path.basename(file_path))
            jobs = parsed.get("jobs", {})
            
            signals.append(InfrastructureSignal(
                component_type="Worker",
                name=f"workflow-{name}",
                config={"job_count": len(jobs), "triggers": list(parsed.get("on", {}).keys() if isinstance(parsed.get("on"), dict) else [str(parsed.get("on"))])},
                source_location=file_path,
                confidence_score=0.7
            ))
        except Exception as e:
            logger.warning(f"Failed to parse GitHub Actions file %s: %s", file_path, e)
        return signals

    def parse_compose(self, file_path: str, content: str) -> List[InfrastructureSignal]:
        signals: List[InfrastructureSignal] = []
        try:
            parsed = self.yaml.load(content)
            if not parsed or not isinstance(parsed, dict):
                return signals
                
            services = parsed.get("services", {})
            for svc_name, svc_config in services.items():
                image = svc_config.get("image", "")
                component_type = self._map_image_to_component(image) or "Compute"
                
                signals.append(
                    InfrastructureSignal(
                        component_type=component_type,
                        name=svc_name,
                        config=svc_config,
                        source_location=file_path,
                        confidence_score=0.9,
                    )
                )
        except Exception as e:
            logger.warning(f"Failed to parse Docker Compose file %s: %s", file_path, e)
        return signals

    @staticmethod
    def _map_tf_type_to_component(tf_type: str) -> Optional[str]:
        db_types = {"aws_db_instance", "aws_rds_cluster", "google_sql_database_instance", "azurerm_postgresql_server"}
        cache_types = {"aws_elasticache_cluster", "redis_instance"}
        compute_types = {"aws_instance", "aws_ecs_service", "google_compute_instance", "kubernetes_deployment"}
        queue_types = {"aws_sqs_queue", "rabbitmq_vhost", "aws_sns_topic"}
        
        if tf_type in db_types: return "Database"
        if tf_type in cache_types: return "Cache"
        if tf_type in compute_types: return "Compute"
        if tf_type in queue_types: return "Queue"
        
        if tf_type.startswith("aws_s3") or tf_type.startswith("google_storage"): return "Storage"
        return "Resource"

    @staticmethod
    def _map_image_to_component(image: str) -> Optional[str]:
        if not image:
            return None
        img_lower = str(image).lower()
        if any(x in img_lower for x in ["postgres", "mysql", "mongo", "mariadb"]):
            return "Database"
        if "redis" in img_lower or "memcached" in img_lower:
            return "Cache"
        if "rabbitmq" in img_lower or "kafka" in img_lower:
            return "Queue"
        return None

class DependencyParser:
    """Parses application manifests and config files to infer infrastructure needs."""
    
    def parse_package_json(self, file_path: str, content: str) -> List[InfrastructureSignal]:
        signals: List[InfrastructureSignal] = []
        try:
            data = json.loads(content)
            deps = data.get("dependencies", {})
            dev_deps = data.get("devDependencies", {})
            
            all_deps = {**deps, **dev_deps}
            for pkg, version in all_deps.items():
                component_type = self._check_mapping(pkg)
                if component_type:
                    signals.append(
                        InfrastructureSignal(
                            component_type=component_type,
                            name=f"dep-{pkg}",
                            config={"package": pkg, "version": version},
                            source_location=file_path,
                            confidence_score=0.8,
                        )
                    )
        except Exception as e:
            logger.warning(f"Failed to parse package.json %s: %s", file_path, e)
        return signals

    def parse_requirements_txt(self, file_path: str, content: str) -> List[InfrastructureSignal]:
        signals: List[InfrastructureSignal] = []
        try:
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                
                # Extract base package name ignoring version specifiers
                pkg = line.split("==")[0].split(">=")[0].split("<=")[0].split("~=")[0].strip()
                
                component_type = self._check_mapping(pkg)
                if component_type:
                    signals.append(
                        InfrastructureSignal(
                            component_type=component_type,
                            name=f"dep-{pkg}",
                            config={"package": pkg, "raw_line": line},
                            source_location=file_path,
                            confidence_score=0.8,
                        )
                    )
        except Exception as e:
            logger.warning(f"Failed to parse requirements.txt %s: %s", file_path, e)
        return signals

    def parse_env_file(self, file_path: str, content: str) -> List[InfrastructureSignal]:
        """Identify potential infrastructure dependencies from environment variable keys."""
        signals: List[InfrastructureSignal] = []
        try:
            lines = content.splitlines()
            for line in lines:
                if "=" not in line or line.startswith("#"):
                    continue
                key = line.split("=")[0].strip().upper()
                
                if any(x in key for x in ["DATABASE_URL", "DB_HOST", "POSTGRES"]):
                    signals.append(InfrastructureSignal("Database", f"env-{key}", {"variable": key}, file_path, 0.6))
                elif any(x in key for x in ["REDIS", "CACHE_HOST"]):
                    signals.append(InfrastructureSignal("Cache", f"env-{key}", {"variable": key}, file_path, 0.6))
                elif any(x in key for x in ["AWS_S3", "BUCKET_NAME", "STORAGE"]):
                    signals.append(InfrastructureSignal("Storage", f"env-{key}", {"variable": key}, file_path, 0.6))
                elif any(x in key for x in ["STRIPE", "SENDGRID", "TWILIO"]):
                    signals.append(InfrastructureSignal("Cloud-Service", f"env-{key}", {"variable": key}, file_path, 0.6))
        except Exception:
            pass
        return signals

    @staticmethod
    def _check_mapping(package_name: str) -> Optional[str]:
        pkg_lower = package_name.lower()
        if pkg_lower in DEPENDENCY_MAPPING:
            return DEPENDENCY_MAPPING[pkg_lower]
        for known_pkg, component_type in DEPENDENCY_MAPPING.items():
            if known_pkg in pkg_lower:
                return component_type
        return None
