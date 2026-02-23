#!/bin/bash
# Setup Script - ERP AI TOP 1

echo "🚀 ERP AI - Setup Script"
echo "========================="
echo ""

# Check Node version
echo "✓ Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "  Node.js: $NODE_VERSION"

# Check npm
echo "✓ Checking npm..."
NPM_VERSION=$(npm -v)
echo "  npm: $NPM_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check for .env file
if [ ! -f .env.local ]; then
    echo ""
    echo "⚠️  No .env.local file found!"
    echo "📝 Creating .env.local from template..."
    cat > .env.local << 'EOF'
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/mawir_erp"

# JWT
JWT_SECRET="change-this-secret-in-production"

# OpenAI (REQUIRED for AI features)
OPENAI_API_KEY="sk-proj-..."

# Redis (Optional in dev, Required in prod)
REDIS_URL="redis://localhost:6379"

# Logging
LOG_LEVEL="info"

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"
EOF
    echo "✅ Created .env.local - Please update with your values!"
else
    echo "✅ .env.local already exists"
fi

# Generate Prisma Client
echo ""
echo "🔧 Generating Prisma Client..."
npm run prisma:generate

echo ""
echo "✅ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your configuration"
echo "2. Run migrations: npm run db:migrate"
echo "3. Start dev server: npm run dev"
echo ""
