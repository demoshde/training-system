#!/bin/bash

# Training System Deployment Script for Ubuntu VPS

set -e

echo "🚀 Training System Deployment Script"
echo "======================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo ./deploy.sh)${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Updating system...${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}Step 2: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}Docker installed successfully${NC}"
else
    echo -e "${GREEN}Docker already installed${NC}"
fi

echo -e "${YELLOW}Step 3: Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    apt install -y docker-compose-plugin
    echo -e "${GREEN}Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}Docker Compose already installed${NC}"
fi

echo -e "${YELLOW}Step 4: Installing Git...${NC}"
apt install -y git

echo -e "${YELLOW}Step 5: Setting up firewall...${NC}"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo -e "${GREEN}Firewall configured${NC}"

echo -e "${YELLOW}Step 6: Creating app directory...${NC}"
mkdir -p /opt/training-system
cd /opt/training-system

echo -e "${YELLOW}Step 7: Cloning repository...${NC}"
if [ -d "training-system" ]; then
    cd training-system
    git pull
else
    git clone https://github.com/demoshde/training-system.git
    cd training-system
fi

cd mern

echo -e "${YELLOW}Step 8: Setting up environment...${NC}"
if [ ! -f ".env" ]; then
    # Generate random secrets
    JWT_SECRET=$(openssl rand -base64 32)
    ADMIN_JWT_SECRET=$(openssl rand -base64 32)
    
    cat > .env << EOF
JWT_SECRET=${JWT_SECRET}
ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET}
EOF
    echo -e "${GREEN}Environment file created with secure secrets${NC}"
else
    echo -e "${GREEN}Environment file already exists${NC}"
fi

echo -e "${YELLOW}Step 9: Creating necessary directories...${NC}"
mkdir -p server/uploads/images server/uploads/pdfs server/uploads/presentations
mkdir -p nginx certbot/conf certbot/www
chmod -R 777 server/uploads

echo -e "${YELLOW}Step 10: Building and starting containers...${NC}"
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo -e "${YELLOW}Step 11: Waiting for services to start...${NC}"
sleep 10

echo -e "${YELLOW}Step 12: Checking container status...${NC}"
docker compose -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}======================================"
echo -e "🎉 Deployment Complete!"
echo -e "======================================${NC}"
echo ""
echo -e "Your app is now running at: ${YELLOW}http://$(curl -s ifconfig.me)${NC}"
echo ""
echo -e "Useful commands:"
echo -e "  View logs:     ${YELLOW}docker compose -f docker-compose.prod.yml logs -f${NC}"
echo -e "  Restart:       ${YELLOW}docker compose -f docker-compose.prod.yml restart${NC}"
echo -e "  Stop:          ${YELLOW}docker compose -f docker-compose.prod.yml down${NC}"
echo ""
