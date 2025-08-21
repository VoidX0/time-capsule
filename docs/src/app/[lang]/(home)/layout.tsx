import type {ReactNode} from 'react';
import {HomeLayout} from 'fumadocs-ui/layouts/home';
import {baseOptions} from '@/app/[lang]/layout.config';
import {LuGithub} from "react-icons/lu";

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
                    text: (
                        <span className="flex items-center gap-1">
                            <LuGithub className="w-4 h-4"/>
                            GitHub
                        </span>
                    ),
                    url: "https://github.com/VoidX0",
                },
            ]}
        >
            {children}
        </HomeLayout>
    );
}
