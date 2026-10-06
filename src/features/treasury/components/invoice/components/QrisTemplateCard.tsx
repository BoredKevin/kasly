import { Panel } from "../../../../../ui";

export interface QrisTemplateCardProps {
  qrImageUrl: string;
  merchantName: string;
  amount?: number;
  currency?: string;
  invoiceNumber: string;
}

export function QrisTemplateCard({
  qrImageUrl,
  merchantName,
}: QrisTemplateCardProps) {
  return (
    <Panel className="relative p-2.5 sm:p-4 bg-card border border-border/80 rounded-[var(--fintech-radius-md)] shadow-sm overflow-hidden max-w-sm sm:max-w-md mx-auto">
      {/* Standard White QRIS Card with Template Background */}
      <div className="relative w-full aspect-[1000/1388] rounded-[var(--fintech-radius-sm)] overflow-hidden bg-white shadow-sm border border-neutral-200 select-none">
        {/* The Official Indonesian QRIS Frame Asset */}
        <img
          src="/qris_template.0376c2d6e287551a.png"
          alt="QRIS Template"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          loading="eager"
        />

        {/* Dynamic Content Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-start pt-[33%] pointer-events-none">
          {/* 1. Bold QRIS Merchant Display Name */}
          <div className="w-[100%] text-center mb-3 sm:mb-4 px-3">
            <h3
              style={{ fontSize: "22px" }}
              className="font-bold text-neutral-900 tracking-tight leading-tight font-sans line-clamp-2"
            >
              {merchantName}
            </h3>
          </div>

          {/* 2. QR Code Overlay */}
          <div className="w-[80%] aspect-square flex items-center justify-center p-1 sm:p-1.5 bg-white">
            <img
              src={qrImageUrl}
              alt="QRIS Code"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
