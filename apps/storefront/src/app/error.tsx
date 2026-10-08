'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="wl-system-error">
      <h1>We couldn't load this website</h1>
      <p>
        Please try again in a moment. The dealership's inventory and enquiries are managed securely
        through Dealers-Drive.
      </p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
