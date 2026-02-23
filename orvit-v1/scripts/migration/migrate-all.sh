#!/bin/bash
# Complete Migration Script - ERP AI

set -e  # Exit on error

echo "🚀 ERP AI - Complete Migration Script"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ Error: .env.local file not found!${NC}"
    echo "Please create .env.local with your configuration"
    exit 1
fi

# Load environment variables
export $(cat .env.local | grep -v '^#' | xargs)

echo "✓ Environment variables loaded"
echo ""

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL not set in .env.local${NC}"
    exit 1
fi

echo "📊 Database Configuration:"
echo "  URL: ${DATABASE_URL}"
echo ""

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npm run prisma:generate
echo -e "${GREEN}✅ Prisma Client generated${NC}"
echo ""

# Run Prisma migrations
echo "📦 Running Prisma migrations..."
npx prisma migrate deploy
echo -e "${GREEN}✅ Prisma migrations completed${NC}"
echo ""

# Execute custom SQL migrations
echo "🗄️  Executing custom SQL migrations..."

# Chatbot tables
if [ -f "prisma/migrations/add_chatbot_tables.sql" ]; then
    echo "  → Adding chatbot tables..."
    psql $DATABASE_URL -f prisma/migrations/add_chatbot_tables.sql
    echo -e "${GREEN}  ✅ Chatbot tables created${NC}"
else
    echo -e "${YELLOW}  ⚠️  Chatbot migration not found, skipping${NC}"
fi

# Performance indexes
if [ -f "prisma/migrations/add_performance_indexes.sql" ]; then
    echo "  → Adding performance indexes..."
    psql $DATABASE_URL -f prisma/migrations/add_performance_indexes.sql
    echo -e "${GREEN}  ✅ Performance indexes created${NC}"
else
    echo -e "${YELLOW}  ⚠️  Performance indexes migration not found, skipping${NC}"
fi

echo ""

# Verify migrations
echo "🔍 Verifying migrations..."

# Check if chat_sessions table exists
CHAT_SESSIONS_EXISTS=$(psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chat_sessions');")

if [ "$CHAT_SESSIONS_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ Chat sessions table exists${NC}"
else
    echo -e "${RED}❌ Chat sessions table not found!${NC}"
fi

# Check if indexes exist
INDEXES_COUNT=$(psql $DATABASE_URL -tAc "SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_%';")
echo "✅ Found $INDEXES_COUNT performance indexes"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All migrations completed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Next steps:"
echo "1. Start the development server: npm run dev"
echo "2. Test the chatbot: http://localhost:3000/test-chatbot"
echo "3. Test forecasting: http://localhost:3000/ai/demand-forecast"
echo ""
