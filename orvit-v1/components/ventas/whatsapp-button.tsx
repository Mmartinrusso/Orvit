'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { MessageCircle, Send, Bell, Receipt, Truck, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import {
  openWhatsApp,
  generateQuoteMessage,
  generateOrderConfirmationMessage,
  generateInvoiceMessage,
  generateDeliveryMessage,
  generatePaymentReminderMessage,
  generateCollectionConfirmationMessage,
  generateQuoteFollowUpMessage,
  generateCustomMessage,
  type QuoteMessageData,
  type OrderMessageData,
  type InvoiceMessageData,
  type DeliveryMessageData,
  type PaymentReminderData,
  type CollectionConfirmationData,
} from '@/lib/ventas/whatsapp-utils';

// =====================================================
// TYPES
// =====================================================

interface BaseProps {
  phone: string;
  clientName: string;
  companyName: string;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

interface QuoteWhatsAppProps extends BaseProps {
  type: 'quote';
  quoteNumber: string;
  total: number;
  currency?: string;
  validUntil?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  sellerName?: string;
}

interface OrderWhatsAppProps extends BaseProps {
  type: 'order';
  orderNumber: string;
  total: number;
  currency?: string;
  deliveryDate?: string;
}

interface InvoiceWhatsAppProps extends BaseProps {
  type: 'invoice';
  invoiceNumber: string;
  total: number;
  currency?: string;
  dueDate?: string;
}

interface DeliveryWhatsAppProps extends BaseProps {
  type: 'delivery';
  deliveryNumber: string;
  orderNumber?: string;
  scheduledDate?: string;
  address?: string;
  driverName?: string;
  driverPhone?: string;
  status: 'scheduled' | 'dispatched' | 'delivered' | 'failed';
}

interface PaymentReminderWhatsAppProps extends BaseProps {
  type: 'payment-reminder';
  invoiceNumber: string;
  amount: number;
  currency?: string;
  dueDate: string;
  daysOverdue?: number;
}

interface CollectionWhatsAppProps extends BaseProps {
  type: 'collection';
  paymentNumber: string;
  amount: number;
  currency?: string;
}

interface CustomWhatsAppProps extends BaseProps {
  type: 'custom';
  subject: string;
  body: string;
}

type WhatsAppButtonProps =
  | QuoteWhatsAppProps
  | OrderWhatsAppProps
  | InvoiceWhatsAppProps
  | DeliveryWhatsAppProps
  | PaymentReminderWhatsAppProps
  | CollectionWhatsAppProps
  | CustomWhatsAppProps;

// =====================================================
// COMPONENT
// =====================================================

export function WhatsAppButton(props: WhatsAppButtonProps) {
  const {
    phone,
    clientName,
    companyName,
    disabled = false,
    variant = 'outline',
    size = 'sm',
    showLabel = true,
  } = props;

  const handleSend = () => {
    if (!phone) {
      toast.error('El cliente no tiene teléfono registrado');
      return;
    }

    let message = '';

    switch (props.type) {
      case 'quote':
        message = generateQuoteMessage({
          clientName,
          quoteNumber: props.quoteNumber,
          total: props.total,
          currency: props.currency || 'ARS',
          validUntil: props.validUntil,
          items: props.items,
          companyName,
          sellerName: props.sellerName,
        });
        break;

      case 'order':
        message = generateOrderConfirmationMessage({
          clientName,
          orderNumber: props.orderNumber,
          total: props.total,
          currency: props.currency || 'ARS',
          deliveryDate: props.deliveryDate,
          companyName,
        });
        break;

      case 'invoice':
        message = generateInvoiceMessage({
          clientName,
          invoiceNumber: props.invoiceNumber,
          total: props.total,
          currency: props.currency || 'ARS',
          dueDate: props.dueDate,
          companyName,
        });
        break;

      case 'delivery':
        message = generateDeliveryMessage({
          clientName,
          deliveryNumber: props.deliveryNumber,
          orderNumber: props.orderNumber,
          scheduledDate: props.scheduledDate,
          address: props.address,
          driverName: props.driverName,
          driverPhone: props.driverPhone,
          companyName,
          status: props.status,
        });
        break;

      case 'payment-reminder':
        message = generatePaymentReminderMessage({
          clientName,
          invoiceNumber: props.invoiceNumber,
          amount: props.amount,
          currency: props.currency || 'ARS',
          dueDate: props.dueDate,
          daysOverdue: props.daysOverdue,
          companyName,
        });
        break;

      case 'collection':
        message = generateCollectionConfirmationMessage({
          clientName,
          paymentNumber: props.paymentNumber,
          amount: props.amount,
          currency: props.currency || 'ARS',
          companyName,
        });
        break;

      case 'custom':
        message = generateCustomMessage(clientName, props.subject, props.body, companyName);
        break;
    }

    openWhatsApp(phone, message);
    toast.success('Abriendo WhatsApp...');
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSend}
      disabled={disabled || !phone}
      className="text-success hover:text-success hover:bg-success-muted"
    >
      <MessageCircle className="w-4 h-4" />
      {showLabel && <span className="ml-2">WhatsApp</span>}
    </Button>
  );
}

// =====================================================
// DROPDOWN VERSION FOR MULTIPLE OPTIONS
// =====================================================

interface WhatsAppDropdownProps {
  phone: string;
  clientName: string;
  companyName: string;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  // Document info
  documentType: 'quote' | 'order' | 'invoice' | 'delivery';
  documentNumber: string;
  total?: number;
  currency?: string;
  // Quote specific
  quoteValidUntil?: string;
  quoteItems?: Array<{ name: string; quantity: number; price: number }>;
  daysSinceCreated?: number;
  // Order specific
  deliveryDate?: string;
  // Invoice specific
  dueDate?: string;
  daysOverdue?: number;
  // Delivery specific
  deliveryStatus?: 'scheduled' | 'dispatched' | 'delivered' | 'failed';
  deliveryAddress?: string;
  driverName?: string;
  driverPhone?: string;
}

export function WhatsAppDropdown(props: WhatsAppDropdownProps) {
  const {
    phone,
    clientName,
    companyName,
    disabled = false,
    variant = 'outline',
    size = 'sm',
    documentType,
    documentNumber,
    total = 0,
    currency = 'ARS',
  } = props;

  const handleAction = (action: string) => {
    if (!phone) {
      toast.error('El cliente no tiene teléfono registrado');
      return;
    }

    let message = '';

    switch (action) {
      case 'send-document':
        if (documentType === 'quote') {
          message = generateQuoteMessage({
            clientName,
            quoteNumber: documentNumber,
            total,
            currency,
            validUntil: props.quoteValidUntil,
            items: props.quoteItems,
            companyName,
          });
        } else if (documentType === 'order') {
          message = generateOrderConfirmationMessage({
            clientName,
            orderNumber: documentNumber,
            total,
            currency,
            deliveryDate: props.deliveryDate,
            companyName,
          });
        } else if (documentType === 'invoice') {
          message = generateInvoiceMessage({
            clientName,
            invoiceNumber: documentNumber,
            total,
            currency,
            dueDate: props.dueDate,
            companyName,
          });
        } else if (documentType === 'delivery') {
          message = generateDeliveryMessage({
            clientName,
            deliveryNumber: documentNumber,
            scheduledDate: props.deliveryDate,
            address: props.deliveryAddress,
            driverName: props.driverName,
            driverPhone: props.driverPhone,
            companyName,
            status: props.deliveryStatus || 'scheduled',
          });
        }
        break;

      case 'follow-up':
        message = generateQuoteFollowUpMessage(
          clientName,
          documentNumber,
          props.daysSinceCreated || 1,
          companyName
        );
        break;

      case 'payment-reminder':
        message = generatePaymentReminderMessage({
          clientName,
          invoiceNumber: documentNumber,
          amount: total,
          currency,
          dueDate: props.dueDate || new Date().toISOString(),
          daysOverdue: props.daysOverdue,
          companyName,
        });
        break;

      case 'delivery-update':
        message = generateDeliveryMessage({
          clientName,
          deliveryNumber: documentNumber,
          address: props.deliveryAddress,
          driverName: props.driverName,
          driverPhone: props.driverPhone,
          companyName,
          status: props.deliveryStatus || 'dispatched',
        });
        break;
    }

    if (message) {
      openWhatsApp(phone, message);
      toast.success('Abriendo WhatsApp...');
    }
  };

  const getDocumentLabel = () => {
    switch (documentType) {
      case 'quote':
        return 'Cotización';
      case 'order':
        return 'Orden';
      case 'invoice':
        return 'Factura';
      case 'delivery':
        return 'Entrega';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || !phone}
          className="text-success hover:text-success hover:bg-success-muted"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          WhatsApp
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Enviar por WhatsApp</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleAction('send-document')}>
          <Send className="w-4 h-4 mr-2" />
          Enviar {getDocumentLabel()}
        </DropdownMenuItem>

        {documentType === 'quote' && (
          <DropdownMenuItem onClick={() => handleAction('follow-up')}>
            <Bell className="w-4 h-4 mr-2" />
            Seguimiento
          </DropdownMenuItem>
        )}

        {documentType === 'invoice' && (
          <DropdownMenuItem onClick={() => handleAction('payment-reminder')}>
            <CreditCard className="w-4 h-4 mr-2" />
            Recordatorio de Pago
          </DropdownMenuItem>
        )}

        {documentType === 'delivery' && (
          <DropdownMenuItem onClick={() => handleAction('delivery-update')}>
            <Truck className="w-4 h-4 mr-2" />
            Actualización de Entrega
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =====================================================
// SIMPLE ICON BUTTON VERSION
// =====================================================

interface WhatsAppIconButtonProps {
  phone: string;
  message: string;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function WhatsAppIconButton({
  phone,
  message,
  disabled = false,
  className = '',
  title = 'Enviar por WhatsApp',
}: WhatsAppIconButtonProps) {
  const handleClick = () => {
    if (!phone) {
      toast.error('No hay teléfono registrado');
      return;
    }
    openWhatsApp(phone, message);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={disabled || !phone}
      className={cn('text-success hover:text-success hover:bg-success-muted', className)}
      title={title}
    >
      <MessageCircle className="w-4 h-4" />
    </Button>
  );
}
