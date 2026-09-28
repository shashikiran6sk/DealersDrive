export type EnquiryStatusResult = { ok: true } | { ok: false; message: string };

export const dealerEnquiryActionStub: {
  delayMs: number;
  result: EnquiryStatusResult;
  calls: { enquiryId: string; status: string }[];
} = {
  delayMs: 700,
  result: { ok: true },
  calls: [],
};

export async function setEnquiryStatusAction(
  enquiryId: string,
  status: string,
): Promise<EnquiryStatusResult> {
  dealerEnquiryActionStub.calls.push({ enquiryId, status });
  await new Promise((resolve) => setTimeout(resolve, dealerEnquiryActionStub.delayMs));
  return dealerEnquiryActionStub.result;
}
