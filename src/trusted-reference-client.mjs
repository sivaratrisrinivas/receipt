export function createTrustedReferenceClient({ baseUrl, fetchImpl = fetch }) {
  return {
    async hasRefundReference(refundReference) {
      const response = await fetchImpl(`${baseUrl}/trusted-refund-references/${encodeURIComponent(refundReference)}`);
      if (response.status === 404) return false;
      if (!response.ok) throw new Error("Receipt could not confirm the trusted Refund Reference.");
      return true;
    },
  };
}
