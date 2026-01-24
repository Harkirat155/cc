# Multi-stage build for minimal image size
FROM rust:1.92 as builder

WORKDIR /app

# Copy manifests
COPY Cargo.toml ./

# Create dummy main to cache dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    echo "" > src/lib.rs

# Build dependencies (cached layer)
RUN cargo build --release && \
    rm -rf src

# Copy actual source code
COPY src ./src

# Build the real application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/target/release/crisscross-server .

# Set environment variables
ENV PORT=10000
ENV CORS_ORIGIN=*
ENV ROOM_LIMIT=500
ENV ROOM_TTL_MS=120000

# Expose port
EXPOSE 10000

# Run the server
CMD ["./crisscross-server"]
