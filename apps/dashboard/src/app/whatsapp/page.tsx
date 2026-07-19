import WhatsAppConnect from './WhatsAppConnect';

export default function WhatsAppPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        WhatsApp Connection
      </h1>
      <WhatsAppConnect />
    </main>
  );
}
