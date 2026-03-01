import { useRef, useState, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import './Performers.css'

const performers = [
  {
    id: 1,
    name: 'Fossils',
    role: 'Playback Singer',
    // year: '2012',
    image: 'https://fossilsmusic.in/images/og.jpg'
  },
  {
    id: 2,
    name: 'Underground Authority',
    role: 'Playback Singer',
    // year: '2013',
    image: 'https://i.scdn.co/image/ab6761610000517480ae877d506397d931a1e93d'
  },
  {
    id: 3,
    name: 'Nakaz Asis',
    role: 'Performer',
    // year: '2024',
    image: 'https://www.musiculture.in/wp-content/uploads/2025/12/PHOTO-2025-12-15-15-49-14-2-800x800.jpg'
  },
    {
    id: 4,
    name: 'Mohammad Irfan',
    role: 'Performer',
    // year: '2015',
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSFeJy61SdcChnqEux5J_QfEsJENMtczVtHvQ&s'
  },
    {
    id: 5,
    name: 'Raj barman',
    role: 'Performer',
    // year: '2024',
    image: 'https://i.scdn.co/image/ab6761610000e5ebd84014344081d6fb5529a53c'
  },
      {
    id: 6,
    name: 'Ash King',
    role: 'Performer',
    // year: '2024',
    image: 'https://data1.ibtimes.co.in/en/full/628385/ash-king.jpg'
  },
  // https://admin.hire4event.com/assets/artistimage/1-65617b79890e0.webp
        {
    id: 7,
    name: 'Snigdhajit Bhowmik',
    role: 'Performer',
    // year: '2024',
    image: 'https://admin.hire4event.com/assets/artistimage/1-65617b79890e0.webp'
  },
  {
    id: 8,
    name: 'NANDY SISTERS',
    role: 'Musical Duo',
    // year: '2025',
    image: '/nandysisters2025.jpg'
  }
]

const Performers = () => {
  const sectionRef = useRef(null)
  const scrollRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })
  const [activePerformer, setActivePerformer] = useState(0)

  useEffect(() => {
    if (!isInView || performers.length <= 1) {
      return
    }

    const intervalId = window.setInterval(() => {
      setActivePerformer((prevIndex) => (prevIndex + 1) % performers.length)
    }, 2800)

    return () => window.clearInterval(intervalId)
  }, [isInView])

  useEffect(() => {
    // Auto-scroll to active performer on mobile
    if (scrollRef.current) {
      const container = scrollRef.current
      const cards = container.querySelectorAll('.performer-card')
      
      if (cards[activePerformer]) {
        const card = cards[activePerformer]
        const containerWidth = container.offsetWidth
        const cardLeft = card.offsetLeft
        const cardWidth = card.offsetWidth
        
        // Calculate scroll position to center the card
        const scrollPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2)
        
        container.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
        })
      }
    }
  }, [activePerformer])

  return (
    <section id="performers" ref={sectionRef} className="performers" data-particle-shape="2">
      <div className="performers-header">
        <motion.span
          className="performers-label"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          PAST
        </motion.span>
        <motion.h2
          className="performers-title"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          PERFORMERS
        </motion.h2>
      </div>

      <div className="performers-track-wrapper">
        <div className="dotted-path">
          <svg viewBox="0 0 1200 200" preserveAspectRatio="none">
            <path
              d="M0,100 Q300,20 600,100 T1200,100"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
              strokeDasharray="8,8"
              fill="none"
            />
          </svg>
        </div>

        <div className="performers-scroll" ref={scrollRef}>
          <div className="performers-grid">
            {performers.map((performer, index) => (
              <motion.div
                key={performer.id}
                className={`performer-card interactive ${activePerformer === index ? 'active' : ''}`}
                initial={{ opacity: 0, y: 50 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
              >
                <div className="performer-year-badge">{performer.year}</div>
                <div className="performer-image-wrapper">
                  <img
                    src={performer.image}
                    alt={performer.name}
                    className="performer-image"
                  />
                  <div className="performer-overlay">
                    <div className="performer-info">
                      <h3 className="performer-name">{performer.name}</h3>
                      <p className="performer-role">{performer.role}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="performers-indicator">
        <span className="indicator-text">Refresko 2026</span>
      </div>
    </section>
  )
}

export default Performers
