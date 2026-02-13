-- Migración: Plantillas de Gremios del Sistema
-- Fecha: 2026-01-13
-- Descripción: Crea tablas de plantillas y seed de gremios argentinos

-- ================================================
-- 1. Plantillas de Gremios (system-level, sin company_id)
-- ================================================
CREATE TABLE IF NOT EXISTS "gremio_templates" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(500),
    "convention_code" VARCHAR(50),
    "payment_schedule_type" VARCHAR(50) NOT NULL DEFAULT 'BIWEEKLY_FIXED',
    "payment_rule_json" JSONB,
    "attendance_policy_json" JSONB,
    "contribution_rules_json" JSONB,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 2. Plantillas de Categorías por Gremio
-- ================================================
CREATE TABLE IF NOT EXISTS "gremio_category_templates" (
    "id" SERIAL PRIMARY KEY,
    "gremio_template_id" INTEGER NOT NULL,
    "code" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "group_name" VARCHAR(100),
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gremio_category_templates_gremio_fkey"
    FOREIGN KEY ("gremio_template_id") REFERENCES "gremio_templates"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "gremio_category_templates_gremio_idx"
    ON "gremio_category_templates"("gremio_template_id");

-- ================================================
-- 3. Agregar source_template_id a payroll_unions
-- ================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payroll_unions' AND column_name = 'source_template_id'
    ) THEN
        ALTER TABLE "payroll_unions" ADD COLUMN "source_template_id" INTEGER;
        ALTER TABLE "payroll_unions" ADD CONSTRAINT "payroll_unions_source_template_fkey"
            FOREIGN KEY ("source_template_id") REFERENCES "gremio_templates"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- ================================================
-- 4. SEED: UOCRA (CCT 76/75) - Construcción Obreros
-- ================================================
INSERT INTO "gremio_templates" (code, name, full_name, convention_code, payment_schedule_type, description)
VALUES (
    'UOCRA',
    'UOCRA',
    'Unión Obrera de la Construcción de la República Argentina',
    'CCT 76/75',
    'BIWEEKLY_FIXED',
    'Convenio Colectivo de Trabajo para obreros de la construcción. Pago quincenal (días 15 y último del mes).'
) ON CONFLICT (code) DO NOTHING;

-- Categorías UOCRA
INSERT INTO "gremio_category_templates" (gremio_template_id, code, name, group_name, description, level)
SELECT gt.id, cat.code, cat.name, cat.group_name, cat.description, cat.level
FROM "gremio_templates" gt
CROSS JOIN (VALUES
    ('OF_ESP', 'Oficial Especializado', 'Oficiales', 'Oficial (albañil/carpintero) que lee e interpreta planos y puede replantear obras', 1),
    ('OFICIAL', 'Oficial', 'Oficiales', 'Oficial calificado en su especialidad', 2),
    ('M_OFICIAL', 'Medio Oficial', 'Oficiales', 'Trabajador con conocimientos parciales de la especialidad', 3),
    ('AYUDANTE', 'Ayudante', 'Ayudantes', 'Tareas generales no especializadas', 4),
    ('SERENO', 'Sereno', 'Servicios', 'Vigilancia y custodia de obra', 5),
    ('OF_CHOFER', 'Oficial Chofer', 'Choferes', 'Con registro habilitante para conducir camiones de obra', 2),
    ('OF_MAQ_A', 'Oficial Maquinista A', 'Maquinistas', 'Operador de maquinaria pesada (más de 150 HP)', 1),
    ('OF_MAQ_B', 'Oficial Maquinista B', 'Maquinistas', 'Operador de maquinaria mediana (100-150 HP)', 2),
    ('OF_MAQ_C', 'Oficial Maquinista C', 'Maquinistas', 'Operador de maquinaria liviana (menos de 100 HP)', 3),
    ('OF_ALBA', 'Oficial Albañil', 'Albañilería', 'Oficial especializado en albañilería', 2),
    ('M_OF_ALBA', 'Medio Oficial Albañil', 'Albañilería', 'Medio oficial en albañilería', 3),
    ('OF_CARP', 'Oficial Carpintero', 'Carpintería', 'Oficial especializado en encofrados y carpintería de obra', 2),
    ('M_OF_CARP', 'Medio Oficial Carpintero', 'Carpintería', 'Medio oficial en carpintería de obra', 3),
    ('OF_ARMA', 'Oficial Armador', 'Armadores', 'Oficial especializado en armado de hierros', 2),
    ('M_OF_ARMA', 'Medio Oficial Armador', 'Armadores', 'Medio oficial en armado de hierros', 3),
    ('OF_ELECT', 'Oficial Electricista', 'Electricidad', 'Oficial especializado en instalaciones eléctricas', 2),
    ('OF_PLOM', 'Oficial Plomero', 'Plomería', 'Oficial especializado en instalaciones sanitarias', 2),
    ('OF_PINT', 'Oficial Pintor', 'Pintura', 'Oficial especializado en pintura de obra', 2),
    ('OF_SOLD', 'Oficial Soldador', 'Soldadura', 'Oficial especializado en soldadura', 2),
    ('GUINCH', 'Guinchero', 'Maquinistas', 'Operador de guinche y elevadores', 3)
) AS cat(code, name, group_name, description, level)
WHERE gt.code = 'UOCRA'
ON CONFLICT DO NOTHING;

-- ================================================
-- 5. SEED: UECARA (CCT 660/13) - Construcción Empleados
-- ================================================
INSERT INTO "gremio_templates" (code, name, full_name, convention_code, payment_schedule_type, description)
VALUES (
    'UECARA',
    'UECARA',
    'Unión Empleados de la Construcción y Afines de la República Argentina',
    'CCT 660/13',
    'MONTHLY_SAME_MONTH',
    'Convenio Colectivo para empleados administrativos, técnicos y maestranza de la construcción. Pago mensual.'
) ON CONFLICT (code) DO NOTHING;

-- Categorías UECARA por Grupos
INSERT INTO "gremio_category_templates" (gremio_template_id, code, name, group_name, description, level)
SELECT gt.id, cat.code, cat.name, cat.group_name, cat.description, cat.level
FROM "gremio_templates" gt
CROSS JOIN (VALUES
    -- Grupo I - Capataces
    ('CAP_OBRA', 'Capataz de Obra', 'I - Capataces', 'Responsable general de obra', 1),
    ('CAP_TAREA', 'Capataz de Tarea/Fase', 'I - Capataces', 'Responsable de una fase o especialidad', 2),
    ('CAP_2DA', 'Capataz de Segunda', 'I - Capataces', 'Capataz auxiliar', 3),
    -- Grupo II - Administrativos
    ('ANAL_ADM', 'Analista Administrativo', 'II - Administrativos', 'Análisis y gestión administrativa', 1),
    ('AUX_ADM', 'Auxiliar Administrativo', 'II - Administrativos', 'Tareas administrativas generales', 2),
    ('AY_ADM', 'Ayudante Administrativo', 'II - Administrativos', 'Asistencia administrativa', 3),
    ('AY_ADM_2', 'Ayudante Administrativo 2da', 'II - Administrativos', 'Tareas administrativas básicas', 4),
    -- Grupo III - Técnicos
    ('ANAL_TEC', 'Analista Técnico', 'III - Técnicos', 'Análisis técnico especializado', 1),
    ('AUX_TEC', 'Auxiliar Técnico', 'III - Técnicos', 'Soporte técnico general', 2),
    ('AY_TEC', 'Ayudante Técnico', 'III - Técnicos', 'Asistencia técnica', 3),
    ('AY_TEC_2', 'Ayudante Técnico 2da', 'III - Técnicos', 'Tareas técnicas básicas', 4),
    -- Grupo IV - Sistemas
    ('ANAL_SIS', 'Analista de Sistemas', 'IV - Sistemas', 'Desarrollo y análisis de sistemas', 1),
    ('TEC_SIS_1', 'Técnico de Sistemas 1ra', 'IV - Sistemas', 'Soporte técnico sistemas nivel 1', 2),
    ('TEC_SIS_2', 'Técnico de Sistemas 2da', 'IV - Sistemas', 'Soporte técnico sistemas nivel 2', 3),
    -- Grupo V - Maestranza
    ('MAEST_1', 'Maestranza 1ra', 'V - Maestranza', 'Mantenimiento y servicios de primera', 1),
    ('MAEST_2', 'Maestranza 2da', 'V - Maestranza', 'Mantenimiento y servicios de segunda', 2)
) AS cat(code, name, group_name, description, level)
WHERE gt.code = 'UECARA'
ON CONFLICT DO NOTHING;

-- ================================================
-- 6. SEED: COMERCIO (CCT 130/75) - Empleados de Comercio
-- ================================================
INSERT INTO "gremio_templates" (code, name, full_name, convention_code, payment_schedule_type, description)
VALUES (
    'COMERCIO',
    'Comercio',
    'Federación Argentina de Empleados de Comercio y Servicios (FAECYS)',
    'CCT 130/75',
    'MONTHLY_SAME_MONTH',
    'Convenio Colectivo de Trabajo para empleados de comercio. Pago mensual.'
) ON CONFLICT (code) DO NOTHING;

-- Categorías Comercio
INSERT INTO "gremio_category_templates" (gremio_template_id, code, name, group_name, description, level)
SELECT gt.id, cat.code, cat.name, cat.group_name, cat.description, cat.level
FROM "gremio_templates" gt
CROSS JOIN (VALUES
    -- Administrativos
    ('ADM_A', 'Administrativo A', 'Administrativos', 'Cajero principal, encargado administrativo', 1),
    ('ADM_B', 'Administrativo B', 'Administrativos', 'Cajero, facturista, liquidador', 2),
    ('ADM_C', 'Administrativo C', 'Administrativos', 'Auxiliar administrativo con experiencia', 3),
    ('ADM_D', 'Administrativo D', 'Administrativos', 'Auxiliar administrativo inicial', 4),
    -- Ventas
    ('VEND_A', 'Vendedor A', 'Ventas', 'Vendedor especializado, encargado de sección', 1),
    ('VEND_B', 'Vendedor B', 'Ventas', 'Vendedor con experiencia', 2),
    ('VEND_C', 'Vendedor C', 'Ventas', 'Vendedor inicial', 3),
    -- Maestranza
    ('MAEST_A', 'Maestranza A', 'Maestranza', 'Sereno, portero, personal de limpieza con responsabilidad', 1),
    ('MAEST_B', 'Maestranza B', 'Maestranza', 'Personal de limpieza y mantenimiento', 2),
    -- Otros
    ('CADE_A', 'Cadete/Mensajero A', 'Auxiliares', 'Cadete con tareas adicionales', 3),
    ('CADE_B', 'Cadete/Mensajero B', 'Auxiliares', 'Cadete de mensajería', 4)
) AS cat(code, name, group_name, description, level)
WHERE gt.code = 'COMERCIO'
ON CONFLICT DO NOTHING;

-- ================================================
-- 7. Mensaje final
-- ================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Plantillas de Gremios creadas!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Gremios disponibles:';
    RAISE NOTICE '  - UOCRA (CCT 76/75) - 20 categorías';
    RAISE NOTICE '  - UECARA (CCT 660/13) - 16 categorías';
    RAISE NOTICE '  - COMERCIO (CCT 130/75) - 11 categorías';
    RAISE NOTICE '';
END $$;
