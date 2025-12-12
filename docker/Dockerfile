# Kairo Build Environment
# Multi-stage Dockerfile for building Tauri + React application

# =============================================================================
# Stage 1: Base with all dependencies
# =============================================================================
FROM ubuntu:22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV CARGO_HOME=/usr/local/cargo
ENV RUSTUP_HOME=/usr/local/rustup
ENV PATH="/usr/local/cargo/bin:/usr/local/node/bin:${PATH}"

# Install system dependencies for Tauri
RUN apt-get update && apt-get install -y \
    # Build essentials
    build-essential \
    curl \
    wget \
    git \
    pkg-config \
    # Tauri dependencies (use ayatana instead of appindicator3 to avoid conflict)
    libwebkit2gtk-4.1-dev \
    librsvg2-dev \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    # Additional libs
    libsoup-3.0-dev \
    libjavascriptcoregtk-4.1-dev \
    # SQLite
    libsqlite3-dev \
    # File handling
    file \
    # AppImage dependencies
    xdg-utils \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
RUN rustup target add x86_64-unknown-linux-gnu

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@latest

# Install Tauri CLI
RUN cargo install tauri-cli

# =============================================================================
# Stage 2: Development environment
# =============================================================================
FROM base AS dev

WORKDIR /app

# Expose Vite dev server port
EXPOSE 1420
# Expose Tauri dev port
EXPOSE 1421

# Default command for development
CMD ["pnpm", "tauri", "dev"]

# =============================================================================
# Stage 3: Builder
# =============================================================================
FROM base AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy Cargo files for Rust dependency caching
COPY src-tauri/Cargo.toml src-tauri/Cargo.lock* ./src-tauri/

# Create dummy main.rs to build dependencies
RUN mkdir -p src-tauri/src && \
    echo "fn main() {}" > src-tauri/src/main.rs && \
    cd src-tauri && cargo build --release || true && \
    rm -rf src-tauri/src

# Copy all source files
COPY . .

# Build the application
RUN pnpm tauri build

# =============================================================================
# Stage 4: Export artifacts
# =============================================================================
FROM scratch AS export

# Copy built artifacts
COPY --from=builder /app/src-tauri/target/release/bundle/ /bundle/
COPY --from=builder /app/src-tauri/target/release/kairo /kairo
