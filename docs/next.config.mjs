import {createMDX} from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
    // 静态导出优化
    output: 'export', // 使用静态导出模式
    // 生产环境设置 basePath
    ...(process.env.NODE_ENV === 'development' ? {} : {basePath: '/time-capsule'}),
    images: {
        unoptimized: true, // 关闭图片优化
    },
    // 严格模式
    reactStrictMode: true,
    // Twoslash
    serverExternalPackages: ['typescript', 'twoslash']
};

export default withMDX(config);
