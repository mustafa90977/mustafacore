import MessagesList from './MessagesList';

export default function MessagesPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Messages
      </h1>
      <MessagesList />
    </main>
  );
}
