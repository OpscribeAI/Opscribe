import boto3
from typing import List
from .base import BaseDetector
from ..schemas import DiscoveryResult, DiscoveryNode, DiscoveryEdge

class AWSDetector(BaseDetector):
    def __init__(self, region_name: str = "us-east-1"):
        self.region_name = region_name

    @property
    def source_name(self) -> str:
        return "aws"

    async def discover(self, **kwargs) -> DiscoveryResult:
        nodes: List[DiscoveryNode] = []
        edges: List[DiscoveryEdge] = []
        
        # 1. Discover EC2 Instances
        ec2 = boto3.client("ec2", region_name=self.region_name)
        instances = ec2.describe_instances()
        
        for reservation in instances.get("Reservations", []):
            for instance in reservation.get("Instances", []):
                instance_id = instance["InstanceId"]
                name = next((t["Value"] for t in instance.get("Tags", []) if t["Key"] == "Name"), instance_id)
                
                nodes.append(DiscoveryNode(
                    key=instance_id,
                    display_name=name,
                    node_type="host",
                    properties={
                        "instance_type": instance["InstanceType"],
                        "state": instance["State"]["Name"],
                        "private_ip": instance.get("PrivateIpAddress")
                    },
                    source_metadata={"arn": f"arn:aws:ec2:{self.region_name}:{instance.get('OwnerId')}:instance/{instance_id}"}
                ))

        # 2. Discover RDS Instances
        rds = boto3.client("rds", region_name=self.region_name)
        db_instances = rds.describe_db_instances()
        
        for db in db_instances.get("DBInstances", []):
            db_id = db["DBInstanceIdentifier"]
            nodes.append(DiscoveryNode(
                key=db_id,
                display_name=db_id,
                node_type="datastore",
                properties={
                    "engine": db["Engine"],
                    "status": db["DBInstanceStatus"],
                    "endpoint": db.get("Endpoint", {}).get("Address")
                },
                source_metadata={"arn": db["DBInstanceArn"]}
            ))

        # 3. Infer Dependencies (Very simple heuristic for now)
        # In a real implementation, we'd look at security groups, environment variables, etc.
        
        return DiscoveryResult(
            source=self.source_name,
            nodes=nodes,
            edges=edges,
            metadata={"region": self.region_name}
        )
