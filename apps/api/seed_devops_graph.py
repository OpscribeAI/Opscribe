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

        # 4. Define Nodes with Strategic Metrics
        nodes_data = [
            # VCS & User
            {"key": "dev_git", "label": "Developer (Git Flow)", "icon": "User", "category": "user", "stability": 100, "debt": 0},
            {"key": "github_repo", "label": "GitHub Repository", "icon": "Github", "category": "vcs", "properties": {"url": "https://github.com/org/app"}, "stability": 98, "debt": 5},
            
            # CI/CD
            {"key": "cicd_runner", "label": "CI/CD Runner", "icon": "Zap", "category": "automation", "properties": {"tool": "GitHub Actions"}, "stability": 85, "debt": 25},
            
            # Security & Auth
            {"key": "iam_role", "label": "IAM Role (OIDC)", "icon": "ShieldCheck", "category": "security", "properties": {"policy": "S3FullAccess"}, "stability": 100, "debt": 2},
            {"key": "auth0", "label": "Auth0 Identity", "icon": "Lock", "category": "security", "stability": 99, "debt": 10},
            {"key": "secrets_mgr", "label": "Secrets Manager", "icon": "Key", "category": "security", "stability": 95, "debt": 15},
            
            # Compute / Microservices
            {"key": "api_gateway", "label": "API Gateway", "icon": "Share2", "category": "networking", "stability": 75, "debt": 40},
            {"key": "auth_service", "label": "Auth Microservice", "icon": "Server", "category": "compute", "stability": 60, "debt": 75},
            {"key": "order_service", "label": "Order Service", "icon": "ShoppingCart", "category": "compute", "stability": 92, "debt": 10},
            
            # Storage & Cache
            {"key": "s3_assets", "label": "S3 Global Assets", "icon": "Archive", "category": "storage", "stability": 99, "debt": 5},
            {"key": "redis_cache", "label": "Redis Store", "icon": "Zap", "category": "database", "stability": 80, "debt": 30},
            {"key": "postgres_db", "label": "PostgreSQL Primary", "icon": "Database", "category": "database", "stability": 88, "debt": 20},
            
            # External Integrations
            {"key": "stripe_api", "label": "Stripe Payments", "icon": "CreditCard", "category": "networking", "stability": 99, "debt": 0},
            
            # Delivery
            {"key": "cloudfront", "label": "CloudFront CDN", "icon": "Globe", "category": "networking", "stability": 95, "debt": 12},
            {"key": "end_user", "label": "End User", "icon": "Users", "category": "consumer", "stability": 100, "debt": 0}
        ]

        created_nodes = {}
        for i, nd in enumerate(nodes_data):
            # Calculate a spiral/grid layout for complexity
            col = i % 4
            row = i // 4
            
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
                    "position": {"x": 100 + col * 350, "y": 100 + row * 250},
                    "stability": nd.get("stability", 80),
                    "tech_debt": nd.get("debt", 20),
                    "criticality": "high" if nd["category"] in ["security", "database", "networking"] else "medium",
                    **(nd.get("properties", {}))
                },
                source="seed"
            )
            session.add(node)
            created_nodes[nd["key"]] = node

        session.commit()
        for node in created_nodes.values():
            session.refresh(node)

        # 5. Define Complex Edges
        edges_data = [
            ("dev_git", "github_repo"),
            ("github_repo", "cicd_runner"),
            ("cicd_runner", "iam_role"),
            ("cicd_runner", "s3_assets"),
            ("cicd_runner", "auth_service"),
            ("cicd_runner", "api_gateway"),
            
            ("api_gateway", "auth_service"),
            ("api_gateway", "order_service"),
            
            ("auth_service", "auth0"),
            ("auth_service", "secrets_mgr"),
            ("auth_service", "postgres_db"),
            
            ("order_service", "redis_cache"),
            ("order_service", "postgres_db"),
            ("order_service", "stripe_api"),
            
            ("s3_assets", "cloudfront"),
            ("api_gateway", "cloudfront"),
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
        print("Successfully seeded High-Complexity Strategic DevOps graph.")

if __name__ == "__main__":
    seed_devops_graph()
