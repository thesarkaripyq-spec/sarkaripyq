import React, { useState, memo } from 'react';

const OptimizedImage = memo(({
  src,
  alt,
  width,
  height,
  className = '',
  loading = 'lazy',
  decoding = 'async',
  fallbackSrc = '/ssc-logo.webp',
  fetchpriority,
}) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [loaded, setLoaded] = useState(false);

  const handleError = () => {
    if (imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      fetchpriority={fetchpriority}
      onError={handleError}
      onLoad={() => setLoaded(true)}
      className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      style={{ aspectRatio: width && height ? `${width}/${height}` : undefined }}
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
