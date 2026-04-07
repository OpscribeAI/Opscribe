#SAMPLE GRAPH THAT I TOLD GEMINI TO MAKE FOR TESTING

import os
import sys
import uuid
from sqlmodel import Session, create_engine, select

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from apps.api.models import Client, Graph, Node, Edge, NodeType, EdgeType
from apps.api.database import engine

def seed_devops_graph():
    with Session(engine) as session:
        # 1. Get the real client (the one with auth0_sub)
        client = session.exec(select(Client).where(Client.name == "Personal Organization")).first()
        if not client:
            # Fallback to any client
            client = session.exec(select(Client)).first()
        
        if not client:
            client = Client(name="Demo Organization")
            session.add(client)
            session.commit()
            session.refresh(client)
        
        print(f"Using Client: {client.name} ({client.id})")

        # 2. Create the graph
        graph = Graph(
            client_id=client.id,
            name="DevOps Deployment Workflow",
            description="End-to-end flow from Git commit to S3/CloudFront delivery."
        )
        session.add(graph)
        session.commit()
        session.refresh(graph)
        print(f"Created Graph: {graph.name} ({graph.id})")

        # 3. Create basic types
        node_type = NodeType(
            client_id=client.id,
            graph_id=graph.id,
            name="Infrastructure",
            category="core"
        )
        edge_type = EdgeType(
            client_id=client.id,
            graph_id=graph.id,
            name="connects"
        )
        session.add(node_type)
        session.add(edge_type)
        session.commit()
        session.refresh(node_type)
        session.refresh(edge_type)

        # 4. Define Nodes
        nodes_data = [
            {"key": "dev_git", "label": "Developer (Git Flow)", "icon": "User", "category": "user"},
            {"key": "github_repo", "label": "GitHub Repository", "icon": "Github", "category": "vcs", "properties": {"url": "https://github.com/org/app"}},
            {"key": "cicd_runner", "label": "CI/CD Runner", "icon": "Zap", "category": "automation", "properties": {"tool": "GitHub Actions"}},
            {"key": "iam_role", "label": "IAM Role (OIDC)", "icon": "ShieldCheck", "category": "security", "properties": {"policy": "S3FullAccess"}},
            {"key": "s3_bucket", "label": "S3 Bucket", "icon": "Database", "category": "storage", "properties": {"name": "app-assets-prod", "region": "us-east-1"}},
            {"key": "cloudfront", "label": "CloudFront CDN", "icon": "Globe", "category": "network", "properties": {"distribution_id": "E2FXXXXXXXX"}},
            {"key": "end_user", "label": "End User (Browser)", "icon": "Users", "category": "consumer"}
        ]

        created_nodes = {}
        for i, nd in enumerate(nodes_data):
            node = Node(
                client_id=client.id,
                graph_id=graph.id,
                node_type_id=node_type.id,
                key=nd["key"],
                display_name=nd["label"],
                properties={
                    "label": nd["label"],
                    "icon": nd["icon"],
                    "category": nd["category"],
                    "position": {"x": 100 + i * 250, "y": 200},
                    **(nd.get("properties", {}))
                },
                source="seed"
            )
            session.add(node)
            created_nodes[nd["key"]] = node

        session.commit()
        for node in created_nodes.values():
            session.refresh(node)

        # 5. Define Edges
        edges_data = [
            ("dev_git", "github_repo"),
            ("github_repo", "cicd_runner"),
            ("cicd_runner", "iam_role"),
            ("cicd_runner", "s3_bucket"),
            ("s3_bucket", "cloudfront"),
            ("cloudfront", "end_user")
        ]

        for source_key, target_key in edges_data:
            edge = Edge(
                client_id=client.id,
                graph_id=graph.id,
                edge_type_id=edge_type.id,
                from_node_id=created_nodes[source_key].id,
                to_node_id=created_nodes[target_key].id,
                properties={}
            )
            session.add(edge)

        session.commit()
        print("Successfully seeded DevOps Deployment Workflow graph.")

if __name__ == "__main__":
    seed_devops_graph()
