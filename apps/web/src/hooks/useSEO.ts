import { useEffect } from 'react';

export interface TabMetadata {
  title: string;
  description: string;
  keywords?: string;
}

export const TAB_SEO_CONFIG: Record<string, TabMetadata> = {
  overview: {
    title: 'Wasto — Automated Waste Classification, Actuation & Tracking Platform',
    description:
      'AI-powered automated waste segregation platform combining MobileNetV3 edge computer vision, non-blocking Arduino Uno flap actuation, and municipal source-to-recycling lifecycle tracking.',
    keywords:
      'waste classification, automated waste sorting, computer vision waste segregation, MobileNetV3, Arduino waste sorter, smart dustbin, municipal waste tracking, sustainability IoT',
  },
  classify: {
    title: 'Classify Waste | Wasto Automated Material Classifier',
    description:
      'Upload single images or bulk batches for real-time 9-class waste classification with MobileNetV3 deep learning, confidence metrics, and 3-chute deflection routing.',
    keywords:
      'waste classification, image classifier, deep learning waste sort, recyclable detection, compost classification, MobileNetV3 waste test',
  },
  monitor: {
    title: 'Live Sorter Monitor & Hardware Telemetry | Wasto',
    description:
      'Real-time camera feed, servo deflection flap angles (Chute 1 Organic, Chute 2 Recyclable, Chute 3 Residual), conveyor telemetry, and smart dustbin ultrasonic fill levels.',
    keywords:
      'live waste sorter monitor, servo flap angle, conveyor camera vision, ultrasonic dustbin telemetry, Arduino hardware monitor',
  },
  tracking: {
    title: 'Municipal Waste Tracking & Chain of Custody | Wasto',
    description:
      'End-to-end municipal batch provenance: register campus waste batches, dispatch collection vehicles, log weighbridge tare, and track optical sorting verification.',
    keywords:
      'municipal waste tracking, chain of custody waste management, recycling provenance, weighbridge tare tracking, circular economy audit',
  },
  history: {
    title: 'Classification Audit History & Analytics | Wasto',
    description:
      'Explore immutable sorting logs, material distribution breakdowns, confidence scores, actuated chute angles, and diversion rates from municipal waste runs.',
    keywords:
      'waste sorting analytics, recycling diversion rate, municipal sorting log, classification history, waste data audit',
  },
  architecture: {
    title: 'System Architecture & ML Benchmarks | Wasto',
    description:
      'Technical specifications of the Wasto platform: MobileNetV3Large inference latency benchmarks, Arduino Uno non-blocking UART protocol, and failsafe abstention policies.',
    keywords:
      'MobileNetV3 benchmark, edge AI architecture, Arduino Uno UART protocol, zero false biodegradability, waste sorting system design',
  },
};

export function useSEO(currentTab: string) {
  useEffect(() => {
    const config = TAB_SEO_CONFIG[currentTab] || TAB_SEO_CONFIG.overview;
    const baseCanonical = 'https://wasto.netlify.app/';
    const currentUrl = currentTab === 'overview' ? baseCanonical : `${baseCanonical}#${currentTab}`;

    // Update Document Title
    document.title = config.title;

    // Helper to create or update meta tags
    const setMetaTag = (attributeName: string, attributeValue: string, content: string) => {
      let el = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attributeName, attributeValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Helper to update link tags
    const setLinkTag = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // Standard SEO Tags
    setMetaTag('name', 'description', config.description);
    if (config.keywords) {
      setMetaTag('name', 'keywords', config.keywords);
    }

    // Canonical link
    setLinkTag('canonical', currentUrl);

    // Open Graph Meta Tags
    setMetaTag('property', 'og:title', config.title);
    setMetaTag('property', 'og:description', config.description);
    setMetaTag('property', 'og:url', currentUrl);

    // Twitter Card Meta Tags
    setMetaTag('name', 'twitter:title', config.title);
    setMetaTag('name', 'twitter:description', config.description);
    setMetaTag('name', 'twitter:url', currentUrl);
  }, [currentTab]);
}
