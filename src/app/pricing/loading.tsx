export default function PricingLoading() {
  return (
    <main className="pricingPage" aria-busy="true" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <p style={{ color: '#687682', fontSize: 13 }}>Loading subscription plans…</p>
    </main>
  );
}
