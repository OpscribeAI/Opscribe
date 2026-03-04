# AWS Service Detection - Quick Reference Guide

A student-friendly guide to understanding how the topological mapper detects AWS services.

## 🚀 Getting Started (5 minutes)

### 1. Configure AWS Credentials

**Create `~/.aws/credentials`:**
```ini
[default]
aws_access_key_id = YOUR_KEY_ID
aws_secret_access_key = YOUR_SECRET_KEY
```

**Create `~/.aws/config`:**
```ini
[default]
region = us-east-1
```

### 2. Test Connection

```bash
python3 << 'EOF'
import boto3
sts = boto3.client('sts')
print(f"✓ Account: {sts.get_caller_identity()['Account']}")
EOF
```

### 3. Run Quick Start

```bash
cd /Users/rohannair/Desktop/Shenanigans/Opscribe
python3 apps/api/quickstart.py
```

## 📊 Understanding the Detection System

### Service Categories (7 Types)

```
┌─────────────────────────────────────────────────────┐
│           COMPUTE (compute)                         │
│  EC2 | Lambda | ECS | EKS                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│           STORAGE (storage)                         │
│  S3 | EBS | EFS | FSx                              │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│           DATABASES (datastore)                     │
│  RDS | Aurora | DynamoDB | Redshift                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│           NETWORKING (network)                      │
│  VPC | ELB/ALB | CloudFront | Direct Connect       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│           SECURITY (security)                       │
│  IAM | KMS | Secrets Manager | Directory Service   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│           OBSERVABILITY (observability)             │
│  CloudWatch | CloudTrail | Systems Manager         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│           INTEGRATION (integration)                 │
│  SQS | SNS | EventBridge | API Gateway             │
└─────────────────────────────────────────────────────┘
```

### How Detection Works

1. **AWSDetector** creates boto3 clients for each service
2. Each service has a `_discover_xxx()` method
3. Methods call AWS APIs (read-only!)
4. Results are converted to **DiscoveryNodes**
5. Relationships are detected and converted to **DiscoveryEdges**

### Node Structure

```python
DiscoveryNode(
    key="service:resource-id",           # Unique identifier
    display_name="Human Name",           # Show on UI
    node_type="compute",                 # Category
    properties={                         # Service-specific data
        "service": "EC2",
        "instance_type": "t3.medium",
        "state": "running",
        # ... more fields
    },
    source_metadata={                    # AWS metadata
        "arn": "arn:aws:ec2:..."
    }
)
```

### Edge Structure

```python
DiscoveryEdge(
    from_node_key="ec2:i-123",
    to_node_key="ebs:vol-456",
    edge_type="uses",                # Type of relationship
    properties={"relationship": "..."}
)
```

## 🧪 Testing Options

### Option 1: Quick Start (Simplest)
```bash
python3 apps/api/quickstart.py
```
✓ Runs full discovery once  
✓ Shows summary  
✓ Takes ~30-60 seconds

### Option 2: Interactive Menu
```bash
python3 apps/api/test_interactive.py
```
✓ Menu-driven interface  
✓ Test individual services  
✓ Great for learning

### Option 3: Custom Scripts
See `TESTING_AWS_DETECTION.md` for detailed examples of testing individual services.

### Option 4: Direct Python
```python
import asyncio
from infrastructure.discovery.detectors.aws import AWSDetector

async def test():
    detector = AWSDetector(region_name="us-east-1")
    nodes = detector._discover_ec2()  # Test EC2 only
    print(f"Found {len(nodes)} EC2 instances")

asyncio.run(test())
```

## 🔍 Detection Examples

### Discovering EC2 Instances

```python
detector = AWSDetector()
nodes = detector._discover_ec2()

for node in nodes:
    print(f"{node.display_name}:")
    print(f"  Type: {node.properties['instance_type']}")
    print(f"  State: {node.properties['state']}")
    print(f"  IP: {node.properties['private_ip']}")
    print(f"  VPC: {node.properties['vpc_id']}")
```

### Discovering Lambda Functions

```python
detector = AWSDetector()
nodes = detector._discover_lambda()

for node in nodes:
    print(f"{node.display_name}:")
    print(f"  Runtime: {node.properties['runtime']}")
    print(f"  Memory: {node.properties['memory_size']} MB")
    print(f"  Handler: {node.properties['handler']}")
```

### Discovering Databases

```python
detector = AWSDetector()

# RDS
rds = detector._discover_rds()
print(f"RDS Instances: {len(rds)}")

# DynamoDB
dynamo = detector._discover_dynamodb()
print(f"DynamoDB Tables: {len(dynamo)}")

# Redshift
redshift = detector._discover_redshift()
print(f"Redshift Clusters: {len(redshift)}")
```

## 📈 Detected Relationships

The system automatically detects these connections:

| From | To | Relationship | Detection Method |
|------|----|----|---|
| EC2 | EBS | `uses` | Check instance attachment |
| Lambda | VPC | `runs_in` | Check VPC assignment |
| VPC | EC2 | `contains` | Match VPC IDs |
| ELB | EC2 | `routes_to` | Match VPC + find targets |
| CloudFront | S3 | `originates_from` | Parse origin domain |

## 🐛 Common Issues & Solutions

### Issue: "InvalidClientTokenId"
**Cause:** Wrong AWS credentials

**Fix:**
```bash
cat ~/.aws/credentials  # Verify keys exist
echo $AWS_ACCESS_KEY_ID  # Check env vars
```

### Issue: "UnauthorizedOperation"
**Cause:** Missing IAM permissions

**Fix:** Add these permissions to your IAM user:
```json
{
    "Effect": "Allow",
    "Action": [
        "ec2:Describe*",
        "lambda:List*",
        "rds:Describe*",
        "dynamodb:List*",
        "s3:List*",
        "iam:List*",
        "kms:List*",
        "secretsmanager:List*",
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
```

### Issue: "No resources found" (but you have AWS resources)
**Cause:** Wrong region

**Fix:** Change region:
```python
detector = AWSDetector(region_name="eu-west-1")  # Your region
```

### Issue: Discovery takes too long
**Cause:** Large AWS account with many resources

**Fix:** Test individual services instead:
```python
detector._discover_ec2()  # Just EC2
detector._discover_lambda()  # Just Lambda
```

## 📚 Service-Specific Detection Details

### EC2 Instances
- **API Call:** `describe_instances()`
- **Key Properties:** instance_type, state, private_ip, vpc_id
- **Key Challenge:** Parsing nested structure (Reservations → Instances)

### Lambda Functions
- **API Call:** `list_functions()` with paginator
- **Key Properties:** runtime, memory_size, timeout, handler
- **Key Challenge:** Pagination (uses get_paginator)

### RDS & Aurora
- **API Call:** `describe_db_instances()` and `describe_db_clusters()`
- **Key Properties:** engine, status, endpoint, port
- **Key Challenge:** Two separate API calls (instances vs clusters)

### DynamoDB Tables
- **API Call:** `list_tables()` then `describe_table()` for each
- **Key Properties:** item_count, size_bytes, billing_mode
- **Key Challenge:** Need to call describe_table for each table name

### S3 Buckets
- **API Call:** `list_buckets()`
- **Key Properties:** creation_date
- **Key Challenge:** Region is global (can't filter by region)

### IAM Roles
- **API Call:** `list_roles()`
- **Key Properties:** role_name, creation_date
- **Key Challenge:** IAM is global, no region parameter

## 🎯 Learning Objectives

By exploring this code, you'll learn:

- ✓ How to use boto3 AWS SDK
- ✓ How to make API calls to different services
- ✓ How to handle pagination
- ✓ Error handling with try/except
- ✓ Data structures and modeling
- ✓ Relationship detection algorithms
- ✓ Real-world software architecture

## 📖 Files to Explore

| File | Purpose |
|------|---------|
| `aws.py` | Main detector with all service discovery |
| `schemas.py` | Data models (Node, Edge, Result) |
| `manager.py` | Orchestrates detection & storage |
| `TESTING_AWS_DETECTION.md` | Detailed testing guide |
| `test_interactive.py` | Interactive testing menu |
| `quickstart.py` | Simple one-click test |

## 🚀 Next Steps

1. **Week 1:** Run quickstart, explore interactive tester
2. **Week 2:** Test individual services, understand code
3. **Week 3:** Add a new service detection
4. **Week 4:** Create visualization of your infrastructure

## 💡 Tips for Students

1. **Start simple:** Test one service at a time
2. **Read logs:** Enable debug logging to see API calls
3. **Explore AWS console:** See what resources you actually have
4. **Try different regions:** Each region has separate resources
5. **Build incrementally:** Add relationship detection gradually

## 🔗 Useful Links

- [AWS SDK for Python (boto3)](https://boto3.amazonaws.com/v1/documentation/)
- [AWS API Reference](https://docs.aws.amazon.com/general/latest/gr/aws-api-reference.html)
- [IAM Permissions Guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_actions-resources-contextkeys.html)

---

**Happy learning! Ask questions and experiment freely.** 🎓
