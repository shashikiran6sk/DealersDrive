'use client';

export default function WebsiteEnquiryError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-14">
      <h1 className="text-[28px]">The enquiry service is temporarily unavailable</h1>
      <p className="my-5">Please try again. Your enquiry has not been sent from this page.</p>
      <button className="input min-h-[48px] px-5" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
