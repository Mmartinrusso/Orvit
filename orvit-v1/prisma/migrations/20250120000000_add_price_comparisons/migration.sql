-- CreateTable
CREATE TABLE "PriceComparison" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceComparisonCompetitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,

    CONSTRAINT "PriceComparisonCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceComparisonProductPrice" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "myPrice" DECIMAL(15,2) NOT NULL,
    "competitorPrice" DECIMAL(15,2),
    "competitorId" TEXT NOT NULL,

    CONSTRAINT "PriceComparisonProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceComparison_companyId_idx" ON "PriceComparison"("companyId");

-- CreateIndex
CREATE INDEX "PriceComparisonCompetitor_comparisonId_idx" ON "PriceComparisonCompetitor"("comparisonId");

-- CreateIndex
CREATE INDEX "PriceComparisonProductPrice_competitorId_idx" ON "PriceComparisonProductPrice"("competitorId");

-- CreateIndex
CREATE INDEX "PriceComparisonProductPrice_productId_idx" ON "PriceComparisonProductPrice"("productId");

-- AddForeignKey
ALTER TABLE "PriceComparison" ADD CONSTRAINT "PriceComparison_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceComparisonCompetitor" ADD CONSTRAINT "PriceComparisonCompetitor_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "PriceComparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceComparisonProductPrice" ADD CONSTRAINT "PriceComparisonProductPrice_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "PriceComparisonCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

