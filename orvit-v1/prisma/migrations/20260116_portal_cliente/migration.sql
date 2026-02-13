-- Portal del Cliente - Migración completa
-- Crea tablas para: ClientContact, ClientPortalUser, ClientPortalInvite,
-- ClientPortalSession, ClientPortalOrder, ClientPortalOrderItem, ClientPortalActivity

-- =============================================
-- ENUMS
-- =============================================

-- Estado de pedidos del portal
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PortalOrderStatus') THEN
        CREATE TYPE "PortalOrderStatus" AS ENUM (
            'PENDIENTE',
            'EN_REVISION',
            'CONFIRMADO',
            'RECHAZADO',
            'CONVERTIDO',
            'CANCELADO'
        );
    END IF;
END $$;

-- Acciones de actividad del portal
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PortalActivityAction') THEN
        CREATE TYPE "PortalActivityAction" AS ENUM (
            'LOGIN',
            'LOGOUT',
            'VIEW_PRICES',
            'VIEW_QUOTE',
            'ACCEPT_QUOTE',
            'REJECT_QUOTE',
            'CREATE_ORDER',
            'CANCEL_ORDER',
            'VIEW_DOCUMENT',
            'DOWNLOAD_PDF',
            'CHANGE_PASSWORD'
        );
    END IF;
END $$;

-- =============================================
-- TABLAS PRINCIPALES
-- =============================================

-- Contactos del Cliente (personas reales)
CREATE TABLE IF NOT EXISTS "client_contacts" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "clientId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,

    -- Datos personales
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "whatsapp" VARCHAR(50),
    "position" VARCHAR(100),

    -- Estado
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    -- Metadata
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "client_contacts_clientId_email_key" UNIQUE ("clientId", "email")
);

-- Usuarios del Portal (credenciales)
CREATE TABLE IF NOT EXISTS "client_portal_users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "contactId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,

    -- Credenciales
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,

    -- Estado de la cuenta
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),

    -- Seguridad
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" VARCHAR(50),

    -- Permisos
    "canViewPrices" BOOLEAN NOT NULL DEFAULT true,
    "canViewQuotes" BOOLEAN NOT NULL DEFAULT true,
    "canAcceptQuotes" BOOLEAN NOT NULL DEFAULT true,
    "canCreateOrders" BOOLEAN NOT NULL DEFAULT true,
    "canViewHistory" BOOLEAN NOT NULL DEFAULT true,
    "canViewDocuments" BOOLEAN NOT NULL DEFAULT true,

    -- Límites
    "maxOrderAmount" DECIMAL(15, 2),
    "requiresApprovalAbove" DECIMAL(15, 2),

    -- Metadata
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "client_portal_users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "client_portal_users_contactId_key" UNIQUE ("contactId"),
    CONSTRAINT "client_portal_users_companyId_email_key" UNIQUE ("companyId", "email")
);

-- Invitaciones al Portal (tokens de activación)
CREATE TABLE IF NOT EXISTS "client_portal_invites" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "token" VARCHAR(100) NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,

    -- Vigencia
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    -- Tracking
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    "sentVia" VARCHAR(20),

    CONSTRAINT "client_portal_invites_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "client_portal_invites_token_key" UNIQUE ("token")
);

-- Sesiones del Portal
CREATE TABLE IF NOT EXISTS "client_portal_sessions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "portalUserId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,

    -- Token de sesión (hash)
    "tokenHash" VARCHAR(255) NOT NULL,

    -- Vigencia
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    -- Tracking
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,

    CONSTRAINT "client_portal_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "client_portal_sessions_tokenHash_key" UNIQUE ("tokenHash")
);

-- Pedidos del Portal
CREATE TABLE IF NOT EXISTS "client_portal_orders" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "numero" VARCHAR(50) NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    -- Anti-duplicados
    "clientRequestId" VARCHAR(100) NOT NULL,

    -- Referencia a cotización
    "quoteId" INTEGER,

    -- Estado
    "estado" "PortalOrderStatus" NOT NULL DEFAULT 'PENDIENTE',

    -- Datos del pedido
    "subtotal" DECIMAL(15, 2) NOT NULL,
    "total" DECIMAL(15, 2) NOT NULL,
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'ARS',

    -- Notas
    "notasCliente" TEXT,

    -- Datos de entrega
    "direccionEntrega" TEXT,
    "fechaEntregaSolicitada" TIMESTAMP(3),

    -- Tracking
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,

    -- Procesamiento
    "processedAt" TIMESTAMP(3),
    "processedBy" INTEGER,
    "processNotes" TEXT,
    "rejectionReason" TEXT,

    -- Conversión
    "convertedToQuoteId" INTEGER,
    "convertedToSaleId" INTEGER,
    "convertedAt" TIMESTAMP(3),

    CONSTRAINT "client_portal_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "client_portal_orders_clientRequestId_key" UNIQUE ("clientRequestId")
);

-- Items de Pedidos del Portal
CREATE TABLE IF NOT EXISTS "client_portal_order_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15, 4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "precioUnitario" DECIMAL(15, 2) NOT NULL,
    "subtotal" DECIMAL(15, 2) NOT NULL,
    "notas" TEXT,

    CONSTRAINT "client_portal_order_items_pkey" PRIMARY KEY ("id")
);

-- Log de Actividad del Portal
CREATE TABLE IF NOT EXISTS "client_portal_activity" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "portalUserId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,

    -- Acción realizada
    "action" "PortalActivityAction" NOT NULL,

    -- Entidad relacionada
    "entityType" VARCHAR(50),
    "entityId" TEXT,

    -- Detalles adicionales
    "details" JSONB,

    -- Tracking
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_portal_activity_pkey" PRIMARY KEY ("id")
);

-- =============================================
-- MODIFICAR TABLAS EXISTENTES
-- =============================================

-- Agregar campos a QuoteAcceptance para tracking mejorado (solo si la tabla existe)
DO $$
BEGIN
    -- Solo modificar si la tabla existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_acceptances') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_acceptances' AND column_name = 'acceptedByUserId') THEN
            ALTER TABLE "quote_acceptances" ADD COLUMN "acceptedByUserId" TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_acceptances' AND column_name = 'acceptedByContactId') THEN
            ALTER TABLE "quote_acceptances" ADD COLUMN "acceptedByContactId" TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_acceptances' AND column_name = 'quoteVersionId') THEN
            ALTER TABLE "quote_acceptances" ADD COLUMN "quoteVersionId" INTEGER;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_acceptances' AND column_name = 'pdfHash') THEN
            ALTER TABLE "quote_acceptances" ADD COLUMN "pdfHash" VARCHAR(64);
        END IF;
    END IF;
END $$;

-- =============================================
-- ÍNDICES
-- =============================================

-- client_contacts
CREATE INDEX IF NOT EXISTS "client_contacts_clientId_idx" ON "client_contacts"("clientId");
CREATE INDEX IF NOT EXISTS "client_contacts_companyId_idx" ON "client_contacts"("companyId");
CREATE INDEX IF NOT EXISTS "client_contacts_email_idx" ON "client_contacts"("email");

-- client_portal_users
CREATE INDEX IF NOT EXISTS "client_portal_users_clientId_idx" ON "client_portal_users"("clientId");
CREATE INDEX IF NOT EXISTS "client_portal_users_companyId_idx" ON "client_portal_users"("companyId");
CREATE INDEX IF NOT EXISTS "client_portal_users_email_idx" ON "client_portal_users"("email");

-- client_portal_invites
CREATE INDEX IF NOT EXISTS "client_portal_invites_token_idx" ON "client_portal_invites"("token");
CREATE INDEX IF NOT EXISTS "client_portal_invites_portalUserId_idx" ON "client_portal_invites"("portalUserId");
CREATE INDEX IF NOT EXISTS "client_portal_invites_expiresAt_idx" ON "client_portal_invites"("expiresAt");

-- client_portal_sessions
CREATE INDEX IF NOT EXISTS "client_portal_sessions_tokenHash_idx" ON "client_portal_sessions"("tokenHash");
CREATE INDEX IF NOT EXISTS "client_portal_sessions_portalUserId_idx" ON "client_portal_sessions"("portalUserId");
CREATE INDEX IF NOT EXISTS "client_portal_sessions_expiresAt_idx" ON "client_portal_sessions"("expiresAt");

-- client_portal_orders
CREATE INDEX IF NOT EXISTS "client_portal_orders_companyId_idx" ON "client_portal_orders"("companyId");
CREATE INDEX IF NOT EXISTS "client_portal_orders_clientId_idx" ON "client_portal_orders"("clientId");
CREATE INDEX IF NOT EXISTS "client_portal_orders_estado_idx" ON "client_portal_orders"("estado");
CREATE INDEX IF NOT EXISTS "client_portal_orders_createdAt_idx" ON "client_portal_orders"("createdAt");

-- client_portal_order_items
CREATE INDEX IF NOT EXISTS "client_portal_order_items_orderId_idx" ON "client_portal_order_items"("orderId");

-- client_portal_activity
CREATE INDEX IF NOT EXISTS "client_portal_activity_portalUserId_idx" ON "client_portal_activity"("portalUserId");
CREATE INDEX IF NOT EXISTS "client_portal_activity_clientId_idx" ON "client_portal_activity"("clientId");
CREATE INDEX IF NOT EXISTS "client_portal_activity_companyId_idx" ON "client_portal_activity"("companyId");
CREATE INDEX IF NOT EXISTS "client_portal_activity_action_idx" ON "client_portal_activity"("action");
CREATE INDEX IF NOT EXISTS "client_portal_activity_createdAt_idx" ON "client_portal_activity"("createdAt");

-- =============================================
-- FOREIGN KEYS
-- =============================================

-- client_contacts
ALTER TABLE "client_contacts"
    ADD CONSTRAINT "client_contacts_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_contacts"
    ADD CONSTRAINT "client_contacts_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- client_portal_users
ALTER TABLE "client_portal_users"
    ADD CONSTRAINT "client_portal_users_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "client_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_portal_users"
    ADD CONSTRAINT "client_portal_users_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_portal_users"
    ADD CONSTRAINT "client_portal_users_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- client_portal_invites
ALTER TABLE "client_portal_invites"
    ADD CONSTRAINT "client_portal_invites_portalUserId_fkey"
    FOREIGN KEY ("portalUserId") REFERENCES "client_portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_portal_invites"
    ADD CONSTRAINT "client_portal_invites_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- client_portal_sessions
ALTER TABLE "client_portal_sessions"
    ADD CONSTRAINT "client_portal_sessions_portalUserId_fkey"
    FOREIGN KEY ("portalUserId") REFERENCES "client_portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_portal_sessions"
    ADD CONSTRAINT "client_portal_sessions_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- client_portal_orders
ALTER TABLE "client_portal_orders"
    ADD CONSTRAINT "client_portal_orders_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_portal_orders"
    ADD CONSTRAINT "client_portal_orders_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_portal_orders"
    ADD CONSTRAINT "client_portal_orders_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "client_portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- client_portal_order_items
ALTER TABLE "client_portal_order_items"
    ADD CONSTRAINT "client_portal_order_items_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "client_portal_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_portal_order_items"
    ADD CONSTRAINT "client_portal_order_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- client_portal_activity
ALTER TABLE "client_portal_activity"
    ADD CONSTRAINT "client_portal_activity_portalUserId_fkey"
    FOREIGN KEY ("portalUserId") REFERENCES "client_portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- quote_acceptances (nuevos campos) - solo si la tabla existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quote_acceptances') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'quote_acceptances_acceptedByUserId_fkey') THEN
            ALTER TABLE "quote_acceptances"
                ADD CONSTRAINT "quote_acceptances_acceptedByUserId_fkey"
                FOREIGN KEY ("acceptedByUserId") REFERENCES "client_portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;

-- =============================================
-- CONFIGURACIÓN EN SALES_CONFIG
-- =============================================

DO $$
BEGIN
    -- Portal del Cliente
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_config' AND column_name = 'portalEnabled') THEN
        ALTER TABLE "sales_config" ADD COLUMN "portalEnabled" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_config' AND column_name = 'portalShowStock') THEN
        ALTER TABLE "sales_config" ADD COLUMN "portalShowStock" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_config' AND column_name = 'portalShowOriginalPrice') THEN
        ALTER TABLE "sales_config" ADD COLUMN "portalShowOriginalPrice" BOOLEAN NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_config' AND column_name = 'portalAutoApproveOrders') THEN
        ALTER TABLE "sales_config" ADD COLUMN "portalAutoApproveOrders" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_config' AND column_name = 'portalOrderMinAmount') THEN
        ALTER TABLE "sales_config" ADD COLUMN "portalOrderMinAmount" DECIMAL(15, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_config' AND column_name = 'portalSessionDays') THEN
        ALTER TABLE "sales_config" ADD COLUMN "portalSessionDays" INTEGER NOT NULL DEFAULT 7;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_config' AND column_name = 'portalInviteExpiryHours') THEN
        ALTER TABLE "sales_config" ADD COLUMN "portalInviteExpiryHours" INTEGER NOT NULL DEFAULT 48;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_config' AND column_name = 'portalWelcomeMessage') THEN
        ALTER TABLE "sales_config" ADD COLUMN "portalWelcomeMessage" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_config' AND column_name = 'portalNotifyEmails') THEN
        ALTER TABLE "sales_config" ADD COLUMN "portalNotifyEmails" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_config' AND column_name = 'portalRequireApprovalAbove') THEN
        ALTER TABLE "sales_config" ADD COLUMN "portalRequireApprovalAbove" DECIMAL(15, 2);
    END IF;
END $$;
