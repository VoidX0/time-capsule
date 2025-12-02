import {createMDX} from 'fumadocs-mdx/next';

const withMDX = createMDX();

const basePath = process.env.NODE_ENV === 'development' ? '' : '/time-capsule';
const projectName = 'Time Capsule';
const projectRepo = 'https://github.com/VoidX0/time-capsule'
const projectDescriptionEn = 'An open-source video management and playback application designed to organize surveillance footage stored on NAS';
const projectDescriptionZh = '一款开源的视频管理与播放应用，旨在整理存储在NAS上的监控录像';

/** @type {import('next').NextConfig} */
const config = {
    // 静态导出优化
    output: 'export', // 使用静态导出模式
    // 生产环境设置 basePath
    basePath: basePath,
    images: {
        unoptimized: true, // 关闭图片优化
    },
    trailingSlash: true, //Change links `/me` -> `/me/` and emit `/me.html` -> `/me/index.html`
    skipTrailingSlashRedirect: true, //Prevent automatic `/me` -> `/me/`, instead preserve `href`
    // 严格模式
    reactStrictMode: true,
    // Twoslash
    serverExternalPackages: ['typescript', 'twoslash'],
    // 环境变量
    env: {
        NEXT_PUBLIC_BASE_PATH: basePath,
        NEXT_PUBLIC_PROJECT_NAME: projectName,
        NEXT_PUBLIC_PROJECT_REPO: projectRepo,
        NEXT_PUBLIC_PROJECT_DESCRIPTION_EN: projectDescriptionEn,
        NEXT_PUBLIC_PROJECT_DESCRIPTION_ZH: projectDescriptionZh,
    },
};

export default withMDX(config);
