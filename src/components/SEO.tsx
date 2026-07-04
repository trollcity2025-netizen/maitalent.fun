import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string;
}

export default function SEO({ title, description, keywords }: SEOProps) {
  useEffect(() => {
    document.title = `${title} | MaiTalent.fun`;

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    };

    if (description) {
      setMeta('description', description);
    }

    if (keywords) {
      setMeta('keywords', keywords);
    }
  }, [title, description, keywords]);

  return null;
}
