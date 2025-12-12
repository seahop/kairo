#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}=== Kairo Build Script ===${NC}"
echo -e "Project root: ${PROJECT_ROOT}"

# Create dist directory
DIST_DIR="${PROJECT_ROOT}/dist"
mkdir -p "$DIST_DIR"

# Parse arguments
BUILD_TYPE="${1:-release}"
PLATFORM="${2:-linux}"

case "$BUILD_TYPE" in
    release)
        echo -e "${YELLOW}Building release version...${NC}"
        ;;
    dev)
        echo -e "${YELLOW}Starting development environment...${NC}"
        docker compose -f "${SCRIPT_DIR}/docker-compose.yml" up --build
        exit 0
        ;;
    shell)
        echo -e "${YELLOW}Opening shell in build environment...${NC}"
        docker compose -f "${SCRIPT_DIR}/docker-compose.yml" run --rm kairo-dev bash
        exit 0
        ;;
    *)
        echo -e "${RED}Usage: $0 [release|dev|shell]${NC}"
        exit 1
        ;;
esac

# Build the Docker image and export artifacts
echo -e "${YELLOW}Building Docker image...${NC}"

cd "$PROJECT_ROOT"

# Build with BuildKit for better caching and export
DOCKER_BUILDKIT=1 docker build \
    -f docker/Dockerfile \
    --target builder \
    -t kairo-builder:latest \
    .

# Create a temporary container to copy artifacts
echo -e "${YELLOW}Extracting build artifacts...${NC}"
CONTAINER_ID=$(docker create kairo-builder:latest)

# Copy the bundle directory
docker cp "$CONTAINER_ID:/app/src-tauri/target/release/bundle/." "$DIST_DIR/" 2>/dev/null || true

# Copy the binary directly too
docker cp "$CONTAINER_ID:/app/src-tauri/target/release/kairo" "$DIST_DIR/" 2>/dev/null || true

# Clean up container
docker rm "$CONTAINER_ID"

echo -e "${GREEN}=== Build Complete ===${NC}"
echo -e "Artifacts saved to: ${DIST_DIR}"
ls -la "$DIST_DIR"
