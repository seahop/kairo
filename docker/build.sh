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
    fmt)
        echo -e "${YELLOW}Formatting Rust code...${NC}"
        docker compose -f "${SCRIPT_DIR}/docker-compose.yml" run --rm kairo-dev cargo fmt --manifest-path src-tauri/Cargo.toml
        exit 0
        ;;
    check)
        echo -e "${YELLOW}Running cargo check...${NC}"
        docker compose -f "${SCRIPT_DIR}/docker-compose.yml" run --rm kairo-dev cargo check --manifest-path src-tauri/Cargo.toml
        exit 0
        ;;
    *)
        echo -e "${RED}Usage: $0 [release|dev|shell|fmt|check]${NC}"
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

# Create release output directory (separate from frontend dist)
RELEASE_DIR="${PROJECT_ROOT}/release-output"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Copy the self-contained binary
docker cp "$CONTAINER_ID:/app/src-tauri/target/release/kairo" "$RELEASE_DIR/" 2>/dev/null || true

# Copy the deb package if it exists
docker cp "$CONTAINER_ID:/app/src-tauri/target/release/bundle/deb/." "$RELEASE_DIR/" 2>/dev/null || true

# Copy the AppImage if it exists (most portable option)
docker cp "$CONTAINER_ID:/app/src-tauri/target/release/bundle/appimage/." "$RELEASE_DIR/" 2>/dev/null || true

# Clean up container
docker rm "$CONTAINER_ID"

echo -e "${GREEN}=== Build Complete ===${NC}"
echo -e "Release artifacts saved to: ${RELEASE_DIR}"
echo ""
echo "Contents:"
ls -la "$RELEASE_DIR"
echo ""
echo -e "${GREEN}Distribution options:${NC}"
echo "  • kairo           - Binary (requires system GTK/WebKit libs)"
echo "  • *.AppImage      - Portable, runs on most Linux distros without install"
echo "  • *.deb           - For Debian/Ubuntu (installs dependencies automatically)"
