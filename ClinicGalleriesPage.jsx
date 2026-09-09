import { useEffect, useMemo, useState } from 'react';
import ImageGallery from './ImageGallery.jsx';
import './ImageGallery.css';

function joinAsset(base, path) {
  const root = String(base || '').replace(/\/$/, '');
  return (
    root +
    '/' +
    String(path || '')
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/')
  );
}

function mapGalleryItems(base, gallery) {
  if (!Array.isArray(gallery)) return [];
  return gallery
    .filter((item) => item && item.src)
    .map((item, index) => ({
      id: item.id ?? `gallery-${index + 1}`,
      imageUrl: joinAsset(base, item.src),
    }));
}

function mapBeforeAfterItems(base, pairs) {
  if (!Array.isArray(pairs)) return [];
  const items = [];
  pairs.forEach((pair, index) => {
    if (!pair) return;
    const n = index + 1;
    if (pair.before) {
      items.push({
        id: `ba-${n}-before`,
        imageUrl: joinAsset(base, pair.before),
      });
    }
    if (pair.after) {
      items.push({
        id: `ba-${n}-after`,
        imageUrl: joinAsset(base, pair.after),
      });
    }
  });
  return items;
}

/**
 * Loads clinics/{id}/media.json and renders two ImageGallery instances
 * (Before/After + Images).
 */
export default function ClinicGalleriesPage({
  assetsBase = '/clinics/114',
  beforeAfterHeading = 'نتایج قبل و بعد',
  imagesHeading = 'گالری تصاویر',
  clinicName = '',
} = {}) {
  const [media, setMedia] = useState(null);
  const [error, setError] = useState('');
  const name = String(clinicName || '').trim() || 'مرکز درمانی';
  const clinicPhotoAlt = `عکس کلینیک ${name} در شیراز`;
  const beforeAfterAlt = `نتایج قبل و بعد کلینیک ${name} در شیراز`;

  useEffect(() => {
    let cancelled = false;
    const url = `${String(assetsBase).replace(/\/$/, '')}/media.json`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('media.json not found');
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setMedia(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load media');
      });
    return () => {
      cancelled = true;
    };
  }, [assetsBase]);

  const imageItems = useMemo(
    () => mapGalleryItems(assetsBase, media && media.gallery),
    [assetsBase, media]
  );
  const beforeAfterItems = useMemo(
    () => mapBeforeAfterItems(assetsBase, media && media.beforeAfter),
    [assetsBase, media]
  );

  if (error) {
    return (
      <div className="container" style={{ padding: '24px 0', color: '#5f6f86' }}>
        Gallery media could not be loaded ({error}).
      </div>
    );
  }

  if (!media) {
    return (
      <div className="container" style={{ padding: '24px 0', color: '#5f6f86' }}>
        در حال بارگذاری گالری…
      </div>
    );
  }

  return (
    <div className="clinic-image-galleries">
      {beforeAfterItems.length ? (
        <section
          className="profile-before-after"
          id="profile-before-after"
          aria-labelledby="profile-ba-title"
        >
          <div className="container profile-media-block">
            <h2 id="profile-ba-title">{beforeAfterHeading}</h2>
            <ImageGallery
              items={beforeAfterItems}
              altPrefix={beforeAfterAlt}
            />
          </div>
        </section>
      ) : null}

      {imageItems.length ? (
        <section
          className="profile-gallery"
          id="profile-gallery"
          aria-labelledby="profile-gallery-title"
        >
          <div className="container profile-media-block">
            <h2 id="profile-gallery-title">{imagesHeading}</h2>
            <ImageGallery items={imageItems} altPrefix={clinicPhotoAlt} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
