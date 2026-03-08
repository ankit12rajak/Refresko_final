import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'
import './Events.css'

const Events = () => {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })

  return (
    <section id="events" ref={sectionRef} className="events" data-particle-shape="3">
      <motion.h2
        className="section-title events-title"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
      >
        EVENTS
      </motion.h2>

      <div className="events-container">
        <motion.div
          className="event-banner-wrapper"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <img
            src="/event%20banner.png"
            alt="Events banner"
            className="event-banner-image"
            loading="lazy"
            decoding="async"
          />
        </motion.div>

        <motion.div
          className="register-now-events"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          <a
            href="https://forms.gle/QF4pPtpHZ2GPEUYV7"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline interactive"
          >
            REGISTER NOW
            <span className="btn-arrow">→</span>
          </a>
        </motion.div>
      </div>

      <motion.div
        className="view-all-events"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.8 }}
      >
        <Link to="/events" className="btn-outline interactive">
          VIEW ALL EVENTS
          <span className="btn-arrow">→</span>
        </Link>
      </motion.div>
    </section>
  )
}

export default Events
