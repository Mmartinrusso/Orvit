-- Enum para frecuencia de pedidos recurrentes
DO $$ BEGIN
    CREATE TYPE "RecurringFrequency" AS ENUM ('DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabla de pedidos recurrentes
CREATE TABLE IF NOT EXISTS "recurring_purchase_orders" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "frecuencia" "RecurringFrequency" NOT NULL DEFAULT 'MENSUAL',
    "diaSemana" INTEGER,
    "diaMes" INTEGER,
    "horaEjecucion" INTEGER NOT NULL DEFAULT 8,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "proximaEjecucion" TIMESTAMP(3),
    "ultimaEjecucion" TIMESTAMP(3),
    "totalEjecuciones" INTEGER NOT NULL DEFAULT 0,
    "tituloPedido" VARCHAR(200) NOT NULL,
    "prioridad" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
    "departamento" VARCHAR(100),
    "diasParaNecesidad" INTEGER NOT NULL DEFAULT 7,
    "notas" TEXT,
    "creadorId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- Tabla de items de pedidos recurrentes
CREATE TABLE IF NOT EXISTS "recurring_purchase_items" (
    "id" SERIAL NOT NULL,
    "recurringOrderId" INTEGER NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "cantidad" DECIMAL(15,4) NOT NULL,
    "unidad" VARCHAR(50) NOT NULL,
    "especificaciones" TEXT,

    CONSTRAINT "recurring_purchase_items_pkey" PRIMARY KEY ("id")
);

-- Tabla de historial de ejecuciones
CREATE TABLE IF NOT EXISTS "recurring_purchase_history" (
    "id" SERIAL NOT NULL,
    "recurringOrderId" INTEGER NOT NULL,
    "purchaseRequestId" INTEGER,
    "fechaEjecucion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,

    CONSTRAINT "recurring_purchase_history_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
ALTER TABLE "recurring_purchase_orders"
ADD CONSTRAINT "recurring_purchase_orders_creadorId_fkey"
FOREIGN KEY ("creadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurring_purchase_orders"
ADD CONSTRAINT "recurring_purchase_orders_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recurring_purchase_items"
ADD CONSTRAINT "recurring_purchase_items_recurringOrderId_fkey"
FOREIGN KEY ("recurringOrderId") REFERENCES "recurring_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recurring_purchase_history"
ADD CONSTRAINT "recurring_purchase_history_recurringOrderId_fkey"
FOREIGN KEY ("recurringOrderId") REFERENCES "recurring_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "recurring_purchase_orders_companyId_idx" ON "recurring_purchase_orders"("companyId");
CREATE INDEX IF NOT EXISTS "recurring_purchase_orders_isActive_idx" ON "recurring_purchase_orders"("isActive");
CREATE INDEX IF NOT EXISTS "recurring_purchase_orders_proximaEjecucion_idx" ON "recurring_purchase_orders"("proximaEjecucion");
CREATE INDEX IF NOT EXISTS "recurring_purchase_items_recurringOrderId_idx" ON "recurring_purchase_items"("recurringOrderId");
CREATE INDEX IF NOT EXISTS "recurring_purchase_history_recurringOrderId_idx" ON "recurring_purchase_history"("recurringOrderId");
CREATE INDEX IF NOT EXISTS "recurring_purchase_history_fechaEjecucion_idx" ON "recurring_purchase_history"("fechaEjecucion");
