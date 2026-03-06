"""
Pytest configuration and fixtures for unit tests.

This file provides shared fixtures for unit tests.
"""

import pytest
import sys
from pathlib import Path

# Add the apps/api directory to the Python path
repo_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(repo_root / "apps" / "api"))

from infrastructure.discovery.detectors.aws import AWSDetector


@pytest.fixture
def aws_detector():
    """Create an AWS detector instance for testing"""
    return AWSDetector(region_name="us-east-1")
