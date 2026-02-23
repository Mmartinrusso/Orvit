DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'condiciones_pago') THEN
    ALTER TABLE "suppliers" ADD COLUMN "condiciones_pago" VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'ingresos_brutos') THEN
    ALTER TABLE "suppliers" ADD COLUMN "ingresos_brutos" VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'condicion_iva') THEN
    ALTER TABLE "suppliers" ADD COLUMN "condicion_iva" VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'cbu') THEN
    ALTER TABLE "suppliers" ADD COLUMN "cbu" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'alias_cbu') THEN
    ALTER TABLE "suppliers" ADD COLUMN "alias_cbu" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'banco') THEN
    ALTER TABLE "suppliers" ADD COLUMN "banco" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'tipo_cuenta') THEN
    ALTER TABLE "suppliers" ADD COLUMN "tipo_cuenta" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'numero_cuenta') THEN
    ALTER TABLE "suppliers" ADD COLUMN "numero_cuenta" TEXT;
  END IF;
END $$;


