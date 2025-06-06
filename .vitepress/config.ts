import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "System Design Documentation",
  description: "A comprehensive guide to system design patterns and best practices",
  base: '/system_design/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Mobile', link: '/en/mobile/' },
      { text: 'Backend', link: '/en/backend/' }
    ],
    sidebar: {
      '/en/mobile/': [
        {
          text: 'Mobile Development',
          items: [
            { text: 'Introduction', link: '/en/mobile/' },
            {
              text: 'Caching',
              items: [
                { text: 'Multi-Level Caching', link: '/en/mobile/caching/multi-level' },
                { text: 'Asset Caching', link: '/en/mobile/caching/asset-caching' },
                { text: 'Memory Management', link: '/en/mobile/caching/memory-management' },
                { text: 'Disk Cache', link: '/en/mobile/caching/disk-cache' },
                { text: 'Cache Invalidation', link: '/en/mobile/caching/invalidation' }
              ]
            }
          ]
        }
      ],
      '/en/backend/': [
        {
          text: 'Backend Development',
          items: [
            { text: 'Introduction', link: '/en/backend/' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/endmr11/system_design' }
    ]
  }
}) 