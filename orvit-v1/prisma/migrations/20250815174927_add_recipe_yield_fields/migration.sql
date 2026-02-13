-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "intermediateQuantity" DECIMAL(12,6),
ADD COLUMN     "intermediateUnitLabel" TEXT,
ADD COLUMN     "outputQuantity" DECIMAL(12,6),
ADD COLUMN     "outputUnitLabel" TEXT;

-- AlterTable
ALTER TABLE "RecipeItem" ALTER COLUMN "quantity" TYPE DECIMAL(12,6);
