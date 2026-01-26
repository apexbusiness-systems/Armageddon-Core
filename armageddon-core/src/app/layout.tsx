export const metadata = {
    title: 'Armageddon Core',
    description: 'Level 7 Certification Engine',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
