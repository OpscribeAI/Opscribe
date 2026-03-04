# Testing AWS Service Detection - Complete Guide for Students

This guide will walk you through how to test the AWS service detection system in real-time against your actual AWS infrastructure. You'll learn how services are discovered, how relationships are detected, and how to debug the process.

## Table of Contents

1. [Prerequisites & Setup](#prerequisites--setup)
2. [Quick Start](#quick-start)
3. [Testing Individual Services](#testing-individual-services)
4. [Understanding the Detection](#understanding-the-detection)
5. [Troubleshooting](#troubleshooting)
6. [Full End-to-End Workflow](#full-end-to-end-workflow)

---

## Prerequisites & Setup

### What You'll Need

1. **AWS Account** - Any AWS account (free tier works!)
2. **AWS Credentials** - Access key ID and secret access key
3. **Python 3.9+** - Already installed in this project
4. **boto3** - AWS SDK for Python (already in requirements.txt)

### Step 1: Configure AWS Credentials

There are several ways to provide AWS credentials to the detector. Here's the easiest method:

#### Option A: AWS Credentials File (Recommended for Development)

Create a file at `~/.aws/credentials`:

```ini
[default]
aws_access_key_id = YOUR_ACCESS_KEY_HERE
aws_secret_access_key = YOUR_SECRET_KEY_HERE

[production]
aws_access_key_id = YOUR_PROD_ACCESS_KEY
aws_secret_access_key = YOUR_PROD_SECRET_KEY
```

Create a file at `~/.aws/config`:

```ini
[default]
region = us-east-1

[production]
region = us-east-1
```

#### Option B: Environment Variables

```bash
export AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="YOUR_SECRET_KEY"
export AWS_DEFAULT_REGION="us-east-1"
```

#### Option C: In Python Code (Not Recommended for Production)

```python
import os
os.environ['AWS_ACCESS_KEY_ID'] = 'your_key'
os.environ['AWS_SECRET_ACCESS_KEY'] = 'your_secret'
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
```

### Step 2: Verify Credentials Work

```bash
# In the project root
python3 << 'EOF'
import boto3
sts = boto3.client('sts')
identity = sts.get_caller_identity()
print(f"✓ Successfully authenticated as Account: {identity['Account']}")
print(f"✓ User/Role: {identity['Arn']}")
EOF
```

If you see the account details, you're good to go! ✓

---

## Quick Start

### The Simplest Test - Detect EC2 Instances

Create a test file called `test_detection.py` in the `apps/api/` directory:

```python
import asyncio
from infrastructure.discovery.detectors.aws import AWSDetector

async def main():
    # Create a detector for us-east-1 (change region as needed)
    detector = AWSDetector(region_name="us-east-1")
    
    # Run discovery
    print("🔍 Discovering AWS resources...")
    result = await detector.discover()
    
    # Print results
    print(f"\n✓ Found {len(result.nodes)} resources")
    print(f"✓ Found {len(result.edges)} relationships\n")
    
    # Show EC2 instances
    ec2_nodes = [n for n in result.nodes if n.properties.get("service") == "EC2"]
    print(f"EC2 Instances ({len(ec2_nodes)}):")
    for node in ec2_nodes:
        print(f"  - {node.display_name} ({node.properties.get('instance_type')})")
        print(f"    IP: {node.properties.get('private_ip')}")
        print(f"    State: {node.properties.get('state')}")
    
    # Show databases
    db_nodes = [n for n in result.nodes if n.properties.get("service") in ["RDS", "DynamoDB", "Redshift"]]
    print(f"\nDatabases ({len(db_nodes)}):")
    for node in db_nodes:
        print(f"  - {node.display_name} ({node.properties.get('service')})")
    
    # Show relationships
    print(f"\nRelationships ({len(result.edges)}):")
    for edge in result.edges[:5]:  # Show first 5
        print(f"  - {edge.from_node_key} --{edge.edge_type}--> {edge.to_node_key}")

if __name__ == "__main__":
    asyncio.run(main())
```

Run it:

```bash
cd /Users/rohannair/Desktop/Shenanigans/Opscribe
python3 apps/api/test_detection.py
```

---

## Testing Individual Services

The `AWSDetector` has separate methods for each service type. You can test them independently!

### Test 1: Discover EC2 Instances Only

```python
import asyncio
from infrastructure.discovery.detectors.aws import AWSDetector

async def test_ec2():
    detector = AWSDetector(region_name="us-east-1")
    
    print("🔍 Discovering EC2 Instances...")
    nodes = detector._discover_ec2()
    
    print(f"✓ Found {len(nodes)} EC2 instances\n")
    
    for node in nodes:
        print(f"Instance: {node.display_name}")
        print(f"  ID: {node.key}")
        print(f"  Type: {node.properties.get('instance_type')}")
        print(f"  State: {node.properties.get('state')}")
        print(f"  Private IP: {node.properties.get('private_ip')}")
        print(f"  VPC: {node.properties.get('vpc_id')}")
        print()

if __name__ == "__main__":
    asyncio.run(test_ec2())
```

### Test 2: Discover Databases

```python
import asyncio
from infrastructure.discovery.detectors.aws import AWSDetector

async def test_databases():
    detector = AWSDetector(region_name="us-east-1")
    
    print("🔍 Discovering RDS Instances...")
    rds_nodes = detector._discover_rds()
    print(f"✓ Found {len(rds_nodes)} RDS/Aurora instances\n")
    for node in rds_nodes:
        print(f"Database: {node.display_name}")
        print(f"  Engine: {node.properties.get('engine')}")
        print(f"  Status: {node.properties.get('status')}")
        print(f"  Endpoint: {node.properties.get('endpoint')}")
        print()
    
    print("🔍 Discovering DynamoDB Tables...")
    dynamo_nodes = detector._discover_dynamodb()
    print(f"✓ Found {len(dynamo_nodes)} DynamoDB tables\n")
    for node in dynamo_nodes:
        print(f"Table: {node.display_name}")
        print(f"  Item Count: {node.properties.get('item_count')}")
        print(f"  Size: {node.properties.get('size_bytes')} bytes")
        print()
    
    print("🔍 Discovering Redshift Clusters...")
    redshift_nodes = detector._discover_redshift()
    print(f"✓ Found {len(redshift_nodes)} Redshift clusters\n")
    for node in redshift_nodes:
        print(f"Cluster: {node.display_name}")
        print(f"  Nodes: {node.properties.get('number_of_nodes')}")
        print(f"  Status: {node.properties.get('status')}")
        print()

if __name__ == "__main__":
    asyncio.run(test_databases())
```

### Test 3: Discover Lambda Functions

```python
import asyncio
from infrastructure.discovery.detectors.aws import AWSDetector

async def test_lambda():
    detector = AWSDetector(region_name="us-east-1")
    
    print("🔍 Discovering Lambda Functions...")
    nodes = detector._discover_lambda()
    print(f"✓ Found {len(nodes)} Lambda functions\n")
    
    for node in nodes:
        print(f"Function: {node.display_name}")
        print(f"  Runtime: {node.properties.get('runtime')}")
        print(f"  Memory: {node.properties.get('memory_size')} MB")
        print(f"  Timeout: {node.properties.get('timeout')}s")
        print(f"  Handler: {node.properties.get('handler')}")
        if node.properties.get('vpc_id'):
            print(f"  VPC: {node.properties.get('vpc_id')}")
        print()

if __name__ == "__main__":
    asyncio.run(test_lambda())
```

### Test 4: Discover Storage Services

```python
import asyncio
from infrastructure.discovery.detectors.aws import AWSDetector

async def test_storage():
    detector = AWSDetector(region_name="us-east-1")
    
    print("🔍 Discovering S3 Buckets...")
    s3_nodes = detector._discover_s3()
    print(f"✓ Found {len(s3_nodes)} S3 buckets\n")
    for node in s3_nodes:
        print(f"Bucket: {node.display_name}")
        print(f"  Creation: {node.properties.get('creation_date')}")
        print()
    
    print("🔍 Discovering EBS Volumes...")
    ebs_nodes = detector._discover_ebs()
    print(f"✓ Found {len(ebs_nodes)} EBS volumes\n")
    for node in ebs_nodes:
        print(f"Volume: {node.display_name}")
        print(f"  Size: {node.properties.get('size')} GB")
        print(f"  Type: {node.properties.get('volume_type')}")
        print(f"  State: {node.properties.get('state')}")
        print()
    
    print("🔍 Discovering EFS File Systems...")
    efs_nodes = detector._discover_efs()
    print(f"✓ Found {len(efs_nodes)} EFS file systems\n")
    for node in efs_nodes:
        print(f"File System: {node.display_name}")
        print(f"  Size: {node.properties.get('size_bytes')} bytes")
        print()

if __name__ == "__main__":
    asyncio.run(test_storage())
```

### Test 5: Discover Networking

```python
import asyncio
from infrastructure.discovery.detectors.aws import AWSDetector

async def test_networking():
    detector = AWSDetector(region_name="us-east-1")
    
    print("🔍 Discovering VPCs...")
    vpc_nodes = detector._discover_vpc()
    print(f"✓ Found {len(vpc_nodes)} VPCs\n")
    for node in vpc_nodes:
        print(f"VPC: {node.display_name}")
        print(f"  CIDR: {node.properties.get('cidr_block')}")
        print(f"  State: {node.properties.get('state')}")
        print()
    
    print("🔍 Discovering Load Balancers...")
    lb_nodes = detector._discover_load_balancers()
    print(f"✓ Found {len(lb_nodes)} Load Balancers\n")
    for node in lb_nodes:
        print(f"Load Balancer: {node.display_name}")
        print(f"  Type: {node.properties.get('load_balancer_type')}")
        print(f"  DNS: {node.properties.get('dns_name')}")
        print()
    
    print("🔍 Discovering CloudFront Distributions...")
    cf_nodes = detector._discover_cloudfront()
    print(f"✓ Found {len(cf_nodes)} CloudFront distributions\n")
    for node in cf_nodes:
        print(f"Distribution: {node.display_name}")
        print(f"  Enabled: {node.properties.get('enabled')}")
        print(f"  Status: {node.properties.get('status')}")
        print()

if __name__ == "__main__":
    asyncio.run(test_networking())
```

### Test 6: Discover Observability Services

```python
import asyncio
from infrastructure.discovery.detectors.aws import AWSDetector

async def test_observability():
    detector = AWSDetector(region_name="us-east-1")
    
    print("🔍 Discovering CloudWatch Log Groups...")
    log_nodes = detector._discover_cloudwatch()
    print(f"✓ Found {len(log_nodes)} Log Groups\n")
    for node in log_nodes[:5]:  # Show first 5
        print(f"Log Group: {node.display_name}")
        print(f"  Retention: {node.properties.get('retention_in_days')} days")
        print()
    
    print("🔍 Discovering CloudTrail Trails...")
    trail_nodes = detector._discover_cloudtrail()
    print(f"✓ Found {len(trail_nodes)} CloudTrail trails\n")
    for node in trail_nodes:
        print(f"Trail: {node.display_name}")
        print(f"  S3 Bucket: {node.properties.get('s3_bucket_name')}")
        print(f"  Multi-Region: {node.properties.get('is_multi_region_trail')}")
        print()

if __name__ == "__main__":
    asyncio.run(test_observability())
```

### Test 7: Discover Integration Services

```python
import asyncio
from infrastructure.discovery.detectors.aws import AWSDetector

async def test_integration():
    detector = AWSDetector(region_name="us-east-1")
    
    print("🔍 Discovering SQS Queues...")
    sqs_nodes = detector._discover_sqs()
    print(f"✓ Found {len(sqs_nodes)} SQS queues\n")
    for node in sqs_nodes:
        print(f"Queue: {node.display_name}")
        print()
    
    print("🔍 Discovering SNS Topics...")
    sns_nodes = detector._discover_sns()
    print(f"✓ Found {len(sns_nodes)} SNS topics\n")
    for node in sns_nodes:
        print(f"Topic: {node.display_name}")
        print()
    
    print("🔍 Discovering EventBridge Rules...")
    eb_nodes = detector._discover_eventbridge()
    print(f"✓ Found {len(eb_nodes)} EventBridge rules\n")
    for node in eb_nodes:
        print(f"Rule: {node.display_name}")
        print(f"  State: {node.properties.get('state')}")
        print()
    
    print("🔍 Discovering API Gateway APIs...")
    api_nodes = detector._discover_api_gateway()
    print(f"✓ Found {len(api_nodes)} API Gateway APIs\n")
    for node in api_nodes:
        print(f"API: {node.display_name}")
        print(f"  Type: {node.properties.get('protocol')}")
        print()

if __name__ == "__main__":
    asyncio.run(test_integration())
```

---

## Understanding the Detection

### What Gets Discovered?

The detector finds **7 categories** of AWS services:

| Category | Services | Node Type |
|----------|----------|-----------|
| **Compute** | EC2, Lambda, ECS, EKS | `compute` |
| **Storage** | S3, EBS, EFS, FSx | `storage` |
| **Databases** | RDS, Aurora, DynamoDB, Redshift | `datastore` |
| **Networking** | VPC, ELB/ALB, CloudFront, Direct Connect | `network` |
| **Security** | IAM, KMS, Secrets Manager, Directory Service | `security` |
| **Observability** | CloudWatch, CloudTrail, Systems Manager | `observability` |
| **Integration** | SQS, SNS, EventBridge, API Gateway | `integration` |

### The Node Structure

Every discovered resource becomes a `DiscoveryNode` with this structure:

```python
DiscoveryNode(
    key="service:resource-id",              # Unique identifier
    display_name="Human readable name",     # What to show on UI
    node_type="compute",                    # Category type
    properties={                             # Service-specific details
        "service": "EC2",
        "instance_type": "t3.medium",
        "state": "running",
        # ... service-specific fields
    },
    source_metadata={                        # AWS metadata
        "arn": "arn:aws:ec2:..."
    }
)
```

### The Edge Structure

Relationships between services are `DiscoveryEdge`:

```python
DiscoveryEdge(
    from_node_key="ec2:i-123",           # Source resource
    to_node_key="ebs:vol-456",           # Target resource
    edge_type="uses",                     # Type of relationship
    properties={
        "relationship": "storage_attachment"
    }
)
```

### Current Relationship Detection

The system automatically detects these relationships:

1. **EC2 → EBS** (via attachment)
2. **Lambda → VPC** (via VPC assignment)
3. **VPC → EC2** (via membership)
4. **Load Balancer → EC2** (via same VPC)
5. **CloudFront → S3** (via origins)

---

## Troubleshooting

### Issue 1: "InvalidClientTokenId" or "SignatureDoesNotMatch"

**Cause:** AWS credentials are wrong or expired

**Solution:**
```bash
# Check your credentials
cat ~/.aws/credentials

# Or verify environment variables
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
```

### Issue 2: "An error occurred (UnauthorizedOperation)"

**Cause:** Your AWS user/role doesn't have permission for that service

**Solution:** Add these permissions to your IAM user:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:Describe*",
                "rds:Describe*",
                "dynamodb:List*",
                "s3:List*",
                "lambda:List*",
                "ecs:List*",
                "eks:List*",
                "elasticfilesystem:Describe*",
                "fsx:Describe*",
                "redshift:Describe*",
                "elbv2:Describe*",
                "cloudfront:List*",
                "directconnect:Describe*",
                "iam:List*",
                "kms:List*",
                "secretsmanager:List*",
                "ds:Describe*",
                "logs:Describe*",
                "cloudtrail:Describe*",
                "ssm:Describe*",
                "sqs:List*",
                "sns:List*",
                "events:List*",
                "apigateway:Get*",
                "sts:GetCallerIdentity"
            ],
            "Resource": "*"
        }
    ]
}
```

### Issue 3: "No resources found" even though you have AWS resources

**Cause:** Detector is looking in the wrong region

**Solution:**
```python
# Specify the correct region
detector = AWSDetector(region_name="eu-west-1")  # Change to your region
```

### Issue 4: "botocore.exceptions.ClientError: An error occurred..."

**Solution:** Check which specific API call failed:

```python
import logging
logging.basicConfig(level=logging.DEBUG)  # See detailed logs

# Then run the detector
detector = AWSDetector(region_name="us-east-1")
result = await detector.discover()
```

---

## Full End-to-End Workflow

Here's a complete example that demonstrates the full workflow:

```python
import asyncio
import json
from infrastructure.discovery.detectors.aws import AWSDetector

async def comprehensive_discovery():
    """
    Complete end-to-end discovery and analysis workflow.
    Great for understanding your entire infrastructure.
    """
    
    # Initialize the detector
    detector = AWSDetector(region_name="us-east-1")
    
    print("=" * 60)
    print("AWS INFRASTRUCTURE DISCOVERY & ANALYSIS")
    print("=" * 60)
    
    # Step 1: Get account info
    account_id = detector._get_account_id()
    print(f"\n📦 AWS Account: {account_id}")
    print(f"📍 Region: {detector.region_name}")
    
    # Step 2: Run full discovery
    print("\n🔍 Starting comprehensive discovery...\n")
    result = await detector.discover()
    
    # Step 3: Analyze results
    print(f"✓ Discovered {len(result.nodes)} total resources")
    print(f"✓ Detected {len(result.edges)} relationships\n")
    
    # Step 4: Group resources by service category
    by_service = {}
    for node in result.nodes:
        service = node.properties.get("service", "Unknown")
        if service not in by_service:
            by_service[service] = []
        by_service[service].append(node)
    
    # Step 5: Display organized results
    print("=" * 60)
    print("RESOURCES BY SERVICE")
    print("=" * 60)
    
    for service in sorted(by_service.keys()):
        nodes = by_service[service]
        print(f"\n{service} ({len(nodes)} resources):")
        print("-" * 40)
        
        for node in nodes:
            print(f"  • {node.display_name}")
            
            # Show key properties
            if service == "EC2":
                print(f"    Type: {node.properties.get('instance_type')}")
                print(f"    State: {node.properties.get('state')}")
                print(f"    IP: {node.properties.get('private_ip')}")
            
            elif service == "Lambda":
                print(f"    Runtime: {node.properties.get('runtime')}")
                print(f"    Memory: {node.properties.get('memory_size')} MB")
            
            elif service in ["RDS", "Aurora"]:
                print(f"    Engine: {node.properties.get('engine')}")
                print(f"    Status: {node.properties.get('status')}")
            
            elif service == "S3":
                print(f"    Created: {node.properties.get('creation_date')}")
            
            elif service == "DynamoDB":
                print(f"    Items: {node.properties.get('item_count')}")
                print(f"    Size: {node.properties.get('size_bytes')} bytes")
    
    # Step 6: Analyze relationships
    print(f"\n{'=' * 60}")
    print("RESOURCE RELATIONSHIPS")
    print("=" * 60)
    
    if result.edges:
        # Group by edge type
        by_edge_type = {}
        for edge in result.edges:
            edge_type = edge.edge_type
            if edge_type not in by_edge_type:
                by_edge_type[edge_type] = []
            by_edge_type[edge_type].append(edge)
        
        for edge_type in sorted(by_edge_type.keys()):
            edges = by_edge_type[edge_type]
            print(f"\n{edge_type.upper()} ({len(edges)} relationships):")
            print("-" * 40)
            
            for edge in edges[:5]:  # Show first 5
                from_service = edge.from_node_key.split(":")[0].upper()
                to_service = edge.to_node_key.split(":")[0].upper()
                print(f"  {from_service} → {to_service}")
            
            if len(edges) > 5:
                print(f"  ... and {len(edges) - 5} more")
    else:
        print("\nNo relationships detected yet.")
        print("(Relationships are detected based on explicit connections)")
    
    # Step 7: Generate insights
    print(f"\n{'=' * 60}")
    print("INFRASTRUCTURE INSIGHTS")
    print("=" * 60)
    
    # Count by node type
    by_type = {}
    for node in result.nodes:
        node_type = node.node_type
        if node_type not in by_type:
            by_type[node_type] = 0
        by_type[node_type] += 1
    
    print("\nResources by category:")
    for node_type in sorted(by_type.keys()):
        count = by_type[node_type]
        print(f"  • {node_type.capitalize()}: {count} resources")
    
    # Total metrics
    total_resources = len(result.nodes)
    total_relationships = len(result.edges)
    print(f"\n📊 Summary:")
    print(f"  Total Resources: {total_resources}")
    print(f"  Total Relationships: {total_relationships}")
    print(f"  Complexity Score: {total_resources + (total_relationships * 2)}")
    
    print(f"\n{'=' * 60}\n")
    
    return result

if __name__ == "__main__":
    asyncio.run(comprehensive_discovery())
```

**Run it:**

```bash
python3 apps/api/test_discovery.py
```

### Expected Output:

```
============================================================
AWS INFRASTRUCTURE DISCOVERY & ANALYSIS
============================================================

📦 AWS Account: 123456789012
📍 Region: us-east-1

🔍 Starting comprehensive discovery...

✓ Discovered 27 total resources
✓ Detected 5 relationships

============================================================
RESOURCES BY SERVICE
============================================================

EC2 (2 resources):
  • web-server-01
    Type: t3.medium
    State: running
    IP: 10.0.0.5
  • db-server-01
    Type: t3.large
    State: running
    IP: 10.0.1.3

Lambda (3 resources):
  • order-processor
    Runtime: python3.11
    Memory: 256 MB
  • user-validator
    Runtime: python3.11
    Memory: 128 MB
...
```

---

## Learning Path for Students

### Week 1: Understand the Basics
- [ ] Configure AWS credentials
- [ ] Run the quick start test
- [ ] Explore individual service tests

### Week 2: Dive Deeper
- [ ] Modify the detector to add a new service
- [ ] Create custom tests for your infrastructure
- [ ] Analyze your infrastructure topology

### Week 3: Real-World Application
- [ ] Add relationship detection for a new service pair
- [ ] Create a visualization of your infrastructure
- [ ] Document your findings

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `apps/api/infrastructure/discovery/detectors/aws.py` | Main detector with all service detection logic |
| `apps/api/infrastructure/discovery/schemas.py` | Data structures for nodes, edges, results |
| `apps/api/infrastructure/discovery/manager.py` | Orchestrates detection and stores results |

---

## Next Steps

Once you've tested the detection system:

1. **Integrate with the API**: Add an endpoint to trigger discovery
2. **Add Database Persistence**: Store detected resources in PostgreSQL
3. **Build the UI**: Visualize the topology on the web frontend
4. **Add Relationship Detection**: Enhance edge detection for more service pairs

---

## Quick Reference: Running Tests

```bash
# Quick test
python3 << 'EOF'
import asyncio
from apps.api.infrastructure.discovery.detectors.aws import AWSDetector

async def test():
    detector = AWSDetector(region_name="us-east-1")
    result = await detector.discover()
    print(f"Found {len(result.nodes)} resources")

asyncio.run(test())
EOF

# Test EC2 only
python3 << 'EOF'
from apps.api.infrastructure.discovery.detectors.aws import AWSDetector

detector = AWSDetector()
nodes = detector._discover_ec2()
print(f"EC2 Instances: {len(nodes)}")
EOF

# Test with specific region
python3 << 'EOF'
import asyncio
from apps.api.infrastructure.discovery.detectors.aws import AWSDetector

async def test():
    detector = AWSDetector(region_name="eu-west-1")
    result = await detector.discover()
    print(f"Found {len(result.nodes)} resources in EU")

asyncio.run(test())
EOF
```

---

## FAQ

**Q: Do I need a paid AWS account?**  
A: No! AWS Free Tier includes most services. Just watch out for S3 data transfer costs if you have large amounts of data.

**Q: Will this modify my AWS resources?**  
A: No! The detector only **reads** information. It never creates, modifies, or deletes resources.

**Q: Can I test multiple regions?**  
A: Yes! Create a detector for each region:
```python
us_detector = AWSDetector(region_name="us-east-1")
eu_detector = AWSDetector(region_name="eu-west-1")
```

**Q: How fast is the discovery?**  
A: Depends on the number of resources. Usually 10-30 seconds for a typical account.

---

Good luck learning! 🚀
