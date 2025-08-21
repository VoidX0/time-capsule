import type {ReactNode} from 'react';
import {HomeLayout} from 'fumadocs-ui/layouts/home';
import {baseOptions} from '@/app/[lang]/layout.config';

export default async function Layout({
                                         params,
                                         children,
                                     }: {
    params: Promise<{ lang: string }>;
    children: ReactNode;
}) {
    const {lang} = await params;
    return (
        <HomeLayout
            {...baseOptions(lang)}
            links={[
                {
                    text: 'MAIN',
                    url: `/${lang}/docs/main`,
                },
            ]}
        >
            {children}
        </HomeLayout>
    );
}
