# Cost Calculator Test Suite

## Overview

Comprehensive test suite for `lib/costs/calculator.ts` — the core cost calculation engine that computes product costs from recipes, labor, and indirect cost allocations.

## Test Files

| File | Description |
|------|-------------|
| `calculator.test.ts` | Unit + integration tests for all calculator functions |
| `products.test.ts` | API route tests for `/api/costs/products` |
| `recipes.test.ts` | API route tests for `/api/costs/recipes` |
| `inputs.test.ts` | API route tests for `/api/costs/inputs` |
| `recalculate.test.ts` | API route tests for `/api/costs/recalculate` |

## Fixtures & Factories

- **Fixtures**: `tests/fixtures/cost-calculator.fixtures.ts` — Realistic manufacturing scenarios (bakery, pasta, concrete, furniture)
- **Factory**: `tests/factories/cost.factory.ts` — Entity builders for lines, products, inputs, employees, recipes

## Calculator Test Coverage

### Functions Tested (10/10 exported functions)

| Function | Tests | Description |
|----------|-------|-------------|
| `getEffectiveEmployeeComp` | 5 | Historical vs fallback compensation lookup |
| `getEffectiveEmployeeCompBatch` | 6 | Batch compensation lookup (avoids N+1) |
| `getEffectiveInputPrice` | 5 | Historical vs fallback input pricing |
| `calculateRecipeCost` | 6 | PER_BATCH and PER_M3 recipe costing |
| `calculateDirectCostPerOutput` | 20 | BATCH/VOLUMETRIC/PER_UNIT_BOM methods |
| `getProductionByLine` | 3 | Production aggregation by line |
| `calculateIndirectCostPerOutput` | 4 | Indirect cost allocation to lines |
| `calculateEmployeeCostPerOutput` | 6 | Employee cost allocation to lines |
| `calculateProductCost` | 4 | Full cost breakdown orchestration |
| `recalculateMonthCosts` | 5 | Bulk recalculation with history persistence |

### Scenarios by Cost Method

**BATCH (Direct Yield)**
- Standard: outputsPerBatch with scrapGlobal
- Zero scrap
- Line-level recipe fallback
- Missing yield config / missing recipe

**BATCH (Chained Yield)**
- Standard: intermediatesPerBatch → outputsPerIntermediate with scrapA + scrapB
- Zero scrap at both stages
- High scrap rates (50%/20%)

**BATCH (PER_M3 recipe)**
- PER_M3 → batch conversion via m3PerBatch
- Missing m3PerBatch validation

**VOLUMETRIC**
- Standard: costPerM3 × m3PerOutput
- PER_BATCH recipe fallback (costPerM3 || costPerBatch)
- Missing volumetricParam
- Missing recipe

**PER_UNIT_BOM**
- Standard: sum of BOM items
- Empty BOM validation

### Edge Cases

| Test | Scenario |
|------|----------|
| Division by zero | 100% scrap → 0 outputs per batch |
| Invalid yield config | No outputsPerBatch and no intermediates |
| Unknown cost method | Non-standard method in DB |
| Non-existent entities | Missing product/recipe/employee/input |
| Future history records | History dated after requested month |
| Month boundaries | Prices effective on last day of month |
| January/December | Month parsing edge cases |
| Decimal precision | Floating-point sensitive values (0.1, 0.2) |
| Large quantities | Production of 999,999 units |
| Many recipe items | Recipe with 20 input items |
| Negative scrap values | Negative scrap increases outputs beyond batch size |
| Very small prices | Prices at 0.001 level (sub-cent precision) |
| Employee comp fallback | No history before target month, uses current salary |

### Integration Tests

1. **Full pipeline**: recipe cost → direct cost → indirect → employee → product cost → recalculate → verify history
2. **Multi-product lines**: shared allocation verification across products on same line
3. **Upsert behavior**: recalculating same month twice produces single history record with updated values
4. **Error resilience**: individual product failure doesn't block other products in bulk recalculation
5. **Company filtering**: recalculation scoped to specific company

### Regression Tests

- Decimal precision (no floating-point drift)
- Large production quantities
- Recipe with many items (sum correctness)
- Month boundary dates (end of month)
- January/December parsing

## Running Tests

```bash
# Start test database
npm run test:db:up

# Run cost calculator tests only
npm run test:integration -- --testPathPattern=costs/calculator

# Run all cost tests
npm run test:integration -- --testPathPattern=costs/

# Run with coverage
npm run test:coverage

# Stop test database
npm run test:db:down
```

## Coverage Targets

Configured in `vitest.config.mts`:

```
lib/costs/calculator.ts:
  statements: 80%
  branches: 75%
  functions: 80%
  lines: 80%
```

## CI/CD

The GitHub Actions pipeline (`.github/workflows/ci.yml`) automatically:
1. Spins up PostgreSQL service on port 5433
2. Runs `npm run test:coverage`
3. Uploads coverage report as artifact (14-day retention)
4. Fails if thresholds are not met
