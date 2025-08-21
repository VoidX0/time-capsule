import Link from 'next/link';

export default function HomePage() {
    return (
        <main className="flex flex-1 flex-col justify-center text-center">
            <h1 className="mb-4 text-2xl font-bold">Fumadocs</h1>
            <p className="text-fd-muted-foreground">
                see the documentation.
            </p>
            <Link
                href="/docs/main"
                className="text-fd-foreground font-semibold underline"
                style={{
                    position: 'absolute',
                    bottom: '30%',
                    left: '50%',
                }}
            >
            </Link>
        </main>
    );
}
