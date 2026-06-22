'use client';

import { ValidationView } from '@/components/validation-view';

export default function ProdValidationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight text-[#11131a]">Model Validation</h1>
        <p className="text-[12.5px] text-[#7a8090] mt-1">Detection accuracy against labeled outcomes</p>
      </div>
      <ValidationView />
    </div>
  );
}
