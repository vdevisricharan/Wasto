import { useEffect } from 'react';

export interface TabMetadata {
  title: string;
  description: string;
  keywords?: string;
}

export const TAB_SEO_CONFIG: Record<string, TabMetadata> = {
  overview: {
    title: 'Overview — Wasto Waste Operations',
    description:
      'Classify materials, monitor sorting, and follow waste from collection to processing.',
    keywords:
      'waste classification, automated waste sorting, computer vision waste segregation, MobileNetV3, Arduino waste sorter, municipal waste tracking',
  },
  classify: {
    title: 'Classify Waste — Wasto',
    description:
      'Add a photo or batch of images to identify waste materials and review their sorting destination.',
    keywords:
      'waste classification, image classifier, recyclable detection, compost classification, MobileNetV3',
  },
  monitor: {
    title: 'Live Monitor — Wasto',
    description:
      'Monitor camera frames, live material classification, and sorting flap actuation status.',
    keywords:
      'live waste sorter monitor, servo flap angle, conveyor camera vision, Arduino hardware monitor',
  },
  tracking: {
    title: 'Waste Tracking — Wasto',
    description:
      'Follow waste batches from source collection to transport, facility sorting, and final processing.',
    keywords:
      'municipal waste tracking, chain of custody waste management, recycling provenance',
  },
  history: {
    title: 'History — Wasto',
    description:
      'Review classification history, sorting destinations, confidence scores, and CSV exports.',
    keywords:
      'waste sorting log, classification history, waste audit export',
  },
  architecture: {
    title: 'Model & System — Wasto',
    description:
      'Classification model details, sorting policy rules, hardware configuration, and measured benchmarks.',
    keywords:
      'MobileNetV3 benchmark, Arduino Uno UART protocol, waste sorting policy',
  },
};

export function useSEO(currentTab: string) {
  useEffect(() => {
    const config = TAB_SEO_CONFIG[currentTab] || TAB_SEO_CONFIG.overview;
    const baseCanonical = 'https://wasto.netlify.app/';
    const currentUrl = currentTab === 'overview' ? baseCanonical : `${baseCanonical}#${currentTab}`;

    document.title = config.title;

    const setMetaTag = (attributeName: string, attributeValue: string, content: string) => {
      let el = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attributeName, attributeValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const setLinkTag = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    setMetaTag('name', 'description', config.description);
    if (config.keywords) {
      setMetaTag('name', 'keywords', config.keywords);
    }
    setLinkTag('canonical', currentUrl);

    setMetaTag('property', 'og:title', config.title);
    setMetaTag('property', 'og:description', config.description);
    setMetaTag('property', 'og:url', currentUrl);

    setMetaTag('name', 'twitter:title', config.title);
    setMetaTag('name', 'twitter:description', config.description);
    setMetaTag('name', 'twitter:url', currentUrl);
  }, [currentTab]);
}
