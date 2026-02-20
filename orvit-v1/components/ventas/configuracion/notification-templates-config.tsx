'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FileText,
  ShoppingCart,
  Receipt,
  CreditCard,
  Truck,
  Save,
  RotateCcw,
  Eye,
  Info,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

interface TemplateConfig {
  quoteNotificationTemplates: QuoteTemplates;
  orderNotificationTemplates: OrderTemplates;
  invoiceNotificationTemplates: InvoiceTemplates;
  paymentNotificationTemplates: PaymentTemplates;
  collectionNotificationTemplates: CollectionTemplates;
  deliveryNotificationTemplates: DeliveryTemplates;
}

interface QuoteTemplates {
  sent: string;
  followup_3days: string;
  followup_7days: string;
  approved: string;
  rejected: string;
}

interface OrderTemplates {
  confirmed: string;
  processing: string;
  ready: string;
  cancelled: string;
}

interface InvoiceTemplates {
  issued: string;
  reminder_before: string;
  reminder_overdue: string;
  paid: string;
}

interface PaymentTemplates {
  received: string;
  applied: string;
  rejected: string;
}

interface CollectionTemplates {
  scheduled_visit: string;
  thank_you: string;
}

interface DeliveryTemplates {
  dispatched: string;
  delivered: string;
  failed: string;
  retry: string;
}

// =====================================================
// DEFAULT TEMPLATES
// =====================================================

const DEFAULT_QUOTE_TEMPLATES: QuoteTemplates = {
  sent: `Hola {clientName}!

Le enviamos la cotización *{quoteNumber}* de *{companyName}*.

Total: {total}
Válida hasta: {validUntil}

Quedamos a disposición.
Saludos,
{sellerName}`,
  followup_3days: `Hola {clientName}!

Queríamos saber si pudo revisar la cotización *{quoteNumber}*.

Quedamos atentos a sus consultas.

{companyName}`,
  followup_7days: `Hola {clientName}!

¿Tiene alguna duda sobre la cotización *{quoteNumber}*?

Estamos para ayudarlo.

{companyName}`,
  approved: `Hola {clientName}!

La cotización *{quoteNumber}* ha sido aprobada.

Procederemos con la orden de venta.

{companyName}`,
  rejected: `Hola {clientName}!

Gracias por considerar nuestra cotización *{quoteNumber}*.

Si en el futuro podemos ayudarlo, estamos a disposición.

{companyName}`,
};

const DEFAULT_ORDER_TEMPLATES: OrderTemplates = {
  confirmed: `Hola {clientName}!

Confirmamos su pedido *{orderNumber}* de *{companyName}*.

Total: {total}
Entrega estimada: {deliveryDate}

Gracias por su compra!`,
  processing: `Hola {clientName}!

Su pedido *{orderNumber}* está siendo preparado.

Le avisaremos cuando esté listo.

{companyName}`,
  ready: `Hola {clientName}!

Su pedido *{orderNumber}* está listo para entrega/retiro.

{companyName}`,
  cancelled: `Hola {clientName}!

Su pedido *{orderNumber}* ha sido cancelado.

Motivo: {reason}

Disculpe las molestias.
{companyName}`,
};

const DEFAULT_INVOICE_TEMPLATES: InvoiceTemplates = {
  issued: `Hola {clientName}!

Le enviamos la factura *{invoiceNumber}* de *{companyName}*.

Total: {total}
Vencimiento: {dueDate}

Gracias por su confianza!`,
  reminder_before: `Hola {clientName}!

Le recordamos que la factura *{invoiceNumber}* vence el {dueDate}.

Monto: {total}

{companyName}`,
  reminder_overdue: `Hola {clientName}!

La factura *{invoiceNumber}* venció hace {daysOverdue} días.

Monto pendiente: {amount}

Por favor regularice su situación.

{companyName}`,
  paid: `Hola {clientName}!

Confirmamos el pago de la factura *{invoiceNumber}*.

Gracias!
{companyName}`,
};

const DEFAULT_PAYMENT_TEMPLATES: PaymentTemplates = {
  received: `Hola {clientName}!

Confirmamos la recepción de su pago *{paymentNumber}*.

Monto: {amount}

Muchas gracias!
{companyName}`,
  applied: `Hola {clientName}!

Su pago *{paymentNumber}* fue aplicado a las facturas correspondientes.

Saldo actual: {currentBalance}

{companyName}`,
  rejected: `Hola {clientName}!

El pago *{paymentNumber}* fue rechazado.

Motivo: {reason}

Por favor contáctenos.
{companyName}`,
};

const DEFAULT_COLLECTION_TEMPLATES: CollectionTemplates = {
  scheduled_visit: `Hola {clientName}!

Le informamos que mañana pasaremos a cobrar.

Facturas pendientes: {pendingInvoices}
Monto total: {totalAmount}

{companyName}`,
  thank_you: `Hola {clientName}!

Gracias por su pago de hoy.

Recibo: {receiptNumber}
Monto: {amount}

{companyName}`,
};

const DEFAULT_DELIVERY_TEMPLATES: DeliveryTemplates = {
  dispatched: `¡Tu pedido #{deliveryNumber} está en camino! 🚚
Conductor: {driverName}
Tracking: {trackingLink}`,
  delivered: `✅ Tu pedido #{deliveryNumber} ha sido entregado.
¡Gracias por tu compra!`,
  failed: `⚠️ No pudimos entregar tu pedido #{deliveryNumber}.
Motivo: {reason}
Nos contactaremos pronto.`,
  retry: `🔄 Reintentaremos la entrega de tu pedido #{deliveryNumber}.
Nueva fecha: {newDate}`,
};

// =====================================================
// VARIABLE REFERENCE
// =====================================================

const TEMPLATE_VARIABLES = {
  quote: [
    { var: '{clientName}', desc: 'Nombre del cliente' },
    { var: '{quoteNumber}', desc: 'Número de cotización' },
    { var: '{total}', desc: 'Total formateado' },
    { var: '{validUntil}', desc: 'Fecha de validez' },
    { var: '{companyName}', desc: 'Nombre de la empresa' },
    { var: '{sellerName}', desc: 'Nombre del vendedor' },
  ],
  order: [
    { var: '{clientName}', desc: 'Nombre del cliente' },
    { var: '{orderNumber}', desc: 'Número de orden' },
    { var: '{total}', desc: 'Total formateado' },
    { var: '{deliveryDate}', desc: 'Fecha de entrega' },
    { var: '{companyName}', desc: 'Nombre de la empresa' },
    { var: '{reason}', desc: 'Motivo (cancelación)' },
  ],
  invoice: [
    { var: '{clientName}', desc: 'Nombre del cliente' },
    { var: '{invoiceNumber}', desc: 'Número de factura' },
    { var: '{total}', desc: 'Total formateado' },
    { var: '{dueDate}', desc: 'Fecha de vencimiento' },
    { var: '{amount}', desc: 'Monto pendiente' },
    { var: '{daysOverdue}', desc: 'Días de atraso' },
    { var: '{companyName}', desc: 'Nombre de la empresa' },
  ],
  payment: [
    { var: '{clientName}', desc: 'Nombre del cliente' },
    { var: '{paymentNumber}', desc: 'Número de recibo' },
    { var: '{amount}', desc: 'Monto del pago' },
    { var: '{currentBalance}', desc: 'Saldo actual' },
    { var: '{reason}', desc: 'Motivo (rechazo)' },
    { var: '{companyName}', desc: 'Nombre de la empresa' },
  ],
  collection: [
    { var: '{clientName}', desc: 'Nombre del cliente' },
    { var: '{pendingInvoices}', desc: 'Facturas pendientes' },
    { var: '{totalAmount}', desc: 'Monto total' },
    { var: '{receiptNumber}', desc: 'Número de recibo' },
    { var: '{amount}', desc: 'Monto cobrado' },
    { var: '{companyName}', desc: 'Nombre de la empresa' },
  ],
  delivery: [
    { var: '{deliveryNumber}', desc: 'Número de entrega' },
    { var: '{driverName}', desc: 'Nombre del conductor' },
    { var: '{trackingLink}', desc: 'Link de seguimiento' },
    { var: '{reason}', desc: 'Motivo (fallo)' },
    { var: '{newDate}', desc: 'Nueva fecha' },
  ],
};

// =====================================================
// COMPONENT
// =====================================================

interface NotificationTemplatesConfigProps {
  config: any;
  onSave: (updates: Partial<TemplateConfig>) => Promise<void>;
}

export function NotificationTemplatesConfig({ config, onSave }: NotificationTemplatesConfigProps) {
  const [templates, setTemplates] = useState<TemplateConfig>({
    quoteNotificationTemplates: { ...DEFAULT_QUOTE_TEMPLATES, ...config?.quoteNotificationTemplates },
    orderNotificationTemplates: { ...DEFAULT_ORDER_TEMPLATES, ...config?.orderNotificationTemplates },
    invoiceNotificationTemplates: { ...DEFAULT_INVOICE_TEMPLATES, ...config?.invoiceNotificationTemplates },
    paymentNotificationTemplates: { ...DEFAULT_PAYMENT_TEMPLATES, ...config?.paymentNotificationTemplates },
    collectionNotificationTemplates: { ...DEFAULT_COLLECTION_TEMPLATES, ...config?.collectionNotificationTemplates },
    deliveryNotificationTemplates: { ...DEFAULT_DELIVERY_TEMPLATES, ...config?.deliveryNotificationTemplates },
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleTemplateChange = (
    category: keyof TemplateConfig,
    templateKey: string,
    value: string
  ) => {
    setTemplates(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] as Record<string, string>),
        [templateKey]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(templates);
      setHasChanges(false);
      toast.success('Plantillas guardadas correctamente');
    } catch (error) {
      toast.error('Error al guardar plantillas');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (category: keyof TemplateConfig) => {
    const defaults: Record<keyof TemplateConfig, any> = {
      quoteNotificationTemplates: DEFAULT_QUOTE_TEMPLATES,
      orderNotificationTemplates: DEFAULT_ORDER_TEMPLATES,
      invoiceNotificationTemplates: DEFAULT_INVOICE_TEMPLATES,
      paymentNotificationTemplates: DEFAULT_PAYMENT_TEMPLATES,
      collectionNotificationTemplates: DEFAULT_COLLECTION_TEMPLATES,
      deliveryNotificationTemplates: DEFAULT_DELIVERY_TEMPLATES,
    };
    setTemplates(prev => ({
      ...prev,
      [category]: defaults[category],
    }));
    setHasChanges(true);
    toast.info('Plantillas restauradas a valores por defecto');
  };

  const VariableReference = ({ category }: { category: string }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Info className="w-4 h-4 mr-1" />
          Variables disponibles
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Variables disponibles</DialogTitle>
          <DialogDescription>
            Usa estas variables en tus plantillas. Se reemplazarán automáticamente.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-2">
          {TEMPLATE_VARIABLES[category as keyof typeof TEMPLATE_VARIABLES]?.map(v => (
            <div key={v.var} className="flex items-center justify-between p-2 bg-muted rounded">
              <code className="text-sm font-mono">{v.var}</code>
              <span className="text-sm text-muted-foreground">{v.desc}</span>
            </div>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );

  const TemplateEditor = ({
    category,
    templateKey,
    label,
    value,
  }: {
    category: keyof TemplateConfig;
    templateKey: string;
    label: string;
    value: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Badge variant="outline" className="text-xs">
          {templateKey}
        </Badge>
      </div>
      <Textarea
        value={value}
        onChange={(e) => handleTemplateChange(category, templateKey, e.target.value)}
        rows={6}
        className="font-mono text-sm"
        placeholder={`Escribe tu plantilla para ${label}...`}
      />
    </div>
  );

  const CategorySection = ({
    category,
    title,
    icon: Icon,
    templates: categoryTemplates,
    templateLabels,
  }: {
    category: keyof TemplateConfig;
    title: string;
    icon: any;
    templates: Record<string, string>;
    templateLabels: Record<string, string>;
  }) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <VariableReference category={category.replace('NotificationTemplates', '')} />
            <Button variant="ghost" size="sm" onClick={() => handleReset(category)}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Restaurar
            </Button>
          </div>
        </div>
        <CardDescription>
          Personaliza los mensajes de WhatsApp para {title.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {Object.entries(categoryTemplates).map(([key, value]) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="text-sm">
                {templateLabels[key] || key}
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <TemplateEditor
                  category={category}
                  templateKey={key}
                  label={templateLabels[key] || key}
                  value={value}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Plantillas de Notificación
          </h3>
          <p className="text-sm text-muted-foreground">
            Personaliza los mensajes que se envían por WhatsApp a tus clientes
          </p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>

      <Tabs defaultValue="quotes" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="quotes">
            <FileText className="w-4 h-4 mr-1" />
            Cotizaciones
          </TabsTrigger>
          <TabsTrigger value="orders">
            <ShoppingCart className="w-4 h-4 mr-1" />
            Órdenes
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <Receipt className="w-4 h-4 mr-1" />
            Facturas
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="w-4 h-4 mr-1" />
            Pagos
          </TabsTrigger>
          <TabsTrigger value="collections">
            <CreditCard className="w-4 h-4 mr-1" />
            Cobranzas
          </TabsTrigger>
          <TabsTrigger value="deliveries">
            <Truck className="w-4 h-4 mr-1" />
            Entregas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="mt-4">
          <CategorySection
            category="quoteNotificationTemplates"
            title="Cotizaciones"
            icon={FileText}
            templates={templates.quoteNotificationTemplates}
            templateLabels={{
              sent: 'Cotización enviada',
              followup_3days: 'Seguimiento 3 días',
              followup_7days: 'Seguimiento 7 días',
              approved: 'Cotización aprobada',
              rejected: 'Cotización rechazada',
            }}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <CategorySection
            category="orderNotificationTemplates"
            title="Órdenes de Venta"
            icon={ShoppingCart}
            templates={templates.orderNotificationTemplates}
            templateLabels={{
              confirmed: 'Orden confirmada',
              processing: 'En preparación',
              ready: 'Lista para entrega',
              cancelled: 'Orden cancelada',
            }}
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <CategorySection
            category="invoiceNotificationTemplates"
            title="Facturas"
            icon={Receipt}
            templates={templates.invoiceNotificationTemplates}
            templateLabels={{
              issued: 'Factura emitida',
              reminder_before: 'Recordatorio pre-vencimiento',
              reminder_overdue: 'Recordatorio vencido',
              paid: 'Pago confirmado',
            }}
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <CategorySection
            category="paymentNotificationTemplates"
            title="Pagos"
            icon={CreditCard}
            templates={templates.paymentNotificationTemplates}
            templateLabels={{
              received: 'Pago recibido',
              applied: 'Pago aplicado',
              rejected: 'Pago rechazado',
            }}
          />
        </TabsContent>

        <TabsContent value="collections" className="mt-4">
          <CategorySection
            category="collectionNotificationTemplates"
            title="Cobranzas"
            icon={CreditCard}
            templates={templates.collectionNotificationTemplates}
            templateLabels={{
              scheduled_visit: 'Visita programada',
              thank_you: 'Agradecimiento de pago',
            }}
          />
        </TabsContent>

        <TabsContent value="deliveries" className="mt-4">
          <CategorySection
            category="deliveryNotificationTemplates"
            title="Entregas"
            icon={Truck}
            templates={templates.deliveryNotificationTemplates}
            templateLabels={{
              dispatched: 'En camino',
              delivered: 'Entregado',
              failed: 'Entrega fallida',
              retry: 'Reintento programado',
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
