'use client';
import { useEffect, useRef, useState } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function useOrderSave() {
  const [warning, setWarning] = useState(null);
  const resolver = useRef(null);
  function answer(value) { resolver.current?.(value); resolver.current = null; setWarning(null); }
  useEffect(() => () => resolver.current?.(false), []);
  async function saveOrder(url, method, body) {
    async function send(confirmed) {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, confirm_duplicate: confirmed }) });
      const data = await response.json();
      return { response, data };
    }
    let { response, data } = await send(false);
    if (data.code === 'DUPLICATE_ORDER_NUMBER') {
      const accepted = await new Promise(resolve => { resolver.current = resolve; setWarning(data.error); });
      if (!accepted) return null;
      ({ response, data } = await send(true));
    }
    if (!response.ok) { const error = new Error(data.error || 'Could not save the order.'); error.code = data.code; throw error; }
    return data;
  }
  const numberingDialog = <ConfirmModal isOpen={Boolean(warning)} title="Duplicate Order Number" message={warning || ''} confirmText="Continue Anyway" confirmColor="primary" onConfirm={() => answer(true)} onCancel={() => answer(false)} />;
  return { saveOrder, numberingDialog };
}
