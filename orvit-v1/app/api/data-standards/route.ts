import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/data-standards
 * Returns data standards configuration for the company
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    // Get company settings with data standards
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        settings: true,
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Default data standards structure
    const defaultStandards = {
      // Naming conventions
      namingConventions: {
        machines: {
          format: '{AREA}-{TYPE}-{NUMBER}',
          example: 'PROD-CNC-001',
          rules: [
            'Use uppercase letters',
            'No spaces, use hyphens',
            'Sequential numbering with leading zeros',
          ],
        },
        workOrders: {
          format: 'OT-{YEAR}-{NUMBER}',
          example: 'OT-2026-00123',
          rules: [
            'Auto-generated sequence',
            'Year prefix for tracking',
          ],
        },
        spareParts: {
          format: '{CATEGORY}-{SUBCATEGORY}-{NUMBER}',
          example: 'ELE-MOT-0045',
          rules: [
            'Category code (3 letters)',
            'Subcategory code (3 letters)',
            'Sequential number',
          ],
        },
      },
      // Classification codes
      classifications: {
        machineTypes: [
          { code: 'CNC', name: 'CNC Machining' },
          { code: 'PRS', name: 'Press' },
          { code: 'WLD', name: 'Welding' },
          { code: 'PNT', name: 'Painting' },
          { code: 'ASM', name: 'Assembly' },
          { code: 'CNV', name: 'Conveyor' },
          { code: 'PMP', name: 'Pump' },
          { code: 'CMP', name: 'Compressor' },
          { code: 'HVA', name: 'HVAC' },
          { code: 'GEN', name: 'General' },
        ],
        failureTypes: [
          { code: 'MEC', name: 'Mechanical', description: 'Mechanical failures (bearings, gears, belts)' },
          { code: 'ELE', name: 'Electrical', description: 'Electrical failures (motors, wiring, controls)' },
          { code: 'HYD', name: 'Hydraulic', description: 'Hydraulic system failures' },
          { code: 'PNE', name: 'Pneumatic', description: 'Pneumatic system failures' },
          { code: 'INS', name: 'Instrumentation', description: 'Sensors, gauges, PLCs' },
          { code: 'LUB', name: 'Lubrication', description: 'Lubrication related issues' },
          { code: 'WEA', name: 'Wear', description: 'Normal wear and tear' },
          { code: 'OPR', name: 'Operational', description: 'Operator error or misuse' },
          { code: 'EXT', name: 'External', description: 'External factors (power, environment)' },
        ],
        maintenanceTypes: [
          { code: 'CM', name: 'Corrective', description: 'Fix after failure' },
          { code: 'PM', name: 'Preventive', description: 'Scheduled maintenance' },
          { code: 'PdM', name: 'Predictive', description: 'Condition-based maintenance' },
          { code: 'EM', name: 'Emergency', description: 'Urgent unplanned maintenance' },
          { code: 'IM', name: 'Improvement', description: 'Reliability improvements' },
        ],
        priorities: [
          { code: 'P1', name: 'Critical', sla: 4, description: 'Production stopped' },
          { code: 'P2', name: 'High', sla: 8, description: 'Production affected' },
          { code: 'P3', name: 'Medium', sla: 24, description: 'No immediate impact' },
          { code: 'P4', name: 'Low', sla: 72, description: 'Can be planned' },
        ],
      },
      // Data quality rules
      dataQuality: {
        requiredFields: {
          machine: ['name', 'type', 'areaId', 'sectorId'],
          workOrder: ['title', 'machineId', 'type', 'priority'],
          sparePart: ['name', 'sku', 'category'],
        },
        validationRules: [
          { field: 'machine.name', rule: 'Must be unique within company' },
          { field: 'workOrder.title', rule: 'Minimum 10 characters' },
          { field: 'sparePart.sku', rule: 'Must follow naming convention' },
        ],
      },
      // Units of measure
      unitsOfMeasure: {
        time: ['hours', 'minutes', 'days'],
        distance: ['mm', 'cm', 'm', 'in', 'ft'],
        temperature: ['°C', '°F', 'K'],
        pressure: ['bar', 'psi', 'kPa', 'MPa'],
        flow: ['l/min', 'gpm', 'm³/h'],
        voltage: ['V', 'mV', 'kV'],
        current: ['A', 'mA'],
        vibration: ['mm/s', 'in/s', 'g'],
        rpm: ['rpm', 'Hz'],
      },
    };

    // Merge with company-specific overrides
    const companySettings = (company.settings as any) || {};
    const dataStandards = {
      ...defaultStandards,
      ...companySettings.dataStandards,
    };

    return NextResponse.json({
      companyId,
      companyName: company.name,
      dataStandards,
    });
  } catch (error) {
    console.error('Error fetching data standards:', error);
    return NextResponse.json(
      { error: 'Error fetching data standards' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/data-standards
 * Update data standards for the company
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { companyId, dataStandards } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    // Get current settings
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const currentSettings = (company.settings as any) || {};
    const updatedSettings = {
      ...currentSettings,
      dataStandards: {
        ...currentSettings.dataStandards,
        ...dataStandards,
      },
    };

    await prisma.company.update({
      where: { id: companyId },
      data: {
        settings: updatedSettings,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Data standards updated',
    });
  } catch (error) {
    console.error('Error updating data standards:', error);
    return NextResponse.json(
      { error: 'Error updating data standards' },
      { status: 500 }
    );
  }
}
