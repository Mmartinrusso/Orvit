-- CreateTable
CREATE TABLE "product_subcategories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "product_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_products_subcategory_id" ON "products"("subcategory_id");

-- AddForeignKey
ALTER TABLE "product_subcategories" ADD CONSTRAINT "product_subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON UPDATE NO ACTION ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "product_subcategories"("id") ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "product_subcategories"("id") ON UPDATE NO ACTION;
