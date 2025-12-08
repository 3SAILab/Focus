import QuotaErrorAlert from '../QuotaErrorAlert';
import ContactModal from '../ContactModal';

export interface QuotaErrorHandlerProps {
  showQuotaError: boolean;
  showContact: boolean;
  onQuotaErrorClose: () => void;
  onContactClose: () => void;
  onContactSales: () => void;
}

export default function QuotaErrorHandler({
  showQuotaError,
  showContact,
  onQuotaErrorClose,
  onContactClose,
  onContactSales,
}: QuotaErrorHandlerProps) {
  return (
    <div data-testid="quota-error-handler">
      <QuotaErrorAlert
        isOpen={showQuotaError}
        onClose={onQuotaErrorClose}
        onContactSales={onContactSales}
      />
      <ContactModal
        isOpen={showContact}
        onClose={onContactClose}
      />
    </div>
  );
}
