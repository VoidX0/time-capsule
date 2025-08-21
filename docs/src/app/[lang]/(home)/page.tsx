import {i18n} from "@/lib/i18n";
import {Dots} from "@/components/loader/dots";
import Link from "next/link";

export const generateStaticParams = () =>
    i18n.languages.map((lang) => ({lang}));

export default async function HomePage({
                                           params,
                                       }: {
    params: Promise<{ lang: string }>;
}) {
    const {lang} = await params;
    return (
        <main className="flex flex-1 flex-col justify-center text-center">
            <h1 className="mb-4 text-2xl font-bold"> {lang === "en" ? 'Get started' : '快速开始'}</h1>
            <p className="text-fd-muted-foreground">
                {lang === "en"
                    ? 'Get started with our step-by-step guide, explore deployment options, or browse the reference.'
                    : '通过我们的分步指南快速上手，了解部署选项，或浏览参考文档。'}
            </p>
            <Link
                href={`/${lang}/docs/started`}
                className="text-fd-foreground font-semibold underline"
                style={{
                    position: 'absolute',
                    bottom: '30%',
                    left: '50%',
                }}
            >
                <Dots/>
            </Link>
        </main>
    );
}
