import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "System Design Documentation",
  description: "A comprehensive guide to system design patterns and best practices",
  base: '/system_design/',
  
  // Language configuration
  lang: 'en-US',
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      link: '/en/'
    },
    tr: {
      label: 'Türkçe',
      lang: 'tr-TR',
      link: '/tr/'
    }
  },

  // Theme configuration
  themeConfig: {
    // Search configuration
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: 'Search',
            buttonAriaLabel: 'Search'
          },
          modal: {
            noResultsText: 'No results for',
            resetButtonTitle: 'Reset search',
            footer: {
              selectText: 'to select',
              navigateText: 'to navigate',
              closeText: 'to close'
            }
          }
        }
      }
    },

    // Navigation
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Mobile', link: '/en/mobile/' },
      { text: 'Backend', link: '/en/backend/' }
    ],

    // Sidebar configuration
    sidebar: {
      '/en/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/en/' }
          ]
        },
        {
          text: 'Mobile Development',
          items: [
            { text: 'Overview', link: '/en/mobile/' },
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
        },
        {
          text: 'Backend Development',
          items: [
            { text: 'Overview', link: '/en/backend/' }
          ]
        }
      ],
      '/tr/': [
        {
          text: 'Giriş',
          items: [
            { text: 'Başlangıç', link: '/tr/' }
          ]
        },
        {
          text: 'Mobil Geliştirme',
          items: [
            { text: 'Genel Bakış', link: '/tr/mobile/' },
            {
              text: 'Önbellekleme',
              items: [
                { text: 'Çok Seviyeli Önbellekleme', link: '/tr/mobile/caching/multi-level' },
                { text: 'Varlık Önbellekleme', link: '/tr/mobile/caching/asset-caching' },
                { text: 'Bellek Yönetimi', link: '/tr/mobile/caching/memory-management' },
                { text: 'Disk Önbelleği', link: '/tr/mobile/caching/disk-cache' },
                { text: 'Önbellek Geçersizleştirme', link: '/tr/mobile/caching/invalidation' }
              ]
            }
          ]
        },
        {
          text: 'Backend Geliştirme',
          items: [
            { text: 'Genel Bakış', link: '/tr/backend/' }
          ]
        }
      ]
    },

    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/endmr11/system_design' }
    ],

    // Footer
    footer: {
      message: 'Released under the ISC License.',
      copyright: 'Copyright © 2024-present'
    },

    // Edit link
    editLink: {
      pattern: 'https://github.com/endmr11/system_design/edit/main/:path',
      text: 'Edit this page on GitHub'
    },

    // Last updated
    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'medium'
      }
    },

    // Doc footer
    docFooter: {
      prev: 'Previous page',
      next: 'Next page'
    },

    // Outline
    outline: {
      level: [2, 3],
      label: 'On this page'
    }
  }
}) 