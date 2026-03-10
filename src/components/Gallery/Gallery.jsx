import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Gallery.css'

const Gallery = () => {
  const [selectedImage, setSelectedImage] = useState(null)
  const navigate = useNavigate()

  // Sample gallery images - replace with your actual images
  const galleryImages = [
    {
      id: 1,
      src: '/gallery/1.jpeg',
      alt: 'Refresko Image 1',
      title: 'Event Highlight 1'
    },
    {
      id: 2,
      src: '/gallery/2.jpeg',
      alt: 'Refresko Image 2',
      title: 'Event Highlight 2'
    },
    {
      id: 3,
      src: '/gallery/3.jpeg',
      alt: 'Refresko Image 3',
      title: 'Event Highlight 3'
    },
    {
      id: 4,
      src: '/gallery/4.jpeg',
      alt: 'Refresko Image 4',
      title: 'Event Highlight 4'
    },
    {
      id: 5,
      src: '/gallery/5.jpeg',
      alt: 'Refresko Image 5',
      title: 'Event Highlight 5'
    },
    {
      id: 6,
      src: '/gallery/6.jpeg',
      alt: 'Refresko Image 6',
      title: 'Event Highlight 6'
    },
    {
      id: 7,
      src: '/gallery/7.jpeg',
      alt: 'Refresko Image 7',
      title: 'Event Highlight 7'
    },
    {
      id: 8,
      src: '/gallery/8.jpeg',
      alt: 'Refresko Image 8',
      title: 'Event Highlight 8'
    },
    {
      id: 9,
      src: '/gallery/9.jpeg',
      alt: 'Refresko Image 9',
      title: 'Event Highlight 9'
    },
    {
      id: 10,
      src: '/gallery/10.jpeg',
      alt: 'Refresko Image 10',
      title: 'Event Highlight 10'
    },
    {
      id: 11,
      src: '/gallery/11.jpeg',
      alt: 'Refresko Image 11',
      title: 'Event Highlight 11'
    },
    {
      id: 12,
      src: '/gallery/12.jpeg',
      alt: 'Refresko Image 12',
      title: 'Event Highlight 12'
    },
    {
      id: 13,
      src: '/gallery/13.jpeg',
      alt: 'Refresko Image 13',
      title: 'Event Highlight 13'
    },
    {
      id: 14,
      src: '/gallery/14.jpeg',
      alt: 'Refresko Image 14',
      title: 'Event Highlight 14'
    },
    {
      id: 15,
      src: '/gallery/15.jpeg',
      alt: 'Refresko Image 15',
      title: 'Event Highlight 15'
    },
    {
      id: 16,
      src: '/gallery/16.jpeg',
      alt: 'Refresko Image 16',
      title: 'Event Highlight 16'
    },
  ]

  const openModal = (image) => {
    setSelectedImage(image)
    document.body.style.overflow = 'hidden'
  }

  const closeModal = () => {
    setSelectedImage(null)
    document.body.style.overflow = 'unset'
  }

  const navigateImage = (direction) => {
    const currentIndex = galleryImages.findIndex(img => img.id === selectedImage.id)
    let newIndex
    
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % galleryImages.length
    } else {
      newIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length
    }
    
    setSelectedImage(galleryImages[newIndex])
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedImage) return
      
      if (e.key === 'Escape') closeModal()
      if (e.key === 'ArrowRight') navigateImage('next')
      if (e.key === 'ArrowLeft') navigateImage('prev')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, galleryImages])

  return (
    <div className="gallery-container">
      <div className="gallery-header">
        <button className="gallery-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1 className="gallery-title">
          <span className="glitch-text" data-text="REFRESKO">REFRESKO</span>
          <br />
          <span className="gallery-subtitle">GALLERY</span>
        </h1>
        <p className="gallery-description">
          A visual journey through our events, team, and memorable moments
        </p>
      </div>

      {/* Gallery grid */}
      <div className="gallery-grid">
        {galleryImages.map((image) => (
          <div 
            key={image.id} 
            className="gallery-item"
            onClick={() => openModal(image)}
          >
            <div className="image-wrapper">
              <img 
                src={image.src} 
                alt={image.alt}
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/400x300?text=' + encodeURIComponent(image.title)
                }}
              />
              <div className="image-overlay">
                <div className="image-info">
                  <h3>{image.title}</h3>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal/Lightbox */}
      {selectedImage && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              &times;
            </button>
            <button 
              className="modal-nav modal-prev" 
              onClick={() => navigateImage('prev')}
            >
              &#8249;
            </button>
            <img 
              src={selectedImage.src} 
              alt={selectedImage.alt}
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/800x600?text=' + encodeURIComponent(selectedImage.title)
              }}
            />
            <button 
              className="modal-nav modal-next" 
              onClick={() => navigateImage('next')}
            >
              &#8250;
            </button>
            <div className="modal-info">
              <h3>{selectedImage.title}</h3>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Gallery
