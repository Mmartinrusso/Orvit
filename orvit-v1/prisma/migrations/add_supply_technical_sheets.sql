-- CreateTable: supply_technical_sheets (Ficha Técnica de Materia Prima)
CREATE TABLE IF NOT EXISTS "supply_technical_sheets" (
  "id" SERIAL NOT NULL,
  "supplyId" INTEGER NOT NULL,
  "density" DOUBLE PRECISION,
  "viscosity" DOUBLE PRECISION,
  "ph" DOUBLE PRECISION,
  "flashPoint" DOUBLE PRECISION,
  "color" VARCHAR(100),
  "odor" VARCHAR(100),
  "storageTemp" VARCHAR(100),
  "storageConditions" TEXT,
  "shelfLifeDays" INTEGER,
  "casNumber" VARCHAR(50),
  "hazardClass" VARCHAR(100),
  "sdsUrl" VARCHAR(500),
  "documents" JSONB NOT NULL DEFAULT '[]',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supply_technical_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "supply_technical_sheets_supplyId_key" ON "supply_technical_sheets"("supplyId");

-- AddForeignKey
ALTER TABLE "supply_technical_sheets"
  ADD CONSTRAINT "supply_technical_sheets_supplyId_fkey"
  FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
