import ImageGallery from './ImageGallery.jsx';

/** Example items for clinics/114 gallery photos */
export const nahalGalleryItems = [
  { id: 1, imageUrl: '/clinics/114/gallery/01.webp' },
  { id: 2, imageUrl: '/clinics/114/gallery/02.webp' },
  { id: 3, imageUrl: '/clinics/114/gallery/03.webp' },
  { id: 4, imageUrl: '/clinics/114/gallery/04.webp' },
];

export default function ImageGalleryDemo({ items = nahalGalleryItems }) {
  return (
    <div style={{ padding: '24px 16px', background: '#f4f6f8', minHeight: '40vh' }}>
      <ImageGallery items={items} altPrefix="Clinic photo" />
    </div>
  );
}
