import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ClinicGalleriesPage from './ClinicGalleriesPage.jsx';

let root = null;

function renderInto(mountNode, options) {
  if (!mountNode) return false;
  const opts = options || {};
  const assetsBase =
    opts.assetsBase || mountNode.dataset.assetsBase || '/clinics/114';
  const beforeAfterHeading =
    opts.beforeAfterHeading ||
    mountNode.dataset.baHeading ||
    'نتایج قبل و بعد';
  const imagesHeading =
    opts.imagesHeading || mountNode.dataset.imagesHeading || 'گالری تصاویر';
  const clinicName =
    opts.clinicName || mountNode.dataset.clinicName || '';

  mountNode.dataset.assetsBase = assetsBase;
  mountNode.hidden = false;
  mountNode.removeAttribute('hidden');

  if (!root) {
    root = createRoot(mountNode);
  }

  root.render(
    <StrictMode>
      <ClinicGalleriesPage
        assetsBase={assetsBase}
        beforeAfterHeading={beforeAfterHeading}
        imagesHeading={imagesHeading}
        clinicName={clinicName}
      />
    </StrictMode>
  );

  mountNode.dataset.mounted = '1';
  return true;
}

function mountClinicGalleries(options) {
  const mountNode = document.getElementById('clinic-galleries-root');
  if (!mountNode) return false;
  return renderInto(mountNode, options || {});
}

window.mountClinicGalleries = mountClinicGalleries;
window.ClinicGalleries = { mount: mountClinicGalleries };

function autoMount() {
  const mountNode = document.getElementById('clinic-galleries-root');
  if (!mountNode || mountNode.hasAttribute('hidden')) return;
  mountClinicGalleries({
    assetsBase: mountNode.dataset.assetsBase || '/clinics/114',
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoMount);
} else {
  autoMount();
}
