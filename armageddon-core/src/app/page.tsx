export default function Home() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#050505',
            color: '#FF3300',
            fontFamily: 'monospace',
            fontSize: '1.5rem'
        }}>
            <div style={{ textAlign: 'center' }}>
                <h1>ARMAGEDDON CORE</h1>
                <p style={{ color: '#666', fontSize: '0.875rem', marginTop: '1rem' }}>
                    API Endpoint: POST /api/run
                </p>
            </div>
        </div>
    );
}
